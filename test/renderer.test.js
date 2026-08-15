import test from 'node:test';
import assert from 'node:assert/strict';
import { Viewport } from '../src/viewport.js';
import {
  clipInfiniteLineToRect, drawGrid, renderScene, createRenderer,
} from '../src/renderer.js';

function mockContext() {
  const calls = [];
  const ctx = {
    calls,
    save: () => calls.push(['save']), restore: () => calls.push(['restore']),
    clearRect: (...a) => calls.push(['clearRect', ...a]), fillRect: (...a) => calls.push(['fillRect', ...a]),
    strokeRect: (...a) => calls.push(['strokeRect', ...a]), rect: (...a) => calls.push(['rect', ...a]), clip: () => calls.push(['clip']),
    beginPath: () => calls.push(['beginPath']), moveTo: (...a) => calls.push(['moveTo', ...a]), lineTo: (...a) => calls.push(['lineTo', ...a]),
    stroke: () => calls.push(['stroke']), arc: (...a) => calls.push(['arc', ...a]), fill: () => calls.push(['fill']),
    fillText: (...a) => calls.push(['fillText', ...a]), setTransform: (...a) => calls.push(['setTransform', ...a]),
  };
  for (const property of ['fillStyle', 'strokeStyle', 'lineWidth', 'font']) {
    Object.defineProperty(ctx, property, {
      set: (value) => calls.push([property, value]),
      configurable: true,
    });
  }
  return ctx;
}

test('drawGrid dibuja milímetros y centímetros sólo en el viewport visible', () => {
  const viewport = new Viewport({ sheetWidthCm: 3, sheetHeightCm: 2, widthPx: 300, heightPx: 200, pixelsPerCm: 50 });
  const ctx = mockContext();
  drawGrid(ctx, viewport, { widthCm: 3, heightCm: 2 });
  const strokes = ctx.calls.filter(([name]) => name === 'stroke');
  assert.equal(strokes.length, 2);
  assert.ok(ctx.calls.filter(([name]) => name === 'lineTo').length >= 20);
});

test('drawGrid omite milímetros subpíxel en hojas grandes', () => {
  const viewport = new Viewport({ sheetWidthCm: 500, sheetHeightCm: 500, widthPx: 800, heightPx: 800 });
  viewport.fitToSheet(20);
  const ctx = mockContext();
  drawGrid(ctx, viewport, { widthCm: 500, heightCm: 500 });
  assert.equal(ctx.calls.filter(([name]) => name === 'stroke').length, 1);
  assert.ok(ctx.calls.filter(([name]) => name === 'lineTo').length <= 1002);
});

test('clipInfiniteLineToRect recorta rectas oblicuas, verticales y exteriores', () => {
  assert.deepEqual(
    clipInfiniteLineToRect({ x: 2, y: 2 }, { x: 1, y: 1 }, { minX: 0, minY: 0, maxX: 10, maxY: 5 }),
    { from: { x: 0, y: 0 }, to: { x: 5, y: 5 } },
  );
  assert.deepEqual(
    clipInfiniteLineToRect({ x: 4, y: 3 }, { x: 0, y: 1 }, { minX: 0, minY: 0, maxX: 10, maxY: 5 }),
    { from: { x: 4, y: 0 }, to: { x: 4, y: 5 } },
  );
  assert.equal(
    clipInfiniteLineToRect({ x: 12, y: 3 }, { x: 0, y: 1 }, { minX: 0, minY: 0, maxX: 10, maxY: 5 }),
    null,
  );
});

test('renderScene pinta papel blanco, borde, segmento heredado y puntos con aro', () => {
  const viewport = new Viewport({ sheetWidthCm: 10, sheetHeightCm: 10, widthPx: 400, heightPx: 400, pixelsPerCm: 20 });
  const ctx = mockContext();
  renderScene(ctx, {
    sheet: { widthCm: 10, heightCm: 10 },
    points: [{ id: 'a', x: 1, y: 1, label: 'A' }, { id: 'b', x: 5, y: 5 }],
    lines: [{ id: 'l', from: 'a', to: 'b' }],
  }, viewport);
  assert.ok(ctx.calls.some(([name]) => name === 'fillRect'));
  assert.ok(ctx.calls.some(([name, value]) => name === 'fillStyle' && value === '#ffffff'));
  assert.ok(ctx.calls.some(([name]) => name === 'strokeRect'));
  assert.equal(ctx.calls.filter(([name]) => name === 'arc').length, 4);
  assert.deepEqual(ctx.calls.filter(([name]) => name === 'arc').map((call) => call[3]), [8, 6, 8, 6]);
  assert.ok(ctx.calls.some(([name]) => name === 'lineTo'));
});

