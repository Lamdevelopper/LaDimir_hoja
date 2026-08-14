/** Versioned JSON and human-readable TXT persistence for the model. */
import { FORMAT, VERSION, cloneDocument, createDocument, validateDocument, ModelValidationError } from "./model.js";

const parseError = (message, path = "document") => { throw new ModelValidationError(message, path); };
const jsonString = (value, path) => {
  if (typeof value !== "string") parseError("se esperaba una cadena", path);
  return JSON.stringify(value);
};

/** Serialize a validated document to JSON. */
export function serializeJson(document, space = 2) {
  validateDocument(document);
  return JSON.stringify(cloneDocument(document), null, space);
}

/** Parse and validate JSON text (or an already parsed object). */
export function deserializeJson(input) {
  let value;
  try { value = typeof input === "string" ? JSON.parse(input) : input; }
  catch (error) { parseError(`JSON inválido: ${error.message}`); }
  if (!value || value.format !== FORMAT || value.version !== VERSION) {
    parseError(`se esperaba ${FORMAT} versión ${VERSION}`);
  }
  return cloneDocument(validateDocument(value));
}

function numberText(value) { return String(value); }

/** Serialize using tab-separated SHEET, POINT and LINE records. */
export function serializeTxt(document) {
  validateDocument(document);
  // TXT keeps the historical, human-readable header from ARCHITECTURE.md.
  const rows = [`LADIMIR_HOJA ${VERSION}`];
  rows.push(["SHEET", numberText(document.sheet.widthCm), numberText(document.sheet.heightCm), jsonString(document.sheet.name, "sheet.name")].join("\t"));
  for (const point of document.points) {
    rows.push(["POINT", point.id, numberText(point.x), numberText(point.y), jsonString(point.label, "point.label")].join("\t"));
  }
  for (const line of document.lines) rows.push(["LINE", line.id, line.from, line.to].join("\t"));
  return `${rows.join("\n")}\n`;
}

function parseJsonString(value, path) {
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed !== "string") parseError("se esperaba una cadena JSON", path);
    return parsed;
  } catch (error) {
    if (error instanceof ModelValidationError) throw error;
    parseError(`cadena JSON inválida: ${error.message}`, path);
  }
}

function finiteNumber(value, path) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) parseError("se esperaba un número", path);
  return parsed;
}

/** Parse TXT records, accepting LF/CRLF, blank lines and optional comments. */
export function deserializeTxt(input) {
  if (typeof input !== "string") parseError("se esperaba texto TXT");
  const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim() !== "" && !line.trim().startsWith("#"));
  if (lines.length === 0) parseError("archivo vacío");
  const header = lines.shift().trim().split(/\s+/);
  if (header.length !== 2 || !["LADIMIR_HOJA", FORMAT.toUpperCase()].includes(header[0].toUpperCase()) || Number(header[1]) !== VERSION) parseError(`cabecera inválida; se esperaba LADIMIR_HOJA ${VERSION}`);
  let sheet;
  const points = [];
  const records = [];
  for (const [index, raw] of lines.entries()) {
    const fields = raw.split("\t");
    const kind = fields[0]?.trim().toUpperCase();
    const path = `TXT línea ${index + 2}`;
    if (kind === "SHEET") {
      if (fields.length !== 4 || sheet) parseError("registro SHEET inválido o duplicado", path);
      sheet = { widthCm: finiteNumber(fields[1], `${path}.widthCm`), heightCm: finiteNumber(fields[2], `${path}.heightCm`), name: parseJsonString(fields[3], `${path}.name`) };
    } else if (kind === "POINT") {
      if (fields.length !== 5) parseError("registro POINT inválido", path);
      points.push({ id: fields[1], x: finiteNumber(fields[2], `${path}.x`), y: finiteNumber(fields[3], `${path}.y`), label: parseJsonString(fields[4], `${path}.label`) });
    } else if (kind === "LINE") {
      if (fields.length !== 4) parseError("registro LINE inválido", path);
      records.push({ id: fields[1], from: fields[2], to: fields[3] });
    } else parseError(`registro desconocido: ${fields[0]}`, path);
  }
  if (!sheet) parseError("falta registro SHEET");
  const document = createDocument(sheet);
  document.points = points;
  document.lines = records;
  return cloneDocument(validateDocument(document));
}

export const serializeJSON = serializeJson;
export const deserializeJSON = deserializeJson;
export const toJson = serializeJson;
export const fromJson = deserializeJson;
export const toTxt = serializeTxt;
export const fromTxt = deserializeTxt;
