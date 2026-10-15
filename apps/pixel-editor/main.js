// 픽셀 아트 에디터 화면·입력 처리
import {
  SIZE,
  CELL_COUNT,
  createPixels,
  normalizeColor,
  setPixels,
  cellsOnLine,
  floodFill,
  isEmpty,
  createHistory,
  pushHistory,
  undo,
  redo,
  pixelsToRGBA,
  serialize,
  deserialize,
  timestampName
} from './editor.js';

const STORAGE_KEY = 'pixel-editor-state';
const SAVE_DELAY = 300;
const TOAST_MS = 3000;
const HISTORY_LIMIT = 100;

// 기본 팔레트 16색
const PALETTE = [
  { hex: '#000000', name: '검정' },
  { hex: '#ffffff', name: '흰색' },
  { hex: '#9e9e9e', name: '회색' },
  { hex: '#5d4037', name: '갈색' },
  { hex: '#e53935', name: '빨강' },
  { hex: '#fb8c00', name: '주황' },
  { hex: '#fdd835', name: '노랑' },
  { hex: '#7cb342', name: '연두' },
  { hex: '#2e7d32', name: '초록' },
  { hex: '#00acc1', name: '청록' },
  { hex: '#1e88e5', name: '파랑' },
  { hex: '#3949ab', name: '남색' },
  { hex: '#8e24aa', name: '보라' },
  { hex: '#f06292', name: '분홍' },
  { hex: '#ffccbc', name: '살구' },
  { hex: '#424242', name: '진회색' }
];

const TOOL_NAMES = { pen: '펜', eraser: '지우개', fill: '채우기' };

// ===== 요소 =====
const boardEl = document.getElementById('board');
const paletteEl = document.getElementById('palette');
const customSwatch = document.getElementById('custom-swatch');
const customColorEl = document.getElementById('custom-color');
const colorInput = document.getElementById('color-input');
const undoBtn = document.getElementById('undo');
const redoBtn = document.getElementById('redo');
const gridBtn = document.getElementById('grid-toggle');
const clearBtn = document.getElementById('clear');
const scaleSelect = document.getElementById('scale');
const saveBtn = document.getElementById('save');
const statusEl = document.getElementById('status');
const toastEl = document.getElementById('toast');
const currentSwatch = document.getElementById('current-swatch');
const currentText = document.getElementById('current-text');
const toolButtons = Array.from(document.querySelectorAll('[data-tool]'));

const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');

// ===== 상태 =====
const state = {
  pixels: createPixels(),
  color: '#000000',
  tool: 'pen',
  grid: true,
  history: createHistory(HISTORY_LIMIT),
  cursor: { x: 0, y: 0 }
};

// 진행 중인 포인터 획
let stroke = null; // { pointerId, start, last }

// ===== 색 도우미 =====
function colorName(hex) {
  const found = PALETTE.find((p) => p.hex === hex);
  return found ? found.name : hex;
}

// 밝은 색 위에는 검정 체크, 어두운 색 위에는 흰색 체크
function isLight(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 150;
}

function setCheckClass(el, hex) {
  const light = isLight(hex);
  el.classList.toggle('on-light', light);
  el.classList.toggle('on-dark', !light);
}

// ===== 보드 만들기 =====
const cellEls = [];
for (let i = 0; i < CELL_COUNT; i++) {
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.setAttribute('aria-hidden', 'true');
  boardEl.appendChild(cell);
  cellEls.push(cell);
}

// 화면에 마지막으로 그린 그림(바뀐 칸만 갱신하기 위해)
let renderedPixels = new Array(CELL_COUNT).fill(undefined);
let renderQueued = false;

function scheduleRender() {
  if (renderQueued) {
    return;
  }
  renderQueued = true;
  requestAnimationFrame(renderBoard);
}

