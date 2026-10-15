// 2048 화면·입력 처리 — 상태 보관, 키보드/스와이프, 렌더링, 점수 저장, 오버레이, 알림, 테마 동기화
import { move, canMove, hasWon, addRandomTile, newGame } from './game.js';

const SIZE = 4;
const MOVE_MS = 100; // 타일 이동 transition 시간(style.css와 같게)
const SCORE_POP_MS = 600;
const SWIPE_MIN = 30; // 스와이프로 인정하는 최소 거리(px)
const BEST_KEY = '2048-best';

const DIR_NAMES = { left: '왼쪽', right: '오른쪽', up: '위쪽', down: '아래쪽' };
const KEY_DIRS = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  a: 'left',
  d: 'right',
  w: 'up',
  s: 'down'
};
// 한글 자판 상태에서도 WASD가 동작하도록 물리 키 코드도 함께 본다
const CODE_DIRS = { KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down' };

// ===== DOM =====
const boardEl = document.getElementById('board');
const tilesEl = document.getElementById('tiles');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const scorePopsEl = document.getElementById('score-pops');
const boardDescEl = document.getElementById('board-desc');
const statusEl = document.getElementById('status');
const alertEl = document.getElementById('alert');
const winOverlay = document.getElementById('win-overlay');
const overOverlay = document.getElementById('over-overlay');
const finalScoreEl = document.getElementById('final-score');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');

// ===== 상태 =====
const state = {
  board: null,
  score: 0,
  best: loadBest(),
  wonShown: false, // 이번 게임에서 승리 안내를 이미 띄웠는지
  overlay: null // 현재 열린 오버레이 요소
};

// 화면에 놓인 타일 객체 { value, el } 의 4×4 배열
let tileGrid = emptyGrid();
// 이동 애니메이션 뒤에 실행할 마무리 작업
let pendingFinish = null;
let pendingTimer = 0;

function emptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

function animationsOn() {
  return !reducedMotion.matches;
}

// ===== 최고 점수 저장 =====
function loadBest() {
  try {
    const value = parseInt(localStorage.getItem(BEST_KEY), 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch (e) {
    return 0;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch (e) {
    // 저장에 실패해도 게임은 계속한다
  }
}

// ===== 타일 DOM =====
function createTile(value, r, c, kind) {
  const el = document.createElement('div');
  el.className = 'tile';
  if (kind) {
    el.classList.add(kind);
  }
  const inner = document.createElement('span');
  inner.className = 'tile-inner';
  el.appendChild(inner);
  const tile = { value: 0, el };
  setTileValue(tile, value);
  setTilePos(tile, r, c);
  tilesEl.appendChild(el);
  return tile;
}

function setTileValue(tile, value) {
  tile.value = value;
  const digits = String(value).length;
  tile.el.dataset.value = value > 2048 ? 'super' : String(value);
  tile.el.classList.toggle('digits-3', digits === 3);
  tile.el.classList.toggle('digits-4', digits === 4);
  tile.el.classList.toggle('digits-5', digits >= 5);
  tile.el.firstChild.textContent = String(value);
}

function setTilePos(tile, r, c) {
  tile.el.style.setProperty('--r', r);
  tile.el.style.setProperty('--c', c);
}

// 보드 전체를 처음부터 다시 그린다(새 게임 시작 시).
function renderAll() {
  finishAnimations();
  tilesEl.textContent = '';
  tileGrid = emptyGrid();
  const kind = animationsOn() ? 'is-new' : '';
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const value = state.board[r][c];
      if (value !== 0) {
        tileGrid[r][c] = createTile(value, r, c, kind);
      }
    }
  }
}

// 진행 중인 애니메이션을 즉시 끝낸다(빠른 연타 대비).
function finishAnimations() {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = 0;
  }
  if (pendingFinish) {
    const run = pendingFinish;
    pendingFinish = null;
    run();
  }
  // 진행 중인 transition을 끝 위치로 바로 옮긴다
  boardEl.classList.add('instant');
  void boardEl.offsetWidth;
  boardEl.classList.remove('instant');
  for (const el of tilesEl.children) {
    el.classList.remove('is-new', 'is-merged');
  }
}

// move 결과의 from → to 정보로 타일을 옮기고, 이동이 끝나면 합친 타일·새 타일을 보여 준다.
function animateMove(result, spawned) {
  const next = emptyGrid();
  const leaving = [];
  const mergedCells = [];

  for (const m of result.moves) {
    const [fr, fc] = m.from;
    const [tr, tc] = m.to;
    const tile = tileGrid[fr][fc];
    if (!tile) {
      continue;
    }
    setTilePos(tile, tr, tc);
    if (m.merged) {
      tile.el.classList.add('is-leaving');
      leaving.push(tile);
      if (!mergedCells.some(([r, c]) => r === tr && c === tc)) {
        mergedCells.push([tr, tc]);
      }
    } else {
      next[tr][tc] = tile;
    }
  }
  tileGrid = next;

  const withAnim = animationsOn();
  // 값은 지금 보드에서 미리 읽어 둔다(마무리 시점에 보드가 바뀌어 있어도 안전하도록)
  const mergedTiles = mergedCells.map(([r, c]) => [r, c, result.board[r][c]]);
  const spawnedTile = spawned ? [spawned[0], spawned[1], state.board[spawned[0]][spawned[1]]] : null;
  pendingFinish = () => {
    for (const tile of leaving) {
      tile.el.remove();
    }
    for (const [r, c, value] of mergedTiles) {
      tileGrid[r][c] = createTile(value, r, c, withAnim ? 'is-merged' : '');
    }
    if (spawnedTile) {
      const [r, c, value] = spawnedTile;
      tileGrid[r][c] = createTile(value, r, c, withAnim ? 'is-new' : '');
    }
  };

  if (withAnim) {
    pendingTimer = setTimeout(() => {
      pendingTimer = 0;
      const run = pendingFinish;
      pendingFinish = null;
      if (run) {
        run();
      }
    }, MOVE_MS);
  } else {
    const run = pendingFinish;
    pendingFinish = null;
    run();
  }
}

// ===== 점수 =====
function renderScores() {
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(state.best);
}

function showScorePop(gained) {
  // 움직임 줄이기 설정이면 +N을 만들지 않는다(점수 숫자는 이미 갱신됨)
  if (!animationsOn()) {
    return;
  }
  const pop = document.createElement('span');
  pop.className = 'score-pop';
  pop.textContent = '+' + gained;
  scorePopsEl.appendChild(pop);
  setTimeout(() => pop.remove(), SCORE_POP_MS);
}

function addScore(gained) {
  if (gained <= 0) {
    return;
  }
  state.score += gained;
  if (state.score > state.best) {
    state.best = state.score;
    saveBest(state.best);
  }
  renderScores();
  showScorePop(gained);
}

// ===== 화면 낭독기 알림 =====
let statusToken = 0;

function announce(message) {
  // 같은 문구가 반복되어도 다시 읽히도록 비운 뒤 넣는다
  const token = ++statusToken;
  statusEl.textContent = '';
  setTimeout(() => {
    if (token === statusToken) {
      statusEl.textContent = message;
    }
  }, 30);
}

let alertTimer = 0;

function alertMessage(message) {
  clearAlert();
  alertTimer = setTimeout(() => {
    alertTimer = 0;
    alertEl.textContent = message;
  }, 30);
}

// 대기 중인 긴급 알림을 취소하고 비운다(새 게임 시작 시)
function clearAlert() {
  if (alertTimer) {
    clearTimeout(alertTimer);
    alertTimer = 0;
  }
  alertEl.textContent = '';
}

function updateBoardDesc() {
  const rows = state.board.map((row, r) => {
    const cells = row.map((value) => (value === 0 ? '빈칸' : String(value)));
    return (r + 1) + '행: ' + cells.join(', ');
  });
  boardDescEl.textContent = rows.join('. ') + '.';
}

// ===== 오버레이 =====
function showOverlay(overlay) {
  state.overlay = overlay;
  overlay.hidden = false;
  const first = overlay.querySelector('button');
  if (first) {
    first.focus();
  }
}

function hideOverlays(returnFocus) {
  winOverlay.hidden = true;
  overOverlay.hidden = true;
  state.overlay = null;
  if (returnFocus) {
    boardEl.focus({ preventScroll: true });
  }
}

function showGameOver() {
  finalScoreEl.textContent = String(state.score);
  showOverlay(overOverlay);
  alertMessage('게임 오버. 최종 점수 ' + state.score + '점');
}

// ===== 게임 진행 =====
function startNewGame() {
  hideOverlays(true);
  clearAlert();
  state.board = newGame();
  state.score = 0;
  state.wonShown = false;
  renderAll();
  renderScores();
  updateBoardDesc();
  announce('새 게임을 시작했습니다');
}

function findSpawned(before, after) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (before[r][c] === 0 && after[r][c] !== 0) {
        return [r, c];
      }
    }
  }
  return null;
}

