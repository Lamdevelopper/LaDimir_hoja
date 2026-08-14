/**
 * Transformación entre el espacio del documento (centímetros, origen en la
 * esquina inferior izquierda) y el espacio del canvas (píxeles CSS).
 *
 * El estado es intencionadamente pequeño y serializable. El pan se guarda en
 * píxeles de pantalla; por eso no depende del tamaño lógico de la hoja.
 */

export const DEFAULT_PIXELS_PER_CM = 96 / 2.54;
export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 40;

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

/**
 * Viewport del documento. Todos los métodos devuelven nuevos objetos y no
 * mutan las coordenadas proporcionadas por quien llama.
 */
export class Viewport {
  constructor(options = {}, positionalHeightCm) {
    // Se admite la forma compacta `new Viewport(widthCm, heightCm)` además de
    // la forma documentada por opciones nombradas.
    const config = options && typeof options === 'object'
      ? options
      : { sheetWidthCm: options, sheetHeightCm: positionalHeightCm };
    const {
      sheetWidthCm = 21,
      sheetHeightCm = 29.7,
      widthPx = 800,
      heightPx = 600,
      viewportWidthPx,
      viewportHeightPx,
      sheet,
      pixelsPerCm = DEFAULT_PIXELS_PER_CM,
      zoom = 1,
      panX = 0,
      panY = 0,
    } = config;
    this.sheetWidthCm = Math.max(0, finite(sheet?.widthCm, finite(sheetWidthCm, 21)));
    this.sheetHeightCm = Math.max(0, finite(sheet?.heightCm, finite(sheetHeightCm, 29.7)));
    this.widthPx = Math.max(0, finite(viewportWidthPx, finite(widthPx, 800)));
    this.heightPx = Math.max(0, finite(viewportHeightPx, finite(heightPx, 600)));
    this.pixelsPerCm = Math.max(Number.EPSILON, finite(pixelsPerCm, DEFAULT_PIXELS_PER_CM));
    this.zoom = clamp(finite(zoom, 1), MIN_ZOOM, MAX_ZOOM);
    this.panX = finite(panX, 0);
    this.panY = finite(panY, 0);
  }

  get scalePxPerCm() {
    return this.pixelsPerCm * this.zoom;
  }

  /** Alias de compatibilidad para herramientas que sólo necesitan leer escala. */
  get scale() {
    return this.scalePxPerCm;
  }

  /** Actualiza el tamaño CSS disponible para el canvas. */
  setSize(widthPx, heightPx) {
    this.widthPx = Math.max(0, finite(widthPx, this.widthPx));
    this.heightPx = Math.max(0, finite(heightPx, this.heightPx));
    return this;
  }

  setViewportSize(widthPx, heightPx) {
    return this.setSize(widthPx, heightPx);
  }

  resize(widthPx, heightPx) {
    return this.setSize(widthPx, heightPx);
  }

  setSheetSize(widthCm, heightCm) {
    this.sheetWidthCm = Math.max(0, finite(widthCm, this.sheetWidthCm));
    this.sheetHeightCm = Math.max(0, finite(heightCm, this.sheetHeightCm));
    return this;
  }

  /** Convierte coordenadas de documento a píxeles CSS. */
  documentToScreen(point) {
    const x = finite(point?.x, 0);
    const y = finite(point?.y, 0);
    const scale = this.scalePxPerCm;
    return {
      x: this.panX + x * scale,
      y: this.panY + this.heightPx - y * scale,
    };
  }

  /** Convierte píxeles CSS a coordenadas de documento. */
  screenToDocument(point) {
    const x = finite(point?.x, 0);
    const y = finite(point?.y, 0);
    const scale = this.scalePxPerCm;
    return {
      x: (x - this.panX) / scale,
      y: (this.heightPx + this.panY - y) / scale,
    };
  }

  cmToPx(point) {
    return this.documentToScreen(point);
  }

  pxToCm(point) {
    return this.screenToDocument(point);
  }

  /** Desplaza la hoja en píxeles de pantalla. */
  panBy(deltaX, deltaY) {
    this.panX += finite(deltaX, 0);
    this.panY += finite(deltaY, 0);
    return this;
  }