function renderBoard() {
  renderQueued = false;
  const pixels = state.pixels;
  for (let i = 0; i < CELL_COUNT; i++) {
    const value = pixels[i];
    if (renderedPixels[i] === value) {
      continue;
    }
    const cell = cellEls[i];
    if (value === null) {
      cell.style.backgroundColor = '';
      cell.classList.remove('is-filled');
    } else {
      cell.style.backgroundColor = value;
      cell.classList.add('is-filled');
    }
    renderedPixels[i] = value;
  }
}

let cursorIndex = -1;

function renderCursor() {
  const index = state.cursor.y * SIZE + state.cursor.x;
  if (index === cursorIndex) {
    return;
  }
  if (cursorIndex >= 0) {
    cellEls[cursorIndex].classList.remove('is-cursor');
  }
  cellEls[index].classList.add('is-cursor');
  cursorIndex = index;
}

// ===== 팔레트 만들기 =====
const swatchEls = PALETTE.map((p) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'swatch';
  btn.style.backgroundColor = p.hex;
  btn.dataset.color = p.hex;
  btn.setAttribute('aria-label', p.name + ' ' + p.hex);
  btn.setAttribute('aria-pressed', 'false');
  btn.title = p.name;
  setCheckClass(btn, p.hex);
  paletteEl.insertBefore(btn, customSwatch);
  btn.addEventListener('click', () => {
    selectColor(p.hex);
  });
  return btn;
});

let customColor = normalizeColor(colorInput.value) || '#ff7043';

function renderCustom() {
  colorInput.value = customColor;
  customColorEl.style.backgroundColor = customColor;
  setCheckClass(customSwatch, customColor);
}

// ===== 컨트롤 표시 =====
function renderControls() {
  const inPalette = PALETTE.some((p) => p.hex === state.color);
  swatchEls.forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.color === state.color));
  });
  // 색 입력에는 aria-pressed를 쓸 수 없으므로 선택 상태를 이름에 넣어 전달한다
  const customSelected = !inPalette && state.color === customColor;
  customSwatch.classList.toggle('is-selected', customSelected);
  colorInput.setAttribute('aria-label', '사용자 색 고르기, 현재 ' + customColor + (customSelected ? ', 선택됨' : ''));

  toolButtons.forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.tool === state.tool));
  });

  undoBtn.disabled = state.history.past.length === 0;
  redoBtn.disabled = state.history.future.length === 0;
  clearBtn.disabled = isEmpty(state.pixels);

  gridBtn.setAttribute('aria-pressed', String(state.grid));
  boardEl.classList.toggle('show-grid', state.grid);

  // 현재 상태: 지우개면 체크무늬, 아니면 현재 색
  if (state.tool === 'eraser') {
    currentSwatch.style.backgroundColor = '';
    currentSwatch.classList.remove('is-filled');
    currentText.textContent = '지우개';
  } else {
    currentSwatch.style.backgroundColor = state.color;
    currentSwatch.classList.add('is-filled');
    currentText.textContent = TOOL_NAMES[state.tool] + ' · ' + colorName(state.color);
  }
}

// ===== 화면 낭독기 알림 =====
let statusToken = 0;

// 연속 알림은 마지막 것만 남긴다
function announce(message) {
  const token = ++statusToken;
  statusEl.textContent = '';
  setTimeout(() => {
    if (token === statusToken) {
      statusEl.textContent = message;
    }
  }, 30);
}

// ===== 안내 토스트 =====
let toastTimer = 0;
let toastHideTimer = 0;

function showToast(message) {
  clearTimeout(toastTimer);
  clearTimeout(toastHideTimer);
  toastEl.textContent = message;
  toastEl.classList.remove('is-hiding');
  toastEl.hidden = false;
  toastTimer = setTimeout(hideToast, TOAST_MS);
}

function hideToast() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    toastEl.hidden = true;
    return;
  }
  toastEl.classList.add('is-hiding');
  toastHideTimer = setTimeout(() => {
    toastEl.hidden = true;
    toastEl.classList.remove('is-hiding');
  }, 200);
}

