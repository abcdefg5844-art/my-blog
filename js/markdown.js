// 마크다운 → HTML 변환기
// 블록 단위로 먼저 나눈 뒤, 각 블록 안의 인라인 문법을 처리한다.
// 원문 HTML은 지원하지 않고 모두 이스케이프한다.

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

// ===== 블록 패턴 =====
const RE_FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^`\s]*)[^`]*$/;
const RE_HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const RE_HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const RE_QUOTE = /^ {0,3}> ?(.*)$/;
const RE_LIST = /^( *)([-*+]|\d{1,9}[.)])([ \t]+)(.*)$/;
const RE_TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;

const isBlank = (line) => line.trim() === '';
const indentOf = (line) => line.match(/^ */)[0].length;

function matchList(line) {
  const m = line.match(RE_LIST);
  if (!m) return null;
  const ordered = /\d/.test(m[2]);
  return {
    indent: m[1].length,
    ordered,
    start: ordered ? parseInt(m[2], 10) : 1,
    contentIndent: m[1].length + m[2].length + Math.min(m[3].length, 4),
    text: m[4],
  };
}

function isBlockStart(line) {
  return RE_FENCE.test(line) || RE_HEADING.test(line) || RE_HR.test(line)
    || RE_QUOTE.test(line) || matchList(line) !== null;
}

function isTableStart(lines, i) {
  return i + 1 < lines.length && lines[i].includes('|') && RE_TABLE_SEP.test(lines[i + 1])
    && lines[i + 1].includes('-');
}

// ===== 제목 id =====
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[`*_~[\]()]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

function uniqueId(text, usedIds) {
  const base = slugify(text) || 'section';
  const count = usedIds.get(base) || 0;
  usedIds.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

// ===== 인라인 =====
function sanitizeUrl(url, { allowImageData = false } = {}) {
  // 브라우저가 무시하는 공백·제어 문자를 지운 뒤 스킴을 검사한다
  const normalized = url.replace(/[\u0000- ]/g, '').toLowerCase();
  if (allowImageData && /^data:image\/(png|gif|jpe?g|webp);/.test(normalized)) return url;
  if (/^(javascript|vbscript|data|file):/.test(normalized)) return '#';
  return url;
}

function isExternal(url) {
  if (!/^https?:\/\//i.test(url)) return false;
  if (typeof location === 'undefined') return true;
  try {
    return new URL(url.replace(/&amp;/g, '&')).host !== location.host;
  } catch {
    return true;
  }
}

function applyEmphasis(text) {
  return text
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\p{L}\p{N}_])__(?=\S)([\s\S]*?\S)__(?![\p{L}\p{N}_])/gu, '$1<strong>$2</strong>')
    .replace(/\*(?=[^\s*])([^*]*?[^\s*])\*/g, '<em>$1</em>')
    .replace(/(^|[^\p{L}\p{N}_])_(?=[^\s_])([^_]*?[^\s_])_(?![\p{L}\p{N}_])/gu, '$1<em>$2</em>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
}

export function renderInline(source) {
  const stash = [];
  const keep = (html) => `\u0000${stash.push(html) - 1}\u0000`;

  let text = source.replace(/\u0000/g, '');

  // 1. 인라인 코드: 안쪽에는 다른 문법을 적용하지 않는다
  text = text.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, __, code) => {
    const trimmed = /^ .* $/.test(code) ? code.slice(1, -1) : code;
    return keep(`<code>${escapeHtml(trimmed)}</code>`);
  });

  // 2. 백슬래시 이스케이프
  text = text.replace(/\\([\\`*_{}[\]()#+\-.!|~>])/g, (_, ch) => keep(escapeHtml(ch)));

  // 3. 나머지 원문 전체 이스케이프
  text = escapeHtml(text);

  // 4. 이미지
  text = text.replace(/!\[([^\]]*)\]\(\s*((?:[^()\s]|\([^()\s]*\))+)(?:\s+&quot;(.*?)&quot;)?\s*\)/g, (_, alt, src, title) => {
    const titleAttr = title ? ` title="${title}"` : '';
    return keep(`<img src="${sanitizeUrl(src, { allowImageData: true })}" alt="${alt}"${titleAttr} loading="lazy">`);
  });

  // 5. 링크 (주소 안의 _ 나 * 가 강조로 바뀌지 않도록 통째로 보관)
  text = text.replace(/\[([^\]]+)\]\(\s*((?:[^()\s]|\([^()\s]*\))+)(?:\s+&quot;(.*?)&quot;)?\s*\)/g, (_, label, href, title) => {
    const safeHref = sanitizeUrl(href);
    const titleAttr = title ? ` title="${title}"` : '';
    const externalAttr = isExternal(safeHref) ? ' target="_blank" rel="noopener noreferrer"' : '';
    return keep(`<a href="${safeHref}"${titleAttr}${externalAttr}>${applyEmphasis(label)}</a>`);
  });

  // 6. 자동 링크 <https://...>
  text = text.replace(/&lt;(https?:\/\/[^\s<>]+?)&gt;/g, (_, url) => {
    const externalAttr = isExternal(url) ? ' target="_blank" rel="noopener noreferrer"' : '';
    return keep(`<a href="${url}"${externalAttr}>${url}</a>`);
  });

  // 7. 강조
  text = applyEmphasis(text);

  // 8. 줄바꿈: 줄 끝 공백 두 칸 또는 백슬래시
  text = text.replace(/(?: {2,}|\\)\n/g, '<br>\n');

  // 보관해 둔 조각 복원 (링크 안의 코드처럼 중첩될 수 있어 반복)
  const restore = /\u0000(\d+)\u0000/g;
  while (restore.test(text)) {
    text = text.replace(restore, (_, index) => stash[Number(index)]);
  }
  return text;
}

