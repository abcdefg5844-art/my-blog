// 2048 게임 로직 — DOM에 접근하지 않는 순수 함수만 모아 둔 모듈
// 보드는 4×4 2차원 배열이며 빈 칸은 0이다.

const SIZE = 4;

// 빈 4×4 보드를 만든다.
export function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

// 보드를 깊은 복사한다(내부용).
function cloneBoard(board) {
  return board.map((row) => row.slice());
}

// 한 줄을 밀면서 어느 칸이 어디로 갔는지까지 계산한다(내부용).
// moves: { from, to, merged } — 줄 안의 인덱스 기준
function slideLineDetailed(line) {
  const items = [];
  line.forEach((value, index) => {
    if (value !== 0) {
      items.push({ value, index });
    }
  });

  const out = [];
  const moves = [];
  const merged = [];
  let gained = 0;

  for (let k = 0; k < items.length;) {
    const target = out.length;
    if (k + 1 < items.length && items[k].value === items[k + 1].value) {
      // 같은 값 두 개를 합치고 두 칸을 건너뛴다(합쳐진 타일은 다시 합쳐지지 않음)
      const value = items[k].value * 2;
      out.push(value);
      gained += value;
      moves.push({ from: items[k].index, to: target, merged: true });
      moves.push({ from: items[k + 1].index, to: target, merged: true });
      merged.push(target);
      k += 2;
    } else {
      out.push(items[k].value);
      moves.push({ from: items[k].index, to: target, merged: false });
      k += 1;
    }
  }

  while (out.length < line.length) {
    out.push(0);
  }

  return { line: out, gained, moves, merged };
}

// 한 줄(이동 방향 쪽이 인덱스 0)을 민다. 반환: { line, gained }
export function slideLine(line) {
  const result = slideLineDetailed(line);
  return { line: result.line, gained: result.gained };
}

// 방향별로, 이동 방향 쪽 칸부터 차례로 나열한 좌표 줄 4개를 만든다(내부용).
function linesFor(dir) {
  const lines = [];
  for (let i = 0; i < SIZE; i++) {
    const coords = [];
    for (let j = 0; j < SIZE; j++) {
      if (dir === 'left') {
        coords.push([i, j]);
      } else if (dir === 'right') {
        coords.push([i, SIZE - 1 - j]);
      } else if (dir === 'up') {
        coords.push([j, i]);
      } else if (dir === 'down') {
        coords.push([SIZE - 1 - j, i]);
      } else {
        throw new Error('알 수 없는 방향: ' + dir);
      }
    }
    lines.push(coords);
  }
  return lines;
}

// 보드를 dir('left' | 'right' | 'up' | 'down') 방향으로 민다. 입력 보드는 바꾸지 않는다.
// 반환: { board, gained, moved, moves, merged }
//   moves: 애니메이션용 [{ from: [r, c], to: [r, c], merged }]
//   merged: 합쳐져 생긴 칸 [[r, c], ...]
export function move(board, dir) {
  const next = createEmptyBoard();
  const moves = [];
  const merged = [];
  let gained = 0;

  for (const coords of linesFor(dir)) {
    const line = coords.map(([r, c]) => board[r][c]);
    const result = slideLineDetailed(line);
    gained += result.gained;
    result.line.forEach((value, k) => {
      const [r, c] = coords[k];
      next[r][c] = value;
    });
    for (const m of result.moves) {
      moves.push({ from: coords[m.from].slice(), to: coords[m.to].slice(), merged: m.merged });
    }
    for (const k of result.merged) {
      merged.push(coords[k].slice());
    }
  }

  let moved = false;
  for (let r = 0; r < SIZE && !moved; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (next[r][c] !== board[r][c]) {
        moved = true;
        break;
      }
    }
  }

  return { board: next, gained, moved, moves, merged };
}

// 더 움직일 수 있는지 확인한다. false면 게임 오버.
export function canMove(board) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const value = board[r][c];
      if (value === 0) {
        return true;
      }
      if (c + 1 < SIZE && board[r][c + 1] === value) {
        return true;
      }
      if (r + 1 < SIZE && board[r + 1][c] === value) {
        return true;
      }
    }
  }
  return false;
}

// 2048 이상 타일이 있는지 확인한다.
export function hasWon(board) {
  return board.some((row) => row.some((value) => value >= 2048));
}

// 빈 칸 좌표 목록 [[r, c], ...]
export function emptyCells(board) {
  const cells = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) {
        cells.push([r, c]);
      }
    }
  }
  return cells;
}

// 빈 칸 하나에 새 타일(2: 90%, 4: 10%)을 넣은 새 보드를 돌려준다.
// rng를 두 번 호출한다: 첫 번째는 칸 선택, 두 번째는 값 선택(< 0.9 이면 2).
// 빈 칸이 없으면 같은 값의 보드를 그대로 돌려준다.
export function addRandomTile(board, rng = Math.random) {
  const next = cloneBoard(board);
  const cells = emptyCells(board);
  if (cells.length === 0) {
    return next;
  }
  const index = Math.min(cells.length - 1, Math.floor(rng() * cells.length));
  const [r, c] = cells[index];
  next[r][c] = rng() < 0.9 ? 2 : 4;
  return next;
}

// 타일 2개가 놓인 새 게임 보드를 만든다.
export function newGame(rng = Math.random) {
  return addRandomTile(addRandomTile(createEmptyBoard(), rng), rng);
}
