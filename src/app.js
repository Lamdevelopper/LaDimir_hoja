/* LaDimir Hoja: capa de integración DOM. Los módulos de dominio se mantienen
 * independientes; aquí solo se traducen eventos, formularios y archivos. */
import * as Model from './model.js';
import * as Serialization from './serialization.js';
import * as ViewportModule from './viewport.js';
import * as Renderer from './renderer.js';

const $ = (id) => document.getElementById(id);
const canvas = $('sheet-canvas');
const ctx = canvas.getContext('2d');
const state = { document: null, viewport: null, tool: 'pan', pointer: null, lineSelection: [], dirty: false, renderQueued: false, spaceDown: false };

function sheetOf(doc) { return doc?.sheet ?? doc ?? {}; }
function pointsOf(doc) { return Array.isArray(doc?.points) ? doc.points : []; }
function linesOf(doc) { return Array.isArray(doc?.lines) ? doc.lines : []; }
function sizeOf(doc) { const s = sheetOf(doc); return { widthCm: Number(s.widthCm), heightCm: Number(s.heightCm) }; }

function createDocument(values) {
  const fn = Model.createDocument ?? Model.createSheet ?? Model.newDocument;
  if (fn) return fn(values);
  return { format: 'ladimir-hoja', version: 1, sheet: { ...values }, points: [], lines: [] };
}

function callMutation(names, args) {
  for (const name of names) {
    if (typeof Model[name] === 'function') {
      const result = Model[name](...args);
      return result ?? state.document;
    }
  }
  return null;
}

function replaceDocument(next) {
  if (next && typeof next === 'object') state.document = next;
  state.dirty = true;
  updateInfo();
  queueRender();
}

function makeViewport() {
  const { widthCm, heightCm } = sizeOf(state.document);
  const Ctor = ViewportModule.Viewport ?? ViewportModule.default;
  let viewport = null;
  if (typeof Ctor === 'function') {
    try { viewport = new Ctor({ widthCm, heightCm, sheetWidthCm: widthCm, sheetHeightCm: heightCm, widthPx: canvas.clientWidth, heightPx: canvas.clientHeight, canvas }); } catch { try { viewport = new Ctor(widthCm, heightCm); } catch { /* fallback abajo */ } }
  }
  if (!viewport && typeof ViewportModule.createViewport === 'function') {
    viewport = ViewportModule.createViewport({ widthCm, heightCm, canvas });
  }
  if (viewport) {
    // Una hoja nueva se presenta completa; desde ahí el usuario conserva libertad
    // para acercarse y desplazarse como en una calculadora gráfica.
    viewport.fitToSheet?.(24);
    return viewport;
  }

  // Fallback mínimo: 40 px/cm, origen inferior izquierdo y zoom limitado.
  const fallback = { scale: 40, offsetX: 30, offsetY: 30, widthCm, heightCm };
  fallback.resize = () => {};
  fallback.documentToScreen = ({ x, y }) => ({ x: fallback.offsetX + x * fallback.scale, y: canvas.height - fallback.offsetY - y * fallback.scale });
  fallback.screenToDocument = ({ x, y }) => ({ x: (x - fallback.offsetX) / fallback.scale, y: (canvas.height - fallback.offsetY - y) / fallback.scale });
  fallback.panBy = (dx, dy) => { fallback.offsetX += dx; fallback.offsetY -= dy; };
  fallback.zoomAt = (factor, point) => {
    const before = fallback.screenToDocument(point); fallback.scale = Math.max(4, Math.min(240, fallback.scale * factor));
    const after = fallback.screenToDocument(point); fallback.offsetX += (after.x - before.x) * fallback.scale; fallback.offsetY += (after.y - before.y) * fallback.scale;
  };
  return fallback;
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * ratio)); canvas.height = Math.max(1, Math.round(rect.height * ratio));
  // El renderer trabaja en píxeles CSS; el escalado evita líneas borrosas en HiDPI.
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  if (state.viewport?.resize) state.viewport.resize(rect.width, rect.height, ratio);
  else if (state.viewport?.setSize) state.viewport.setSize(rect.width, rect.height);
  queueRender();
}

function screenPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function toDocument(screen) {
  if (state.viewport?.screenToDocument) {
    try { return state.viewport.screenToDocument(screen); } catch { /* adapter legacy */ }
  }
  return screen;
}

function toScreen(point) {
  if (state.viewport?.documentToScreen) {
    try { return state.viewport.documentToScreen(point); } catch { /* adapter legacy */ }
  }
  return point;
}

function renderFallback() {
  const rect = canvas.getBoundingClientRect(); const w = rect.width; const h = rect.height;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#f5b46b'; ctx.fillRect(0, 0, w, h);
  const scale = state.viewport?.scale ?? 40; const origin = toScreen({ x: 0, y: 0 });
  const { widthCm, heightCm } = sizeOf(state.document);
  const left = Math.max(0, Math.floor((0 - origin.x) / scale) - 1), right = Math.min(widthCm * 10, Math.ceil((w - origin.x) / scale * 10) + 1);
  const bottom = Math.max(0, Math.floor((0 - (h - origin.y)) / scale * 10) - 1), top = Math.min(heightCm * 10, Math.ceil((origin.y) / scale * 10) + 1);
  ctx.lineWidth = 1; for (let i = left; i <= right; i += 1) { const x = toScreen({ x: i / 10, y: 0 }).x; ctx.strokeStyle = i % 10 === 0 ? 'rgba(128,62,22,.34)' : 'rgba(128,62,22,.13)'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let i = bottom; i <= top; i += 1) { const y = toScreen({ x: 0, y: i / 10 }).y; ctx.strokeStyle = i % 10 === 0 ? 'rgba(128,62,22,.34)' : 'rgba(128,62,22,.13)'; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  const byId = new Map(pointsOf(state.document).map((p) => [p.id, p]));
  ctx.lineWidth = 2; ctx.strokeStyle = '#5e2a19'; for (const line of linesOf(state.document)) { const a = byId.get(line.from); const b = byId.get(line.to); if (!a || !b) continue; const pa = toScreen(a); const pb = toScreen(b); ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke(); }
  for (const point of pointsOf(state.document)) { const p = toScreen(point); ctx.fillStyle = '#8e2d19'; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill(); if (point.label) { ctx.fillStyle = '#3b2417'; ctx.font = '12px system-ui'; ctx.fillText(point.label, p.x + 6, p.y - 6); } }
  ctx.restore();
}

function queueRender() {
  if (state.renderQueued) return; state.renderQueued = true;
  requestAnimationFrame(() => { state.renderQueued = false; const rect = canvas.getBoundingClientRect(); try {
    const fn = Renderer.renderScene ?? Renderer.render ?? Renderer.renderSheet ?? Renderer.draw;
    if (fn) fn(ctx, state.document, state.viewport, { width: rect.width, height: rect.height }); else renderFallback();
  } catch { renderFallback(); } });
}

function setStatus(message, isError = false) { const el = $('status'); el.textContent = message; el.dataset.error = isError ? 'true' : 'false'; }
function updateInfo() {
  const { widthCm, heightCm } = sizeOf(state.document); $('sheet-name').textContent = sheetOf(state.document).name || 'Sin nombre'; $('sheet-size').textContent = Number.isFinite(widthCm) ? `${widthCm} × ${heightCm} cm` : '—'; $('object-count').textContent = `${pointsOf(state.document).length} puntos · ${linesOf(state.document).length} rectas`; }
function updateCoordinates(screen) { const p = toDocument(screen); const { widthCm, heightCm } = sizeOf(state.document); const x = Math.max(0, Math.min(widthCm, p.x)); const y = Math.max(0, Math.min(heightCm, p.y)); $('coordinates').textContent = `X: ${x.toFixed(1)} cm · Y: ${y.toFixed(1)} cm`; }

function activateTool(tool) { state.tool = tool; document.querySelectorAll('.tool-button').forEach((button) => { const active = button.dataset.tool === tool; button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active)); }); canvas.classList.toggle('is-drawing', tool !== 'pan'); if (tool !== 'line') { state.lineSelection = []; $('cancel-line').hidden = true; $('line-help').textContent = 'Activa Recta y selecciona dos puntos.'; } }

