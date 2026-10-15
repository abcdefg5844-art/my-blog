// 픽셀 아트 에디터 순수 로직 (DOM·localStorage·Canvas 접근 없음)
// 모든 함수는 입력 배열을 바꾸지 않는다.

export const SIZE = 16;
export const CELL_COUNT = SIZE * SIZE;
export const TOOLS = ['pen', 'eraser', 'fill'];

// 256칸 모두 투명(null)인 그림
export function createPixels() {
  return new Array(CELL_COUNT).fill(null);
}

// '#RGB' / '#RRGGBB'(대소문자 무관) → '#rrggbb', 잘못된 값은 null
export function normalizeColor(str) {
  if (typeof str !== 'string') {
    return null;
  }
  const value = str.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(value)) {
    return value;
  }
  if (/^#[0-9a-f]{3}$/.test(value)) {
    return '#' + value[1] + value[1] + value[2] + value[2] + value[3] + value[3];
  }
  return null;
}

function inRange(x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

// cells 위치를 color(또는 null)로 칠한다. 범위 밖 좌표는 무시
export function setPixels(pixels, cells, color) {
  let next = pixels;
  for (const cell of cells) {
    if (!cell || !inRange(cell.x, cell.y)) {
      continue;
    }
    const i = cell.y * SIZE + cell.x;
    if (next[i] === color) {
      continue;
    }
    if (next === pixels) {
      next = pixels.slice();
    }
    next[i] = color;
  }
  return { pixels: next, changed: next !== pixels };
}

// 두 칸 사이 Bresenham 직선(양 끝 포함, a → b 순서)
export function cellsOnLine(a, b) {
  let x = a.x;
  let y = a.y;
  const dx = Math.abs(b.x - a.x);
  const dy = -Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1;
  const sy = a.y < b.y ? 1 : -1;
  let err = dx + dy;
  const cells = [];
  for (;;) {
    cells.push({ x, y });
    if (x === b.x && y === b.y) {
      break;
    }
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return cells;
}

// 시작 칸과 같은 색(null 포함)으로 상하좌우 연결된 영역을 color로 채운다(BFS 큐)
export function floodFill(pixels, x, y, color) {
  if (!inRange(x, y)) {
    return { pixels, changed: false };
  }
  const target = pixels[y * SIZE + x];
  if (target === color) {
    return { pixels, changed: false };
  }
  const next = pixels.slice();
  const seen = new Uint8Array(CELL_COUNT);
  const queue = [y * SIZE + x];
  seen[queue[0]] = 1;
  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    next[i] = color;
    const cx = i % SIZE;
    const cy = (i - cx) / SIZE;
    const neighbors = [];
    if (cx > 0) neighbors.push(i - 1);
    if (cx < SIZE - 1) neighbors.push(i + 1);
    if (cy > 0) neighbors.push(i - SIZE);
    if (cy < SIZE - 1) neighbors.push(i + SIZE);
    for (const n of neighbors) {
      if (!seen[n] && pixels[n] === target) {
        seen[n] = 1;
        queue.push(n);
      }
    }
  }
  return { pixels: next, changed: true };
}

// 모두 투명인지
export function isEmpty(pixels) {
  return pixels.every((value) => value === null);
}

// ===== 되돌리기 기록 =====
export function createHistory(limit = 100) {
  return { past: [], future: [], limit };
}

// 이전 그림(before)을 past에 넣고 future를 비운다
export function pushHistory(h, before) {
  const limit = h.limit || 100;
  const past = h.past.concat([before]);
  while (past.length > limit) {
    past.shift();
  }
  return { past, future: [], limit };
}

export function undo(h, current) {
  if (h.past.length === 0) {
    return { history: h, pixels: current };
  }
  const past = h.past.slice(0, -1);
  const pixels = h.past[h.past.length - 1];
  return { history: { past, future: h.future.concat([current]), limit: h.limit }, pixels };
}

export function redo(h, current) {
  if (h.future.length === 0) {
    return { history: h, pixels: current };
  }
  const future = h.future.slice(0, -1);
  const pixels = h.future[h.future.length - 1];
  return { history: { past: h.past.concat([current]), future, limit: h.limit }, pixels };
}

// ===== PNG 픽셀 값 =====
// (16·scale)² × 4 길이의 RGBA. 칸마다 scale×scale 블록, null은 0,0,0,0
export function pixelsToRGBA(pixels, scale) {
  const w = SIZE * scale;
  const data = new Uint8ClampedArray(w * w * 4);
  for (let cy = 0; cy < SIZE; cy++) {
    for (let cx = 0; cx < SIZE; cx++) {
      const color = pixels[cy * SIZE + cx];
      if (color === null) {
        continue;
      }
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      for (let py = cy * scale; py < (cy + 1) * scale; py++) {
        let o = (py * w + cx * scale) * 4;
        for (let k = 0; k < scale; k++) {
          data[o] = r;
          data[o + 1] = g;
          data[o + 2] = b;
          data[o + 3] = 255;
          o += 4;
        }
      }
    }
  }
  return data;
}

// ===== 저장 형식 =====
export function serialize(state) {
  return JSON.stringify({
    v: 1,
    pixels: state.pixels,
    color: state.color,
    tool: state.tool,
    grid: state.grid
  });
}

// 잘못된 값이 하나라도 있으면 null(→ 빈 그림으로 시작)
export function deserialize(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return null;
  }
  if (!data || typeof data !== 'object' || data.v !== 1) {
    return null;
  }
  if (!Array.isArray(data.pixels) || data.pixels.length !== CELL_COUNT) {
    return null;
  }
  const pixels = [];
  for (const value of data.pixels) {
    if (value === null) {
      pixels.push(null);
      continue;
    }
    // 저장 값은 항상 소문자 '#rrggbb'여야 한다
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/.test(value)) {
      return null;
    }
    pixels.push(value);
  }
  const color = normalizeColor(data.color);
  if (!color) {
    return null;
  }
  if (!TOOLS.includes(data.tool)) {
    return null;
  }
  if (typeof data.grid !== 'boolean') {
    return null;
  }
  return { pixels, color, tool: data.tool, grid: data.grid };
}

// pixel-art-YYYYMMDD-HHmmss.png (로컬 시간)
export function timestampName(date) {
  const two = (n) => String(n).padStart(2, '0');
  return 'pixel-art-' +
    date.getFullYear() + two(date.getMonth() + 1) + two(date.getDate()) + '-' +
    two(date.getHours()) + two(date.getMinutes()) + two(date.getSeconds()) + '.png';
}