// ===== 자동 저장 =====
let saveTimer = 0;
// 이 창에서 바꾼 내용이 아직 저장되지 않았는지(바꾼 게 없으면 저장하지 않는다)
let dirty = false;
// 다른 창과 마지막으로 공유한 그림(이 창이 저장했거나 받아 온 것). 이것과 다른 칸이 이 창의 변경
let basePixels = createPixels();

function scheduleSave() {
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, SAVE_DELAY);
}

function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = 0;
  if (!dirty) {
    return;
  }
  dirty = false;
  try {
    localStorage.setItem(STORAGE_KEY, serialize(state));
    basePixels = state.pixels;
  } catch (e) {
    // 저장 실패(사생활 보호 모드 등)해도 앱은 계속 동작
  }
}

function loadSaved() {
  let text = null;
  try {
    text = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    text = null;
  }
  if (text === null) {
    return;
  }
  const saved = deserialize(text);
  if (!saved) {
    return;
  }
  state.pixels = saved.pixels;
  basePixels = saved.pixels;
  state.color = saved.color;
  state.tool = saved.tool;
  state.grid = saved.grid;
  if (!PALETTE.some((p) => p.hex === saved.color)) {
    customColor = saved.color;
  }
}

// ===== 그림 변경 =====
// 칠한 결과를 반영(기록은 획이 끝날 때)
function applyPixels(next) {
  if (next === state.pixels) {
    return false;
  }
  state.pixels = next;
  scheduleRender();
  return true;
}

// 동작 하나를 되돌리기 기록에 남긴다
function commit(before) {
  if (before === state.pixels) {
    return;
  }
  state.history = pushHistory(state.history, before);
  renderControls();
  scheduleSave();
}

function paintCells(cells) {
  const color = state.tool === 'eraser' ? null : state.color;
  return applyPixels(setPixels(state.pixels, cells, color).pixels);
}

function fillAt(cell) {
  return applyPixels(floodFill(state.pixels, cell.x, cell.y, state.color).pixels);
}

// ===== 도구·색 선택 =====
function selectTool(tool, silent) {
  state.tool = tool;
  renderControls();
  scheduleSave();
  if (!silent) {
    announce(TOOL_NAMES[tool] + ' 선택');
  }
}

// 색을 고르면 펜으로 자동 전환(채우기는 유지)
function selectColor(hex) {
  state.color = hex;
  if (state.tool === 'eraser') {
    state.tool = 'pen';
  }
  renderControls();
  scheduleSave();
  announce(colorName(hex) + ' 선택, ' + TOOL_NAMES[state.tool]);
}

toolButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    selectTool(btn.dataset.tool);
  });
});

colorInput.addEventListener('input', () => {
  const hex = normalizeColor(colorInput.value);
  if (!hex) {
    return;
  }
  customColor = hex;
  renderCustom();
  selectColor(hex);
});

// 색을 바꾸지 않고 열기만 해도 사용자 색을 현재 색으로
colorInput.addEventListener('click', () => {
  if (state.color !== customColor || state.tool === 'eraser') {
    selectColor(customColor);
  }
});

// ===== 되돌리기·다시 실행·전체 지우기·격자선 =====
function doUndo() {
  if (stroke || state.history.past.length === 0) {
    return;
  }
  const r = undo(state.history, state.pixels);
  state.history = r.history;
  applyPixels(r.pixels);
  renderControls();
  scheduleSave();
  announce('되돌림');
}

function doRedo() {
  if (stroke || state.history.future.length === 0) {
    return;
  }
  const r = redo(state.history, state.pixels);
  state.history = r.history;
  applyPixels(r.pixels);
  renderControls();
  scheduleSave();
  announce('다시 실행');
}

function doClear() {
  if (stroke || isEmpty(state.pixels)) {
    return;
  }
  const before = state.pixels;
  applyPixels(createPixels());
  commit(before);
  showToast('전체 지움 — 되돌리기로 복구할 수 있습니다');
  announce('전체 지움, 되돌리기로 복구할 수 있습니다');
}

