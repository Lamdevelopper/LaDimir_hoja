import test from "node:test";
import assert from "node:assert/strict";
import { addBestFitLine, addLine, addPoint, createDocument } from "../src/model.js";
import {
  deserializeJson, deserializeTxt, serializeJson, serializeTxt,
} from "../src/serialization.js";

function sample() {
  const doc = createDocument({ widthCm: 21, heightCm: 29.7, name: "Hoja\tñ" });
  const a = addPoint(doc, { x: 2, y: 3, label: "A\tuno" });
  const b = addPoint(doc, { x: 20, y: 29, label: "B\n dos" });
  addLine(doc, a.id, b.id);
  return doc;
}

test("JSON hace round-trip sin perder datos", () => {
  const original = sample();
  const text = serializeJson(original);
  assert.equal(deserializeJson(text).sheet.name, original.sheet.name);
  assert.deepEqual(deserializeJson(text), original);
  assert.throws(() => deserializeJson("{bad"), /JSON inválido/);
  assert.throws(() => deserializeJson('{"format":"otro","version":1}'), /se esperaba/);
});

test("TXT usa campos seguros y hace round-trip con saltos/tabuladores", () => {
  const original = sample();
  const text = serializeTxt(original);
  assert.match(text, /^LADIMIR_HOJA 1/m);
  assert.deepEqual(deserializeTxt(text), original);
  assert.deepEqual(deserializeTxt(text.replaceAll("\n", "\r\n")), original);
  assert.throws(() => deserializeTxt("LADIMIR_HOJA 1\nSHEET\t0\t2\t\"x\""), /entre 1 y 500/);
  assert.throws(() => deserializeTxt("LADIMIR_HOJA 1\nPOINT\tp1\t0\t0\t\"x\""), /falta registro SHEET/);
});

test("JSON y TXT conservan best-fit y TXT acepta LINE legado de cuatro campos", () => {
  const doc = createDocument(10, 10);
  const a = addPoint(doc, { id: "a", x: 1, y: 2 });
  const b = addPoint(doc, { id: "b", x: 2, y: 4 });
  addLine(doc, a.id, b.id, "explicit");
  addBestFitLine(doc);
  assert.deepEqual(deserializeJson(serializeJson(doc)), doc);
  assert.deepEqual(deserializeTxt(serializeTxt(doc)), doc);
  const legacy = `LADIMIR_HOJA 1\nSHEET\t10\t10\t"Legacy"\nPOINT\ta\t1\t2\t""\nPOINT\tb\t2\t4\t""\nLINE\told\ta\tb\n`;
  assert.equal(deserializeTxt(legacy).lines[0].kind, "segment");
  const legacyJson = JSON.stringify({ format: "ladimir-hoja", version: 1, sheet: { widthCm: 10, heightCm: 10, name: "Legacy" }, points: [{ id: "a", x: 1, y: 2, label: "" }, { id: "b", x: 2, y: 4, label: "" }], lines: [{ id: "old", from: "a", to: "b" }] });
  assert.equal(deserializeJson(legacyJson).lines[0].kind, "segment");
});