test('renderScene extiende kind line hasta los bordes de la hoja', () => {
  const viewport = new Viewport({ sheetWidthCm: 10, sheetHeightCm: 5, widthPx: 200, heightPx: 100, pixelsPerCm: 10 });
  const ctx = mockContext();
  renderScene(ctx, {
    sheet: { widthCm: 10, heightCm: 5 },
    points: [{ id: 'a', x: 2, y: 1 }, { id: 'b', x: 4, y: 2 }],
    lines: [{ id: 'l', kind: 'line', from: 'a', to: 'b' }],
  }, viewport);
  assert.ok(ctx.calls.some(([name, x, y]) => name === 'moveTo' && x === 0 && y === 100));
  assert.ok(ctx.calls.some(([name, x, y]) => name === 'lineTo' && x === 100 && y === 50));
});

test('renderScene recorta ajustes lineales normales y verticales', () => {
  const viewport = new Viewport({ sheetWidthCm: 10, sheetHeightCm: 5, widthPx: 200, heightPx: 100, pixelsPerCm: 10 });
  const ctx = mockContext();
  renderScene(ctx, {
    sheet: { widthCm: 10, heightCm: 5 }, points: [],
    lines: [
      { id: 'fit-y', kind: 'best-fit', equation: { axis: 'y', slope: 0.5, intercept: 0 } },
      { id: 'fit-x', kind: 'best-fit', equation: { axis: 'x', constant: 3 } },
    ],
  }, viewport);
  assert.ok(ctx.calls.some(([name, x, y]) => name === 'lineTo' && x === 100 && y === 50));
  assert.ok(ctx.calls.some(([name, x, y]) => name === 'moveTo' && x === 30 && y === 100));
  assert.ok(ctx.calls.some(([name, x, y]) => name === 'lineTo' && x === 30 && y === 50));
});

test('renderScene distingue por color segmentos, rectas y ajustes', () => {
  const viewport = new Viewport({ sheetWidthCm: 10, sheetHeightCm: 5, widthPx: 200, heightPx: 100, pixelsPerCm: 10 });
  const ctx = mockContext();
  renderScene(ctx, {
    sheet: { widthCm: 10, heightCm: 5 },
    points: [{ id: 'a', x: 1, y: 1 }, { id: 'b', x: 4, y: 2 }],
    lines: [
      { id: 'segment', from: 'a', to: 'b' },
      { id: 'line', kind: 'line', from: 'a', to: 'b' },
      { id: 'fit', kind: 'best-fit', pointIds: ['a', 'b'], equation: { axis: 'y', slope: 0.5, intercept: 0 } },
    ],
  }, viewport);
  const traceColors = ctx.calls
    .filter(([name, value]) => name === 'strokeStyle' && ['#13795b', '#1f5aa6', '#a33a75'].includes(value))
    .map(([, value]) => value);
  assert.deepEqual(traceColors, ['#13795b', '#1f5aa6', '#a33a75']);
});

test('createRenderer agrupa invalidaciones en un requestAnimationFrame', () => {
  const ctx = mockContext();
  const canvas = { width: 0, height: 0, clientWidth: 200, clientHeight: 100, style: {}, getContext: () => ctx };
  const viewport = new Viewport({ widthPx: 200, heightPx: 100, sheetWidthCm: 10, sheetHeightCm: 5 });
  const queue = [];
  const renderer = createRenderer({ canvas, viewport, dpr: 2, requestFrame: (callback) => queue.push(callback) });
  renderer.invalidate({ sheet: { widthCm: 10, heightCm: 5 }, points: [], lines: [] });
  renderer.invalidate({ sheet: { widthCm: 10, heightCm: 5 }, points: [], lines: [] });
  assert.equal(queue.length, 1);
  queue.shift()();
  assert.equal(renderer.pending, false);
  assert.equal(canvas.width, 400);
  assert.ok(ctx.calls.some(([name]) => name === 'setTransform'));
  renderer.invalidate({ sheet: { widthCm: 10, heightCm: 5 }, points: [], lines: [] });
  queue.shift()();
  assert.equal(ctx.calls.filter(([name]) => name === 'setTransform').length, 1);
});