function toggleGrid() {
  state.grid = !state.grid;
  renderControls();
  scheduleSave();
  announce(state.grid ? '격자선 켬' : '격자선 끔');
}

undoBtn.addEventListener('click', doUndo);
redoBtn.addEventListener('click', doRedo);
clearBtn.addEventListener('click', doClear);
gridBtn.addEventListener('click', toggleGrid);

// ===== PNG 저장 =====
function savePng() {
  const scale = Number(scaleSelect.value) || 16;
  const w = SIZE * scale;
  const name = timestampName(new Date());
  const fail = () => {
    showToast('저장하지 못했습니다');
    announce('저장하지 못했습니다');
  };
  try {
    // 화면에 붙이지 않는 메모리 캔버스에 픽셀 값을 직접 쓴다(스무딩·테마 영향 없음)
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = w;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(new ImageData(pixelsToRGBA(state.pixels, scale), w, w), 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) {
        fail();
        return;
      }
      try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        announce('PNG 저장: ' + name + ' (' + w + '×' + w + ')');
      } catch (e) {
        fail();
      }
    }, 'image/png');
  } catch (e) {
    fail();
  }
}

saveBtn.addEventListener('click', savePng);

// ===== 포인터 그리기 =====
function cellFromPoint(clientX, clientY) {
  const rect = boardEl.getBoundingClientRect();
  if (!(rect.width > 0) || !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return null;
  }
  const size = rect.width / SIZE;
  const clamp = (n) => Math.max(0, Math.min(SIZE - 1, n));
  return {
    x: clamp(Math.floor((clientX - rect.left) / size)),
    y: clamp(Math.floor((clientY - rect.top) / size))
  };
}

function moveCursorTo(cell) {
  state.cursor = { x: cell.x, y: cell.y };
  renderCursor();
}

boardEl.addEventListener('pointerdown', (event) => {
  // 다른 포인터(두 번째 손가락 등)는 무시
  if (stroke) {
    return;
  }
  // 마우스는 주 버튼만
  if (event.pointerType === 'mouse' && event.button !== 0) {
    return;
  }
  const cell = cellFromPoint(event.clientX, event.clientY);
  if (!cell) {
    return;
  }
  boardEl.classList.remove('kbd');
  moveCursorTo(cell);

  const isFill = state.tool === 'fill';
  if (isFill) {
    // 채우기는 누르는 즉시 1단계로 기록
    const before = state.pixels;
    fillAt(cell);
    commit(before);
  }

  // 채우기도 손을 뗄 때까지 활성 포인터로 기록해 다른 포인터를 무시한다
  stroke = { pointerId: event.pointerId, start: state.pixels, last: cell, fill: isFill };
  try {
    boardEl.setPointerCapture(event.pointerId);
  } catch (e) {
    // 캡처를 못 해도 그리기는 계속
  }
  if (!isFill) {
    paintCells([cell]);
  }
});

boardEl.addEventListener('pointermove', (event) => {
  if (!stroke || stroke.fill || event.pointerId !== stroke.pointerId) {
    return;
  }
  let points = [];
  if (typeof event.getCoalescedEvents === 'function') {
    points = event.getCoalescedEvents();
  }
  if (!points || points.length === 0) {
    points = [event];
  }
  for (const p of points) {
    const cell = cellFromPoint(p.clientX, p.clientY);
    if (!cell || cell.x === stroke.last.x && cell.y === stroke.last.y) {
      continue;
    }
    // 빠르게 움직여도 칸이 빠지지 않도록 직선 보간
    paintCells(cellsOnLine(stroke.last, cell));
    stroke.last = cell;
  }
  moveCursorTo(stroke.last);
});