function snap(value) { return $('snap-mm').checked ? Math.round(value * 10) / 10 : value; }
function addPointAt(position, label = '') {
  const { widthCm, heightCm } = sizeOf(state.document); const x = snap(position.x); const y = snap(position.y); if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > widthCm || y > heightCm) { setStatus('El punto debe quedar dentro de la hoja.', true); return null; }
  const id = `p${Date.now().toString(36)}${pointsOf(state.document).length}`; const point = { id, x, y, ...(label ? { label: label.trim() } : {}) }; const next = callMutation(['addPoint', 'insertPoint'], [state.document, point]); if (next?.points) state.document = next; else if (!next && !pointsOf(state.document).some((item) => item.id === id)) state.document.points.push(point); replaceDocument(state.document); setStatus(`Punto colocado en (${x.toFixed(1)}, ${y.toFixed(1)}) cm.`); return point;
}

function nearestPoint(position) { let best = null; let distance = Infinity; for (const p of pointsOf(state.document)) { const q = toScreen(p); const d = Math.hypot(q.x - position.x, q.y - position.y); if (d < distance) { distance = d; best = p; } } return distance <= 14 ? best : null; }
function selectLinePoint(point) { if (!point) { setStatus('Haz clic cerca de un punto existente.', true); return; } if (state.lineSelection.some((p) => p.id === point.id)) return; state.lineSelection.push(point); $('line-help').textContent = `Seleccionados ${state.lineSelection.length}/2 puntos.`; $('cancel-line').hidden = false; if (state.lineSelection.length === 2) { const [a, b] = state.lineSelection; const id = `l${Date.now().toString(36)}${linesOf(state.document).length}`; try { const next = callMutation(['addLine', 'insertLine'], [state.document, { id, from: a.id, to: b.id }]); if (next?.points) state.document = next; else if (!next && !linesOf(state.document).some((item) => item.id === id)) state.document.lines.push({ id, from: a.id, to: b.id }); replaceDocument(state.document); setStatus('Recta creada entre los dos puntos.'); } catch (error) { setStatus(`No se pudo crear la recta: ${error.message}`, true); } state.lineSelection = []; $('cancel-line').hidden = true; $('line-help').textContent = 'Activa Recta y selecciona dos puntos.'; } }