// ===== 블록 =====
function parseFence(lines, i) {
  const open = lines[i].match(RE_FENCE);
  const marker = open[1];
  const lang = open[2].replace(/[^\w+-]/g, '');
  const indent = indentOf(lines[i]);
  const body = [];
  i += 1;

  while (i < lines.length) {
    const close = lines[i].match(/^ {0,3}(`{3,}|~{3,})\s*$/);
    if (close && close[1][0] === marker[0] && close[1].length >= marker.length) {
      i += 1;
      break;
    }
    // 여는 펜스만큼 들여쓴 공백은 제거한다
    body.push(lines[i].replace(new RegExp(`^ {0,${indent}}`), ''));
    i += 1;
  }

  const classAttr = lang ? ` class="language-${lang}"` : '';
  const html = `<pre><code${classAttr}>${escapeHtml(body.join('\n'))}${body.length ? '\n' : ''}</code></pre>`;
  return { html, next: i };
}

function parseQuote(lines, i, usedIds) {
  const inner = [];
  while (i < lines.length) {
    const m = lines[i].match(RE_QUOTE);
    if (m) {
      inner.push(m[1]);
    } else if (!isBlank(lines[i]) && inner.length && !isBlank(inner[inner.length - 1]) && !isBlockStart(lines[i])) {
      // 문단이 이어지는 경우 > 없이 써도 인용문에 포함
      inner.push(lines[i]);
    } else {
      break;
    }
    i += 1;
  }
  return { html: `<blockquote>\n${parseBlocks(inner, usedIds)}</blockquote>`, next: i };
}

function parseList(lines, i, usedIds) {
  const first = matchList(lines[i]);
  const { indent: baseIndent, ordered } = first;
  const items = [];
  let current = null;
  let loose = false;

  while (i < lines.length) {
    const line = lines[i];
    const m = matchList(line);

    if (m && m.indent === baseIndent && m.ordered === ordered) {
      current = { lines: [m.text], contentIndent: m.contentIndent };
      items.push(current);
      i += 1;
      continue;
    }

    if (isBlank(line)) {
      // 빈 줄 뒤에도 목록이 이어지는지 미리 확인
      let j = i + 1;
      while (j < lines.length && isBlank(lines[j])) j += 1;
      if (j >= lines.length) break;
      const nextItem = matchList(lines[j]);
      const continues = indentOf(lines[j]) > baseIndent
        || (nextItem && nextItem.indent === baseIndent && nextItem.ordered === ordered);
      if (!continues) break;
      if (nextItem && nextItem.indent === baseIndent) loose = true;
      current.lines.push('');
      i += 1;
      continue;
    }

    if (indentOf(line) > baseIndent) {
      current.lines.push(line.slice(Math.min(indentOf(line), current.contentIndent)));
      i += 1;
      continue;
    }

    // 들여쓰지 않은 이어지는 문장
    const prev = current.lines[current.lines.length - 1];
    if (!isBlockStart(line) && prev !== '' && !matchList(prev)) {
      current.lines.push(line.trim());
      i += 1;
      continue;
    }

    break;
  }

  const body = items.map((item) => {
    const content = item.lines;
    while (content.length && isBlank(content[content.length - 1])) content.pop();

    if (loose || content.some(isBlank)) {
      return `<li>\n${parseBlocks(content, usedIds)}</li>`;
    }

    // 촘촘한 목록: 첫 문단은 <p> 없이 출력
    let split = content.findIndex((line, index) => index > 0 && isBlockStart(line));
    if (split === -1) split = content.length;
    const text = renderInline(content.slice(0, split).join('\n'));
    const rest = split < content.length ? `\n${parseBlocks(content.slice(split), usedIds)}` : '';
    return `<li>${text}${rest}</li>`;
  });

  const tag = ordered ? 'ol' : 'ul';
  const startAttr = ordered && first.start !== 1 ? ` start="${first.start}"` : '';
  return { html: `<${tag}${startAttr}>\n${body.join('\n')}\n</${tag}>`, next: i };
}

function splitRow(line) {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  return row.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function parseTable(lines, i) {
  const headers = splitRow(lines[i]);
  const aligns = splitRow(lines[i + 1]).map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return '';
  });
  const alignAttr = (index) => (aligns[index] ? ` style="text-align: ${aligns[index]}"` : '');

  const head = headers.map((cell, index) => `<th${alignAttr(index)}>${renderInline(cell)}</th>`).join('');
  const rows = [];
  i += 2;
  while (i < lines.length && !isBlank(lines[i]) && lines[i].includes('|')) {
    const cells = splitRow(lines[i]);
    const tds = headers.map((_, index) => `<td${alignAttr(index)}>${renderInline(cells[index] || '')}</td>`);
    rows.push(`<tr>${tds.join('')}</tr>`);
    i += 1;
  }

  const tbody = rows.length ? `\n<tbody>\n${rows.join('\n')}\n</tbody>` : '';
  const html = `<div class="table-wrap"><table>\n<thead>\n<tr>${head}</tr>\n</thead>${tbody}\n</table></div>`;
  return { html, next: i };
}

function parseParagraph(lines, i) {
  const buffer = [];
  while (i < lines.length && !isBlank(lines[i])) {
    if (buffer.length && (isBlockStart(lines[i]) || isTableStart(lines, i))) break;
    buffer.push(lines[i].trimStart());
    i += 1;
  }
  const text = buffer.join('\n').replace(/[ \t]+$/, '');
  return { html: `<p>${renderInline(text)}</p>`, next: i };
}

function parseBlocks(lines, usedIds) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    let result;

    if (isBlank(line)) {
      i += 1;
      continue;
    }

    if (RE_FENCE.test(line)) {
      result = parseFence(lines, i);
    } else if (RE_HEADING.test(line)) {
      const [, hashes, content = ''] = line.match(RE_HEADING);
      const level = hashes.length;
      const id = uniqueId(content, usedIds);
      result = { html: `<h${level} id="${id}">${renderInline(content)}</h${level}>`, next: i + 1 };
    } else if (RE_HR.test(line)) {
      result = { html: '<hr>', next: i + 1 };
    } else if (RE_QUOTE.test(line)) {
      result = parseQuote(lines, i, usedIds);
    } else if (matchList(line)) {
      result = parseList(lines, i, usedIds);
    } else if (isTableStart(lines, i)) {
      result = parseTable(lines, i);
    } else {
      result = parseParagraph(lines, i);
    }

    out.push(result.html);
    i = result.next;
  }

  return out.length ? `${out.join('\n')}\n` : '';
}

/**
 * 마크다운 문자열을 HTML 문자열로 변환한다.
 * @param {string} markdown
 * @returns {string}
 */
export function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  return parseBlocks(lines, new Map());
}
