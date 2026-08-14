import test from 'node:test';
import assert from 'node:assert/strict';
import { Viewport, MIN_ZOOM, MAX_ZOOM } from '../src/viewport.js';

test('convierte cm a pantalla y vuelve conservando origen inferior izquierdo', () => {
  const viewport = new Viewport({ sheetWidthCm: 20, sheetHeightCm: 10, widthPx: 400, heightPx: 200, pixelsPerCm: 10 });
  assert.deepEqual(viewport.documentToScreen({ x: 0, y: 0 }), { x: 0, y: 200 });
  assert.deepEqual(viewport.documentToScreen({ x: 20, y: 10 }), { x: 200, y: 100 });
  const original = { x: 3.25, y: 7.4 };
  const roundTrip = viewport.screenToDocument(viewport.documentToScreen(original));
  assert.ok(Math.abs(roundTrip.x - original.x) < 1e-10);
  assert.ok(Math.abs(roundTrip.y - original.y) < 1e-10);
});

test('paneo y zoom anclado preservan la coordenada bajo el cursor', () => {
  const viewport = new Viewport({ widthPx: 800, heightPx: 600, pixelsPerCm: 20 });
  viewport.panBy(45, -18);
  const anchor = { x: 350, y: 220 };
  const before = viewport.screenToDocument(anchor);
  viewport.zoomAt(2, anchor);
  const after = viewport.screenToDocument(anchor);
  assert.ok(Math.abs(after.x - before.x) < 1e-10);
  assert.ok(Math.abs(after.y - before.y) < 1e-10);
  viewport.zoomAt(0, anchor);
  assert.equal(viewport.zoom, 2);
  viewport.setZoom(999);
  assert.equal(viewport.zoom, MAX_ZOOM);
  viewport.setZoom(-2);
  assert.equal(viewport.zoom, MIN_ZOOM);
});

test('rectángulo visible y fitToSheet producen límites útiles', () => {
  const viewport = new Viewport({ sheetWidthCm: 21, sheetHeightCm: 29.7, widthPx: 420, heightPx: 594, pixelsPerCm: 10 });
  viewport.fitToSheet(20);
  const rect = viewport.getVisibleSheetRect();
  const bottomLeft = viewport.documentToScreen({ x: 0, y: 0 });
  const topRight = viewport.documentToScreen({ x: 21, y: 29.7 });
  assert.ok(rect.minX >= 0 && rect.minY >= 0);
  assert.ok(rect.maxX <= 21 && rect.maxY <= 29.7);
  assert.ok(bottomLeft.y <= viewport.heightPx && bottomLeft.y >= 0);
  assert.ok(topRight.y >= 0 && topRight.y <= viewport.heightPx);
  assert.ok(viewport.containsDocumentPoint({ x: 0, y: 0 }));
  assert.ok(!viewport.containsDocumentPoint({ x: 22, y: 0 }));
});