function saveFile(kind) { if (!state.document) return; const fn = kind === 'json' ? (Serialization.toJSON ?? Serialization.serializeJSON ?? Serialization.serializeJson ?? Serialization.toJson ?? Serialization.stringifyJSON) : (Serialization.toTXT ?? Serialization.toTxt ?? Serialization.serializeTXT ?? Serialization.serializeTxt ?? Serialization.stringifyTXT); let data; try { data = fn ? fn(state.document) : kind === 'json' ? JSON.stringify(state.document, null, 2) : `LADIMIR_HOJA 1\nSHEET\t${JSON.stringify(sheetOf(state.document))}`; } catch (error) { setStatus(`No se pudo guardar: ${error.message}`, true); return; } if (typeof data !== 'string') data = JSON.stringify(data); const blob = new Blob([data], { type: kind === 'json' ? 'application/json' : 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${(sheetOf(state.document).name || 'hoja').replace(/[^\p{L}\p{N}_-]+/gu, '_')}.${kind}`; a.click(); URL.revokeObjectURL(a.href); state.dirty = false; setStatus(`Hoja guardada como ${kind.toUpperCase()}.`); }

async function openFile(file) { try { const text = await file.text(); const isJson = file.name.toLowerCase().endsWith('.json') || text.trim().startsWith('{'); const fn = isJson ? (Serialization.fromJSON ?? Serialization.fromJson ?? Serialization.parseJSON ?? Serialization.deserializeJSON ?? Serialization.deserializeJson) : (Serialization.fromTXT ?? Serialization.fromTxt ?? Serialization.parseTXT ?? Serialization.parseTxt ?? Serialization.deserializeTXT ?? Serialization.deserializeTxt); const doc = fn ? fn(text) : JSON.parse(text); if (!doc?.sheet || !Array.isArray(doc.points) || !Array.isArray(doc.lines)) throw new Error('El archivo no tiene el formato de LaDimir Hoja.'); state.document = doc; state.viewport = makeViewport(); updateInfo(); queueRender(); setStatus(`Abierta: ${file.name}`); } catch (error) { setStatus(`No se pudo abrir el archivo: ${error.message}`, true); } }

function showNewSheet() { const dialog = $('sheet-dialog'); if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', ''); $('sheet-name-input').focus(); }
function createFromForm(event) { event.preventDefault(); const form = new FormData($('sheet-form')); const name = String(form.get('name') || '').trim(); const widthCm = Number(form.get('widthCm')); const heightCm = Number(form.get('heightCm')); if (!name || !Number.isFinite(widthCm) || !Number.isFinite(heightCm) || widthCm < 1 || heightCm < 1 || widthCm > 500 || heightCm > 500) { setStatus('Indica un nombre y tamaños entre 1 y 500 cm.', true); return; } state.document = createDocument({ name, widthCm, heightCm }); state.viewport = makeViewport(); state.lineSelection = []; state.dirty = false; updateInfo(); queueRender(); $('sheet-dialog').close?.(); activateTool('pan'); setStatus(`Nueva hoja creada: ${name}.`); }

canvas.addEventListener('pointermove', (event) => { const p = screenPoint(event); updateCoordinates(p); if (state.pointer?.id === event.pointerId) { const dx = p.x - state.pointer.last.x; const dy = p.y - state.pointer.last.y; if (Math.hypot(p.x - state.pointer.start.x, p.y - state.pointer.start.y) > 3) state.pointer.dragging = true; if (state.tool === 'pan' || state.pointer.button === 1 || state.pointer.space) state.viewport?.panBy?.(dx, dy); state.pointer.last = p; queueRender(); } });
canvas.addEventListener('pointerdown', (event) => { const p = screenPoint(event); const space = state.spaceDown || event.button === 1; state.pointer = { id: event.pointerId, start: p, last: p, dragging: false, button: event.button, space }; canvas.setPointerCapture(event.pointerId); });
canvas.addEventListener('pointerup', (event) => { const p = screenPoint(event); const active = state.pointer; state.pointer = null; canvas.releasePointerCapture?.(event.pointerId); if (!active || active.dragging) return; if (state.tool === 'point') addPointAt(toDocument(p)); else if (state.tool === 'line') selectLinePoint(nearestPoint(p)); });
canvas.addEventListener('pointercancel', () => { state.pointer = null; });
canvas.addEventListener('wheel', (event) => { event.preventDefault(); const p = screenPoint(event); const factor = Math.exp(-event.deltaY * 0.001); if (state.viewport?.zoomAt) state.viewport.zoomAt(factor, p); queueRender(); }, { passive: false });
canvas.addEventListener('contextmenu', (event) => event.preventDefault());

$('point-form').addEventListener('submit', (event) => { event.preventDefault(); addPointAt({ x: Number($('point-x').value), y: Number($('point-y').value) }, $('point-label').value); event.target.reset(); $('snap-mm').checked = true; });
document.querySelectorAll('.tool-button').forEach((button) => button.addEventListener('click', () => activateTool(button.dataset.tool)));
$('cancel-line').addEventListener('click', () => activateTool('line'));
$('new-sheet').addEventListener('click', showNewSheet); $('dialog-cancel').addEventListener('click', () => $('sheet-dialog').close()); $('sheet-form').addEventListener('submit', createFromForm);
$('open-sheet').addEventListener('click', () => $('file-input').click()); $('file-input').addEventListener('change', (event) => { const [file] = event.target.files; if (file) openFile(file); event.target.value = ''; });
$('save-json').addEventListener('click', () => saveFile('json')); $('save-txt').addEventListener('click', () => saveFile('txt'));
window.addEventListener('resize', resizeCanvas); document.addEventListener('keydown', (event) => { if (event.code === 'Space') state.spaceDown = true; if (event.target.matches('input,textarea,button')) return; const key = event.key.toLowerCase(); if (key === 'm') activateTool('pan'); else if (key === 'p') activateTool('point'); else if (key === 'r') activateTool('line'); else if (event.key === 'Escape') { state.lineSelection = []; activateTool('pan'); } }); document.addEventListener('keyup', (event) => { if (event.code === 'Space') state.spaceDown = false; });

// Primer diálogo: no se dibuja una hoja sin dimensiones válidas.
showNewSheet(); resizeCanvas();
