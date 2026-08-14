import test from 'node:test';
import assert from 'node:assert/strict';
import { Viewport } from '../src/viewport.js';
import { drawGrid, renderScene, createRenderer } from '../src/renderer.js';

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

test('renderScene pinta papel, borde, segmentos y puntos', () => {
  const viewport = new Viewport({ sheetWidthCm: 10, sheetHeightCm: 10, widthPx: 400, heightPx: 400, pixelsPerCm: 20 });
  const ctx = mockContext();
  renderScene(ctx, {
    sheet: { widthCm: 10, heightCm: 10 },
    points: [{ id: 'a', x: 1, y: 1, label: 'A' }, { id: 'b', x: 5, y: 5 }],
    lines: [{ id: 'l', from: 'a', to: 'b' }],
  }, viewport);
  assert.ok(ctx.calls.some(([name]) => name === 'fillRect'));
  assert.ok(ctx.calls.some(([name]) => name === 'strokeRect'));
  assert.equal(ctx.calls.filter(([name]) => name === 'arc').length, 2);
  assert.ok(ctx.calls.some(([name]) => name === 'lineTo'));
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