  setPan(panX, panY) {
    this.panX = finite(panX, this.panX);
    this.panY = finite(panY, this.panY);
    return this;
  }

  setZoom(zoom) {
    this.zoom = clamp(finite(zoom, this.zoom), MIN_ZOOM, MAX_ZOOM);
    return this;
  }

  /**
   * Cambia zoom manteniendo fijo bajo el cursor el punto de documento que
   * estaba allí. El factor suele ser `1.1` o `1 / 1.1`.
   */
  zoomAt(factor, anchor) {
    // También acepta `zoomAt(anchor, factor)` para integrarse con handlers
    // que colocan primero el punto del evento.
    if (factor && typeof factor === 'object') [anchor, factor] = [factor, anchor];
    const amount = finite(factor, 1);
    if (amount <= 0) return this;
    const before = this.screenToDocument(anchor);
    const nextZoom = clamp(this.zoom * amount, MIN_ZOOM, MAX_ZOOM);
    this.zoom = nextZoom;
    const after = this.documentToScreen(before);
    this.panX += finite(anchor?.x, 0) - after.x;
    this.panY += finite(anchor?.y, 0) - after.y;
    return this;
  }

  /** Alias explícito para consumidores que manejan eventos de rueda. */
  zoomAround(anchor, factor) {
    return this.zoomAt(factor, anchor);
  }

  /** Centra la hoja y la escala para ocupar el área disponible. */
  fitToSheet(paddingPx = 16) {
    const padding = Math.max(0, finite(paddingPx, 16));
    const usableWidth = Math.max(1, this.widthPx - padding * 2);
    const usableHeight = Math.max(1, this.heightPx - padding * 2);
    const fitZoom = Math.min(
      usableWidth / (this.sheetWidthCm * this.pixelsPerCm || 1),
      usableHeight / (this.sheetHeightCm * this.pixelsPerCm || 1),
    );
    this.zoom = clamp(fitZoom, MIN_ZOOM, MAX_ZOOM);
    this.panX = (this.widthPx - this.sheetWidthCm * this.scalePxPerCm) / 2;
    // `documentToScreen` suma panY al origen inferior; el margen inferior
    // centrado debe desplazarlo hacia arriba, es decir, con signo negativo.
    this.panY = -(this.heightPx - this.sheetHeightCm * this.scalePxPerCm) / 2;
    return this;
  }

  /** Rectángulo visible en centímetros, sin recortarlo a la hoja. */
  getVisibleDocumentRect() {
    const topLeft = this.screenToDocument({ x: 0, y: 0 });
    const bottomRight = this.screenToDocument({ x: this.widthPx, y: this.heightPx });
    return {
      minX: Math.min(topLeft.x, bottomRight.x),
      maxX: Math.max(topLeft.x, bottomRight.x),
      minY: Math.min(topLeft.y, bottomRight.y),
      maxY: Math.max(topLeft.y, bottomRight.y),
    };
  }

  /** Rectángulo visible intersectado con los límites de la hoja. */
  getVisibleSheetRect() {
    const visible = this.getVisibleDocumentRect();
    return {
      minX: Math.max(0, visible.minX),
      maxX: Math.min(this.sheetWidthCm, visible.maxX),
      minY: Math.max(0, visible.minY),
      maxY: Math.min(this.sheetHeightCm, visible.maxY),
    };
  }

  containsDocumentPoint(point, margin = 0) {
    const pad = Math.max(0, finite(margin, 0));
    return Number.isFinite(point?.x) && Number.isFinite(point?.y)
      && point.x >= -pad && point.x <= this.sheetWidthCm + pad
      && point.y >= -pad && point.y <= this.sheetHeightCm + pad;
  }

  toJSON() {
    return {
      sheetWidthCm: this.sheetWidthCm,
      sheetHeightCm: this.sheetHeightCm,
      widthPx: this.widthPx,
      heightPx: this.heightPx,
      pixelsPerCm: this.pixelsPerCm,
      zoom: this.zoom,
      panX: this.panX,
      panY: this.panY,
    };
  }
}

export function createViewport(options) {
  return new Viewport(options);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
