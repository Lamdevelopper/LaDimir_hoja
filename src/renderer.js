/** Canvas renderer for the millimetric sheet. */

const COLORS = {
  outside: '#f6f7f8',
  paper: '#ffffff',
  millimeter: 'rgba(90, 98, 108, 0.13)',
  centimeter: 'rgba(65, 73, 84, 0.38)',
  border: '#747b84',
  point: '#17324d',
  pointRing: '#ffffff',
  pointOutline: '#17324d',
  line: '#1f5aa6',
  segment: '#13795b',
  bestFit: '#a33a75',
};

const MIN_MINOR_SPACING_PX = 1.2;

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function can(ctx, method) {
  return typeof ctx?.[method] === 'function';
}

/** Configura el bitmap para el tamaño CSS del canvas y la densidad de píxeles. */
export function resizeCanvas(canvas, { widthPx, heightPx, dpr } = {}) {
  if (!canvas) throw new TypeError('Se requiere un canvas');
  const width = Math.max(0, Math.round(finite(widthPx, canvas.clientWidth || canvas.width || 0)));
  const height = Math.max(0, Math.round(finite(heightPx, canvas.clientHeight || canvas.height || 0)));
  const density = Math.max(1, finite(dpr, globalThis.devicePixelRatio || 1));
  canvas.width = Math.max(1, Math.round(width * density));
  canvas.height = Math.max(1, Math.round(height * density));
  if (canvas.style) {
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }
  const context = canvas.getContext('2d');
  if (context?.setTransform) context.setTransform(density, 0, 0, density, 0, 0);
  else if (context?.scale) context.scale(density, density);
  return { context, widthPx: width, heightPx: height, dpr: density };
}

/** Dibuja una escena completa usando coordenadas CSS del viewport. */
export function renderScene(ctx, document, viewport, options = {}) {
  if (!ctx || !viewport) return;
  const width = viewport.widthPx;
  const height = viewport.heightPx;
  const colors = { ...COLORS, ...(options.colors || {}) };

  if (can(ctx, 'save')) ctx.save();
  if (can(ctx, 'setTransform') && options.resetTransform) ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (can(ctx, 'clearRect')) ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = colors.outside;
  if (can(ctx, 'fillRect')) ctx.fillRect(0, 0, width, height);

  const sheet = {
    widthCm: finite(document?.sheet?.widthCm, viewport.sheetWidthCm),
    heightCm: finite(document?.sheet?.heightCm, viewport.sheetHeightCm),
  };
  viewport.setSheetSize(sheet.widthCm, sheet.heightCm);
  const bottomLeft = viewport.documentToScreen({ x: 0, y: 0 });
  const topRight = viewport.documentToScreen({ x: sheet.widthCm, y: sheet.heightCm });
  const left = Math.min(bottomLeft.x, topRight.x);
  const top = Math.min(bottomLeft.y, topRight.y);
  const paperWidth = Math.abs(topRight.x - bottomLeft.x);
  const paperHeight = Math.abs(topRight.y - bottomLeft.y);

  ctx.fillStyle = colors.paper;
  if (can(ctx, 'fillRect')) ctx.fillRect(left, top, paperWidth, paperHeight);

  if (can(ctx, 'save')) ctx.save();
  if (can(ctx, 'beginPath')) {
    ctx.beginPath();
    if (can(ctx, 'rect')) ctx.rect(left, top, paperWidth, paperHeight);
    if (can(ctx, 'clip')) ctx.clip();
  }
  drawGrid(ctx, viewport, sheet, colors);
  if (can(ctx, 'restore')) ctx.restore();

  drawLines(ctx, document?.lines || [], document?.points || [], viewport, sheet, colors, options);
  drawPoints(ctx, document?.points || [], viewport, colors, options);

  ctx.strokeStyle = colors.border;
  ctx.lineWidth = finite(options.borderWidth, 1.5);
  if (can(ctx, 'strokeRect')) ctx.strokeRect(left, top, paperWidth, paperHeight);
  if (can(ctx, 'restore')) ctx.restore();
}