function endStroke(event) {
  if (!stroke || event.pointerId !== stroke.pointerId) {
    return;
  }
  const before = stroke.start;
  const wasFill = stroke.fill;
  stroke = null;
  // 채우기는 누를 때 이미 기록했다
  if (wasFill) {
    return;
  }
  // 취소된 획도 칠한 내용은 유지
  commit(before);
  // 획 중에 다른 창의 변경이 왔으면 그 그림 위에 이번 획을 얹어 적용
  if (pendingRemote) {
    const remote = pendingRemote;
    pendingRemote = null;
    applyRemote(remote);
  }
}

boardEl.addEventListener('pointerup', endStroke);
boardEl.addEventListener('pointercancel', endStroke);
boardEl.addEventListener('lostpointercapture', endStroke);

// 길게 누르기 메뉴·끌기 방지
boardEl.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});
boardEl.addEventListener('dragstart', (event) => {
  event.preventDefault();
});

// ===== 키보드 그리기 =====
function describeCell(cell) {
  const value = state.pixels[cell.y * SIZE + cell.x];
  const text = value === null ? '비어 있음' : colorName(value);
  return (cell.y + 1) + '행 ' + (cell.x + 1) + '열, ' + text;
}

// 커서 칸에 현재 도구 적용(한 번이 1단계)
function applyToolAt(cells) {
  const before = state.pixels;
  let changed;
  if (state.tool === 'fill') {
    changed = fillAt(cells[cells.length - 1]);
  } else {
    changed = paintCells(cells);
  }
  commit(before);
  if (!changed) {
    return '변화 없음';
  }
  if (state.tool === 'eraser') {
    return '지움';
  }
  return state.tool === 'fill' ? '채움' : '칠함';
}

boardEl.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || stroke) {
    return;
  }
  const { x, y } = state.cursor;
  let next = null;
  switch (event.key) {
    case 'ArrowLeft':
      next = { x: Math.max(0, x - 1), y };
      break;
    case 'ArrowRight':
      next = { x: Math.min(SIZE - 1, x + 1), y };
      break;
    case 'ArrowUp':
      next = { x, y: Math.max(0, y - 1) };
      break;
    case 'ArrowDown':
      next = { x, y: Math.min(SIZE - 1, y + 1) };
      break;
    case 'Home':
      next = { x: 0, y };
      break;
    case 'End':
      next = { x: SIZE - 1, y };
      break;
    case ' ':
    case 'Enter': {
      event.preventDefault();
      boardEl.classList.add('kbd');
      if (event.repeat) {
        return;
      }
      const result = applyToolAt([{ x, y }]);
      announce(result + ', ' + describeCell(state.cursor));
      return;
    }
    default:
      return;
  }
  event.preventDefault();
  boardEl.classList.add('kbd');
  const from = state.cursor;
  moveCursorTo(next);
  if (event.shiftKey && event.key.startsWith('Arrow')) {
    // Shift+방향키: 움직이면서 칠하기(출발 칸과 도착 칸)
    const cells = state.tool === 'fill' ? [next] : cellsOnLine(from, next);
    const result = applyToolAt(cells);
    announce(result + ', ' + describeCell(next));
    return;
  }
  announce(describeCell(next));
});

boardEl.addEventListener('blur', () => {
  boardEl.classList.remove('kbd');
});

// ===== 전역 단축키 =====
function isTypingTarget(target) {
  if (!target || !target.tagName) {
    return false;
  }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target.isContentEditable;
}

document.addEventListener('keydown', (event) => {
  if (isTypingTarget(event.target) || event.altKey) {
    return;
  }
  // 한글 자판에서도 동작하도록 event.code 사용
  const code = event.code;
  const mod = event.ctrlKey || event.metaKey;
  if (mod) {
    if (code === 'KeyZ' && event.shiftKey) {
      event.preventDefault();
      doRedo();
    } else if (code === 'KeyZ') {
      event.preventDefault();
      doUndo();
    } else if (code === 'KeyY' && event.ctrlKey) {
      event.preventDefault();
      doRedo();
    }
    return;
  }
  if (event.repeat || stroke) {
    return;
  }
  if (code === 'KeyB') {
    selectTool('pen');
  } else if (code === 'KeyE') {
    selectTool('eraser');
  } else if (code === 'KeyF') {
    selectTool('fill');
  } else if (code === 'KeyG') {
    toggleGrid();
  }
});

