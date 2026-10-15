// 글 상단의 --- 블록(프런트매터)을 읽는다

function parseValue(raw) {
  const value = raw.trim();

  // [a, b, c] 형태의 배열
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((item) => stripQuotes(item.trim()))
      .filter(Boolean);
  }

  return stripQuotes(value);
}

function stripQuotes(value) {
  if (value.length >= 2 && /^(['"]).*\1$/.test(value)) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * @param {string} source 마크다운 원문
 * @returns {{ meta: Record<string, string | string[]>, body: string }}
 */
export function parseFrontmatter(source) {
  const text = source.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);

  if (!match) {
    return { meta: {}, body: text };
  }

  const meta = {};
  for (const line of match[1].split('\n')) {
    const index = line.indexOf(':');
    if (index === -1 || line.trim().startsWith('#')) continue;
    const key = line.slice(0, index).trim();
    if (key) meta[key] = parseValue(line.slice(index + 1));
  }

  return { meta, body: text.slice(match[0].length) };
}
