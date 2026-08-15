/** Canonical document model for the LaDimir Hoja editor. */

export const FORMAT = "ladimir-hoja";
export const VERSION = 1;
export const MIN_SHEET_SIZE_CM = 1;
export const MAX_SHEET_SIZE_CM = 500;

/** Error raised when a document or an operation violates the model contract. */
export class ModelValidationError extends Error {
  constructor(message, path = "document") {
    super(`${path}: ${message}`);
    this.name = "ModelValidationError";
    this.path = path;
  }
}

const fail = (message, path) => { throw new ModelValidationError(message, path); };
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

function size(value, path) {
  if (!isNumber(value) || value < MIN_SHEET_SIZE_CM || value > MAX_SHEET_SIZE_CM) {
    fail(`debe ser un número entre ${MIN_SHEET_SIZE_CM} y ${MAX_SHEET_SIZE_CM} cm`, path);
  }
  return value;
}

function coordinate(value, max, path) {
  if (!isNumber(value) || value < 0 || value > max) fail(`debe estar entre 0 y ${max} cm`, path);
  return value;
}

function id(value, path) {
  if (typeof value !== "string" || value.trim() === "") fail("debe ser una cadena no vacía", path);
  return value;
}

const LINE_KINDS = new Set(["segment", "line", "best-fit"]);
const effectiveKind = (line) => line.kind ?? "segment";

function validateEquation(equation, path) {
  if (!isObject(equation)) fail("debe ser un objeto", path);
  if (equation.axis === "y") {
    if (!isNumber(equation.slope) || !isNumber(equation.intercept)) fail("requiere slope e intercept numéricos", path);
  } else if (equation.axis === "x") {
    if (!isNumber(equation.constant)) fail("requiere constant numérico", path);
  } else fail('axis debe ser "x" o "y"', `${path}.axis`);
}

/** Validate and return the same canonical document. */
export function validateDocument(document) {
  if (!isObject(document)) fail("debe ser un objeto");
  if (document.format !== FORMAT) fail(`format debe ser ${FORMAT}`, "format");
  if (document.version !== VERSION) fail(`version no soportada (${document.version})`, "version");
  if (!isObject(document.sheet)) fail("debe ser un objeto", "sheet");
  size(document.sheet.widthCm, "sheet.widthCm");
  size(document.sheet.heightCm, "sheet.heightCm");
  if (typeof document.sheet.name !== "string") fail("debe ser una cadena", "sheet.name");
  if (!Array.isArray(document.points)) fail("debe ser un arreglo", "points");
  if (!Array.isArray(document.lines)) fail("debe ser un arreglo", "lines");

  const pointIds = new Set();
  document.points.forEach((point, index) => {
    const path = `points[${index}]`;
    if (!isObject(point)) fail("debe ser un objeto", path);
    id(point.id, `${path}.id`);
    if (pointIds.has(point.id)) fail("id duplicado", `${path}.id`);
    pointIds.add(point.id);
    coordinate(point.x, document.sheet.widthCm, `${path}.x`);
    coordinate(point.y, document.sheet.heightCm, `${path}.y`);
    if (typeof point.label !== "string") fail("debe ser una cadena", `${path}.label`);
  });

  const lineIds = new Set();
  document.lines.forEach((line, index) => {
    const path = `lines[${index}]`;
    if (!isObject(line)) fail("debe ser un objeto", path);
    id(line.id, `${path}.id`);
    if (lineIds.has(line.id)) fail("id duplicado", `${path}.id`);
    lineIds.add(line.id);
    const kind = effectiveKind(line);
    if (!LINE_KINDS.has(kind)) fail("kind debe ser segment, line o best-fit", `${path}.kind`);
    if (kind === "best-fit") {
      if (!Array.isArray(line.pointIds) || line.pointIds.length < 2) fail("pointIds requiere al menos dos puntos", `${path}.pointIds`);
      const refs = new Set();
      line.pointIds.forEach((pointId, pointIndex) => {
        id(pointId, `${path}.pointIds[${pointIndex}]`);
        if (refs.has(pointId)) fail("pointIds no puede repetir puntos", `${path}.pointIds`);
        refs.add(pointId);
        if (!pointIds.has(pointId)) fail("referencia a punto inexistente", `${path}.pointIds[${pointIndex}]`);
      });
      validateEquation(line.equation, `${path}.equation`);
    } else {
      id(line.from, `${path}.from`);
      id(line.to, `${path}.to`);
      if (!pointIds.has(line.from) || !pointIds.has(line.to)) fail("referencia a punto inexistente", path);
      if (line.from === line.to) fail("from y to deben ser puntos distintos", path);
    }
  });
  return document;
}

/** Create an empty sheet. Accepts either an options object or width, height, name. */
export function createDocument(optionsOrWidth, heightCm, name = "Mi hoja") {
  const options = isObject(optionsOrWidth)
    ? optionsOrWidth
    : { widthCm: optionsOrWidth, heightCm, name };
  const document = {
    format: FORMAT,
    version: VERSION,
    sheet: {
      widthCm: options.widthCm,
      heightCm: options.heightCm,
      name: options.name ?? "Mi hoja",
    },
    points: [],
    lines: [],
  };
  return validateDocument(document);
}