// 페이지를 떠날 때 대기 중인 저장을 바로 실행
window.addEventListener('pagehide', () => {
  if (saveTimer) {
    saveNow();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && saveTimer) {
    saveNow();
  }
});

// ===== 테마 동기화 =====
function applyTheme() {
  let theme = null;
  try {
    theme = localStorage.getItem('theme');
  } catch (e) {
    theme = null;
  }
  if (theme !== 'light' && theme !== 'dark') {
    theme = darkScheme.matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);
}

// 부모 블로그(같은 출처)에서 테마를 바꾸면 iframe도 따라 바꾼다
window.addEventListener('storage', (event) => {
  if (event.key === 'theme' || event.key === null) {
    applyTheme();
  }
});

// ===== 여러 창 동기화 =====
// 카드 iframe과 전체 화면 탭이 함께 열려 있을 때, 다른 창이 저장한 그림을 받아 와
// 늦게 저장한 쪽이 다른 쪽 그림을 덮어쓰지 않게 한다.
// 동기화하는 것은 그림(픽셀)뿐이고, 도구·색·사용자 색·격자선·배율은 창마다 유지한다.
let pendingRemote = null;

// 받아 온 그림 위에 이 창의 아직 공유되지 않은 변경(basePixels와 다른 칸)을 얹는다.
// 대기 중인 저장과 방금 끝난 획이 모두 여기에 포함된다.
function applyRemote(saved) {
  const remote = saved.pixels;
  const merged = remote.slice();
  let localChanged = false;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (state.pixels[i] !== basePixels[i] && merged[i] !== state.pixels[i]) {
      merged[i] = state.pixels[i];
      localChanged = true;
    }
  }
  const next = localChanged ? merged : remote;
  const pictureChanged = next.some((v, i) => v !== state.pixels[i]);
  basePixels = remote;

  // 되돌리기 기록은 유지한다. 그림이 바뀌면 받은(합친) 그림을 기존 기록 위에 새 단계로 쌓아
  // 되돌리기 한 번으로 받기 전 그림으로 돌아갈 수 있게 한다(한도 100은 pushHistory가 지킴).
  // 그림이 같으면(설정만 바뀐 경우 등) 기록을 그대로 둔다.
  if (pictureChanged) {
    state.history = pushHistory(state.history, state.pixels);
    applyPixels(next);
  }
  renderControls();

  if (localChanged) {
    // 합친 결과를 바로 저장해 다른 창도 같은 그림을 갖게 한다.
    // 다른 창은 공유되지 않은 변경이 없으면 받기만 하고 다시 저장하지 않으므로 주고받기가 끝난다.
    dirty = true;
    saveNow();
  }
  // 설정만 바꾸고 저장 대기 중이었다면 그 저장은 그대로 둔다(그림은 이미 같음)
  if (pictureChanged) {
    announce('다른 창의 변경을 불러왔습니다');
  }
}

window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY || event.newValue === null) {
    return;
  }
  const saved = deserialize(event.newValue);
  if (!saved) {
    return;
  }
  if (stroke && !stroke.fill) {
    // 그리는 중이면 획이 끝난 뒤 적용(여러 번 오면 마지막 값만)
    pendingRemote = saved;
    return;
  }
  applyRemote(saved);
});

// 저장된 테마가 없을 때 OS 설정 변경을 따라간다
darkScheme.addEventListener('change', applyTheme);

// ===== 시작 =====
applyTheme();
loadSaved();
renderCustom();
renderControls();
renderBoard();
renderCursor();