function handleMove(dir) {
  if (state.overlay) {
    return;
  }
  finishAnimations();

  const result = move(state.board, dir);
  if (!result.moved) {
    announce('그 방향으로는 움직일 수 없습니다');
    return;
  }

  // 로직 상태는 즉시 갱신하고 화면이 뒤따른다
  const withTile = addRandomTile(result.board);
  const spawned = findSpawned(result.board, withTile);
  state.board = withTile;

  animateMove(result, spawned);
  addScore(result.gained);
  updateBoardDesc();

  let message = DIR_NAMES[dir] + ' 이동';
  if (result.gained > 0) {
    message += ', ' + result.gained + '점 획득';
  }
  message += ', 점수 ' + state.score;
  announce(message);

  if (!state.wonShown && hasWon(state.board)) {
    state.wonShown = true;
    showOverlay(winOverlay);
    alertMessage('2048 달성! 계속하거나 새 게임을 시작할 수 있습니다.');
    return;
  }

  if (!canMove(state.board)) {
    showGameOver();
  }
}

// ===== 입력: 키보드 =====
function keyToDir(event) {
  return KEY_DIRS[event.key] || KEY_DIRS[String(event.key).toLowerCase()] || CODE_DIRS[event.code] || null;
}

function isInteractiveTarget(target) {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(target.closest('button, input, textarea, select, a[href], [contenteditable=""], [contenteditable="true"]'));
}