/** Dibuja únicamente las divisiones de milímetro visibles. */
export function drawGrid(ctx, viewport, sheet, colors = COLORS) {
  const visible = viewport.getVisibleSheetRect();
  if (visible.maxX < visible.minX || visible.maxY < visible.minY) return;
  const minMmX = Math.max(0, Math.ceil(visible.minX * 10 - 1e-7));
  const maxMmX = Math.min(Math.floor(sheet.widthCm * 10 + 1e-7), Math.floor(visible.maxX * 10 + 1e-7));
  const minMmY = Math.max(0, Math.ceil(visible.minY * 10 - 1e-7));
  const maxMmY = Math.min(Math.floor(sheet.heightCm * 10 + 1e-7), Math.floor(visible.maxY * 10 + 1e-7));
  const bottom = viewport.documentToScreen({ x: 0, y: visible.minY }).y;
  const top = viewport.documentToScreen({ x: 0, y: visible.maxY }).y;
  const left = viewport.documentToScreen({ x: visible.minX, y: 0 }).x;
  const right = viewport.documentToScreen({ x: visible.maxX, y: 0 }).x;
  const strokeLevel = (major) => {
    ctx.strokeStyle = major ? colors.centimeter : colors.millimeter;
    ctx.lineWidth = major ? 1 : 0.6;
    if (can(ctx, 'beginPath')) ctx.beginPath();
    const step = major ? 10 : 1;
    const firstX = Math.ceil(minMmX / step) * step;
    const firstY = Math.ceil(minMmY / step) * step;
    for (let mm = firstX; mm <= maxMmX; mm += step) {
      if (!major && mm % 10 === 0) continue;
      const x = viewport.documentToScreen({ x: mm / 10, y: 0 }).x;
      if (can(ctx, 'moveTo')) ctx.moveTo(x, bottom);
      if (can(ctx, 'lineTo')) ctx.lineTo(x, top);
    }
    for (let mm = firstY; mm <= maxMmY; mm += step) {
      if (!major && mm % 10 === 0) continue;
      const y = viewport.documentToScreen({ x: 0, y: mm / 10 }).y;
      if (can(ctx, 'moveTo')) ctx.moveTo(left, y);
      if (can(ctx, 'lineTo')) ctx.lineTo(right, y);
    }
    if (can(ctx, 'stroke')) ctx.stroke();
  };
  // Las subdivisiones vuelven automáticamente al acercarse. Dibujarlas cuando
  // son subpíxel solo sobrecarga el frame y puede producir moiré.
  if (viewport.scalePxPerCm / 10 >= MIN_MINOR_SPACING_PX) strokeLevel(false);
  strokeLevel(true);
}

/**
 * Recorta una recta paramétrica infinita contra un rectángulo cerrado.
 * `direction` no necesita estar normalizada. Devuelve extremos en coordenadas
 * de documento o `null` si la recta es degenerada/no cruza el rectángulo.
 */
