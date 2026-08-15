import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SHEET_SIZE_CM, addBestFitLine, addLine, addPoint, calculateBestFit, cloneDocument, createDocument,
  removePoint, validateDocument, ModelValidationError,
} from "../src/model.js";

test("crea hojas con límites válidos y rechaza tamaños inválidos", () => {
  const doc = createDocument({ widthCm: 21, heightCm: 29.7, name: "Prueba" });
  assert.equal(doc.sheet.name, "Prueba");
  assert.doesNotThrow(() => createDocument(MAX_SHEET_SIZE_CM, MAX_SHEET_SIZE_CM));
  assert.throws(() => createDocument(0, 20), ModelValidationError);
  assert.throws(() => createDocument(501, 20), /entre 1 y 500/);
});

test("puntos generan IDs, conservan etiquetas y respetan coordenadas", () => {
  const doc = createDocument(10, 10);
  const first = addPoint(doc, { x: 2, y: 3, label: "A" });
  const second = addPoint(doc, 10, 0, "B");
  assert.deepEqual(first, { id: "p1", x: 2, y: 3, label: "A" });
  assert.equal(second.id, "p2");
  assert.throws(() => addPoint(doc, { x: 10.01, y: 1 }), /point.x/);
  assert.throws(() => addPoint(doc, { x: 1, y: 1, id: "p1" }), /duplicado/);
});

test("rectas requieren dos puntos distintos y se eliminan en cascada", () => {
  const doc = createDocument(10, 10);
  const a = addPoint(doc, 1, 1);
  const b = addPoint(doc, 8, 9);
  const line = addLine(doc, { from: a.id, to: b.id });
  assert.equal(line.id, "l1");
  assert.throws(() => addLine(doc, a.id, "missing"), /existentes/);
  assert.throws(() => addLine(doc, a.id, a.id), /distintos/);
  assert.throws(() => addLine(doc, b.id, a.id), /duplicado/);
  removePoint(doc, a.id);
  assert.equal(doc.points.length, 1);
  assert.equal(doc.lines.length, 0);
  assert.doesNotThrow(() => validateDocument(doc));
});

test("cloneDocument no comparte arreglos ni objetos internos", () => {
  const original = createDocument(2, 2);
  addPoint(original, 1, 1, "A");
  const copy = cloneDocument(original);
  copy.points[0].label = "B";
  assert.equal(original.points[0].label, "A");
});

test("addLine crea rectas line y acepta trazos antiguos como segment", () => {
  const doc = createDocument(10, 10);
  const a = addPoint(doc, 1, 1);
  const b = addPoint(doc, 8, 9);
  assert.equal(addLine(doc, a.id, b.id).kind, "line");
  const old = { ...doc, lines: [{ id: "old", from: a.id, to: b.id }] };
  assert.doesNotThrow(() => validateDocument(old));
  assert.equal(cloneDocument(old).lines[0].kind, "segment");
});

test("OLS calcula pendiente/intercepto y residuos verticales balanceados", () => {
  const points = [{ id: "a", x: 0, y: 1 }, { id: "b", x: 1, y: 3 }, { id: "c", x: 2, y: 4 }];
  const equation = calculateBestFit(points);
  assert.equal(equation.axis, "y");
  assert.ok(Math.abs(equation.slope - 1.5) < 1e-12);
  assert.ok(Math.abs(equation.intercept - (7 / 6)) < 1e-12);
  const residuals = points.map((point) => point.y - (equation.slope * point.x + equation.intercept));
  assert.ok(Math.abs(residuals.reduce((sum, value) => sum + value, 0)) < 1e-12);
});

test("best-fit vertical usa x constante y guarda IDs estables", () => {
  const doc = createDocument(10, 10);
  addPoint(doc, { id: "a", x: 4, y: 1 });
  addPoint(doc, { id: "b", x: 4, y: 8 });
  const line = addBestFitLine(doc);
  assert.deepEqual(line, { id: "l1", kind: "best-fit", pointIds: ["a", "b"], equation: { axis: "x", constant: 4 } });
  assert.throws(() => calculateBestFit([{ x: 1, y: 2 }]), /al menos dos/);
});