// 오버레이(대화 상자)가 열려 있는 동안 Tab/Shift+Tab이 오버레이 버튼 안에서만 돌게 한다
function trapFocus(event) {
  const buttons = Array.from(state.overlay.querySelectorAll('button'));
  if (buttons.length === 0) {
    return;
  }
  const index = buttons.indexOf(document.activeElement);
  let next;
  if (event.shiftKey) {
    next = index <= 0 ? buttons[buttons.length - 1] : buttons[index - 1];
  } else {
    next = index === -1 || index === buttons.length - 1 ? buttons[0] : buttons[index + 1];
  }
  event.preventDefault();
  next.focus();
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Tab' && state.overlay) {
    trapFocus(event);
    return;
  }
  if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) {
    return;
  }
  const dir = keyToDir(event);
  if (!dir || isInteractiveTarget(event.target)) {
    return;
  }
  event.preventDefault();
  handleMove(dir);
});

// ===== 입력: 스와이프(보드 위에서만) =====
let swipeStart = null;

boardEl.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) {
    return;
  }
  // iframe 안에서도 키 입력을 받을 수 있게 보드로 포커스를 옮긴다
  boardEl.focus({ preventScroll: true });
  swipeStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
  try {
    boardEl.setPointerCapture(event.pointerId);
  } catch (e) {
    // 포인터 캡처를 지원하지 않아도 동작에는 문제없다
  }
});

boardEl.addEventListener('pointerup', (event) => {
  if (!swipeStart || swipeStart.id !== event.pointerId) {
    return;
  }
  const dx = event.clientX - swipeStart.x;
  const dy = event.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) {
    return; // 짧은 탭은 이동으로 보지 않는다
  }
  // 더 많이 움직인 축(주축)으로 방향을 정한다
  if (Math.abs(dx) > Math.abs(dy)) {
    handleMove(dx > 0 ? 'right' : 'left');
  } else {
    handleMove(dy > 0 ? 'down' : 'up');
  }
});

boardEl.addEventListener('pointercancel', () => {
  swipeStart = null;
});

// ===== 버튼 =====
document.getElementById('new-game').addEventListener('click', startNewGame);
document.getElementById('win-new-game').addEventListener('click', startNewGame);
document.getElementById('retry').addEventListener('click', startNewGame);
document.getElementById('continue').addEventListener('click', () => {
  hideOverlays(true);
  announce('계속합니다');
  if (!canMove(state.board)) {
    showGameOver();
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

// 저장된 테마가 없을 때 OS 설정 변경을 따라간다
darkScheme.addEventListener('change', applyTheme);

// ===== 시작 =====
applyTheme();
state.board = newGame();
renderAll();
renderScores();
updateBoardDesc();