export function clipInfiniteLineToRect(origin, direction, rect) {
  const ox = Number(origin?.x);
  const oy = Number(origin?.y);
  const dx = Number(direction?.x);
  const dy = Number(direction?.y);
  const minX = Number(rect?.minX);
  const maxX = Number(rect?.maxX);
  const minY = Number(rect?.minY);
  const maxY = Number(rect?.maxY);
  if (![ox, oy, dx, dy, minX, maxX, minY, maxY].every(Number.isFinite)
      || minX > maxX || minY > maxY || (dx === 0 && dy === 0)) return null;

  let enter = -Infinity;
  let exit = Infinity;
  for (const [position, delta, lower, upper] of [
    [ox, dx, minX, maxX],
    [oy, dy, minY, maxY],
  ]) {
    if (Math.abs(delta) <= Number.EPSILON) {
      if (position < lower || position > upper) return null;
      continue;
    }
    const first = (lower - position) / delta;
    const second = (upper - position) / delta;
    enter = Math.max(enter, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
    if (enter > exit) return null;
  }
  return {
    from: { x: ox + enter * dx, y: oy + enter * dy },
    to: { x: ox + exit * dx, y: oy + exit * dy },
  };
}

function clippedTrace(line, byId, sheet) {
  const kind = line.kind || 'segment';
  if (kind === 'best-fit') {
    const equation = line.equation;
    if (equation?.axis === 'x') {
      const x = Number(equation.constant);
      return clipInfiniteLineToRect({ x, y: 0 }, { x: 0, y: 1 }, {
        minX: 0, minY: 0, maxX: sheet.widthCm, maxY: sheet.heightCm,
      });
    }
    if (equation?.axis === 'y') {
      const slope = Number(equation.slope);
      const intercept = Number(equation.intercept);
      return clipInfiniteLineToRect({ x: 0, y: intercept }, { x: 1, y: slope }, {
        minX: 0, minY: 0, maxX: sheet.widthCm, maxY: sheet.heightCm,
      });
    }
    return null;
  }

  const from = byId.get(line.from) || line.start || line.a;
  const to = byId.get(line.to) || line.end || line.b;
  if (!from || !to) return null;
  if (kind === 'segment') return { from, to };
  if (kind !== 'line') return null;
  return clipInfiniteLineToRect(from, { x: to.x - from.x, y: to.y - from.y }, {
    minX: 0, minY: 0, maxX: sheet.widthCm, maxY: sheet.heightCm,
  });
}

function drawLines(ctx, lines, points, viewport, sheet, colors, options) {
  const byId = new Map(points.map((point) => [point.id, point]));
  ctx.lineWidth = finite(options.lineWidth, 2);
  for (const line of lines) {
    const trace = clippedTrace(line, byId, sheet);
    if (!trace) continue;
    const kind = line.kind || 'segment';
    ctx.strokeStyle = kind === 'line'
      ? colors.line
      : kind === 'best-fit' ? colors.bestFit : colors.segment;
    const a = viewport.documentToScreen(trace.from);
    const b = viewport.documentToScreen(trace.to);
    if (can(ctx, 'beginPath')) ctx.beginPath();
    if (can(ctx, 'moveTo')) ctx.moveTo(a.x, a.y);
    if (can(ctx, 'lineTo')) ctx.lineTo(b.x, b.y);
    if (can(ctx, 'stroke')) ctx.stroke();
  }
}

function drawPoints(ctx, points, viewport, colors, options) {
  const radius = Math.max(1, finite(options.pointRadius, 6));
  const ringWidth = Math.max(1, finite(options.pointRingWidth, 2));
  for (const point of points) {
    if (!viewport.containsDocumentPoint(point, (radius + ringWidth) / viewport.scalePxPerCm)) continue;
    const p = viewport.documentToScreen(point);
    // El aro blanco separa el punto tanto de la cuadrícula como de las rectas.
    ctx.fillStyle = colors.pointRing;
    if (can(ctx, 'beginPath')) ctx.beginPath();
    if (can(ctx, 'arc')) ctx.arc(p.x, p.y, radius + ringWidth, 0, Math.PI * 2);
    if (can(ctx, 'fill')) ctx.fill();
    ctx.strokeStyle = colors.pointOutline;
    ctx.lineWidth = 1;
    if (can(ctx, 'stroke')) ctx.stroke();
    ctx.fillStyle = colors.point;
    if (can(ctx, 'beginPath')) ctx.beginPath();
    if (can(ctx, 'arc')) ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    if (can(ctx, 'fill')) ctx.fill();
    if (point.label && can(ctx, 'fillText')) {
      ctx.font = options.labelFont || '12px system-ui, sans-serif';
      ctx.fillText(String(point.label), p.x + radius + 3, p.y - radius - 2);
    }
  }
}

/** Renderizador con invalidación por requestAnimationFrame, sin bucle continuo. */
export function createRenderer({ canvas, viewport, requestFrame, dpr } = {}) {
  if (!canvas || !viewport) throw new TypeError('canvas y viewport son obligatorios');
  const raf = requestFrame || globalThis.requestAnimationFrame?.bind(globalThis)
    || ((callback) => setTimeout(() => callback(Date.now()), 0));
  let pending = false;
  let scene;
  const api = {
    render(document) {
      scene = document;
      const density = Math.max(1, finite(dpr, globalThis.devicePixelRatio || 1));
      const targetWidth = Math.max(1, Math.round(viewport.widthPx * density));
      const targetHeight = Math.max(1, Math.round(viewport.heightPx * density));
      const sizeChanged = canvas.width !== targetWidth || canvas.height !== targetHeight;
      const context = sizeChanged
        ? resizeCanvas(canvas, { widthPx: viewport.widthPx, heightPx: viewport.heightPx, dpr: density }).context
        : canvas.getContext('2d');
      if (context) renderScene(context, scene, viewport);
      pending = false;
    },
    invalidate(document = scene) {
      scene = document;
      if (pending) return;
      pending = true;
      raf(() => api.render(scene));
    },
    get pending() { return pending; },
  };
  return api;
}

export const render = renderScene;
export const renderSheet = renderScene;
export const draw = renderScene;