/** Backwards-friendly name for callers that call the document a sheet. */
export const createSheet = createDocument;

/** Return a detached, validated copy suitable for state history or persistence. */
export function cloneDocument(document) {
  validateDocument(document);
  return {
    format: document.format,
    version: document.version,
    sheet: { ...document.sheet },
    points: document.points.map((point) => ({ ...point })),
    lines: document.lines.map((line) => ({
      ...line,
      ...(line.kind ? {} : { kind: "segment" }),
      ...(line.pointIds ? { pointIds: [...line.pointIds] } : {}),
      ...(line.equation ? { equation: { ...line.equation } } : {}),
    })),
  };
}

function nextId(items, prefix) {
  const used = new Set(items.map((item) => item.id));
  let n = items.length + 1;
  while (used.has(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

/** Add a point in centimetres. The document is mutated and the new point returned. */
export function addPoint(document, pointOrX, y, label = "", explicitId) {
  validateDocument(document);
  const point = isObject(pointOrX)
    ? pointOrX
    : { x: pointOrX, y, label, id: explicitId };
  const item = { id: point.id ?? nextId(document.points, "p"), x: point.x, y: point.y, label: point.label ?? "" };
  id(item.id, "point.id");
  if (document.points.some((existing) => existing.id === item.id)) fail("id duplicado", "point.id");
  coordinate(item.x, document.sheet.widthCm, "point.x");
  coordinate(item.y, document.sheet.heightCm, "point.y");
  if (typeof item.label !== "string") fail("debe ser una cadena", "point.label");
  document.points.push(item);
  return item;
}

/** Remove a point and its dependent lines, returning the removed point or null. */
export function removePoint(document, pointId) {
  validateDocument(document);
  const index = document.points.findIndex((point) => point.id === pointId);
  if (index < 0) return null;
  const [removed] = document.points.splice(index, 1);
  document.lines = document.lines.filter((line) => line.from !== pointId && line.to !== pointId);
  return removed;
}

/** Add a segment between two existing points. The document is mutated. */
export function addLine(document, lineOrFrom, to, explicitId) {
  validateDocument(document);
  const line = isObject(lineOrFrom) ? lineOrFrom : { from: lineOrFrom, to, id: explicitId };
  const item = { id: line.id ?? nextId(document.lines, "l"), kind: line.kind ?? "line", from: line.from, to: line.to };
  if (item.kind === "best-fit") return addBestFitLine(document, { id: item.id });
  if (!LINE_KINDS.has(item.kind)) fail("kind debe ser segment, line o best-fit", "line.kind");
  id(item.id, "line.id");
  if (document.lines.some((existing) => existing.id === item.id)) fail("id duplicado", "line.id");
  if (!document.points.some((point) => point.id === item.from) || !document.points.some((point) => point.id === item.to)) {
    fail("from y to deben referenciar puntos existentes", "line");
  }
  if (item.from === item.to) fail("from y to deben ser puntos distintos", "line");
  if (document.lines.some((existing) =>
    (existing.from === item.from && existing.to === item.to) ||
    (existing.from === item.to && existing.to === item.from))) fail("segmento duplicado", "line");
  document.lines.push(item);
  return item;
}

/** Calculate ordinary least-squares y=m*x+b, or x=constant for vertical points. */
export function calculateBestFit(points) {
  if (!Array.isArray(points) || points.length < 2) fail("se requieren al menos dos puntos", "points");
  points.forEach((point, index) => {
    if (!isObject(point) || !isNumber(point.x) || !isNumber(point.y)) fail("cada punto requiere x e y numéricos", `points[${index}]`);
  });
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const denominator = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  if (denominator === 0) return { axis: "x", constant: meanX };
  const slope = points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0) / denominator;
  return { axis: "y", slope, intercept: meanY - slope * meanX };
}

/** Add a deterministic best-fit line over all current points (or supplied points). */
export function addBestFitLine(document, options = {}) {
  validateDocument(document);
  const points = options.points ?? document.points;
  if (!Array.isArray(points) || points.length < 2) fail("se requieren al menos dos puntos", "points");
  const pointIds = points.map((point) => point.id);
  const known = new Set(document.points.map((point) => point.id));
  if (pointIds.some((pointId) => !known.has(pointId))) fail("pointIds debe referenciar puntos de la hoja", "pointIds");
  const line = {
    id: options.id ?? nextId(document.lines, "l"),
    kind: "best-fit",
    pointIds: [...pointIds],
    equation: calculateBestFit(points),
  };
  id(line.id, "line.id");
  if (document.lines.some((existing) => existing.id === line.id)) fail("id duplicado", "line.id");
  document.lines.push(line);
  return line;
}

/** Remove a segment by id, returning it or null. */
export function removeLine(document, lineId) {
  validateDocument(document);
  const index = document.lines.findIndex((line) => line.id === lineId);
  if (index < 0) return null;
  return document.lines.splice(index, 1)[0];
}

export const insertPoint = addPoint;
export const insertLine = addLine;
