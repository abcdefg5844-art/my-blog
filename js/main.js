// 진입점: 페이지 종류(body[data-page])에 따라 목록 또는 글 상세를 그린다

import { initTheme } from './theme.js';
import { parseFrontmatter } from './frontmatter.js';
import { markdownToHtml } from './markdown.js';

const SITE_NAME = '나의 블로그';
const POSTS_DIR = 'posts/';
const SLUG_PATTERN = /^[a-z0-9-]+$/;
const SUMMARY_LENGTH = 120;

async function fetchText(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.text();
}

function toSlug(filename) {
  return filename.replace(/\.md$/, '');
}

function formatDate(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(value || '');
  return `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일`;
}

function toList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

// description이 없을 때 본문 첫 문단으로 요약을 만든다
function makeSummary(body) {
  const paragraph = body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .find((block) => block && !/^(#|```|~~~|>|[-*+] |\d+\. |\||!\[)/.test(block));
  if (!paragraph) return '';

  const plain = paragraph
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > SUMMARY_LENGTH ? `${plain.slice(0, SUMMARY_LENGTH).trimEnd()}…` : plain;
}

function setStatus(message) {
  const status = document.getElementById('status');
  if (!status) return;
  status.textContent = message;
  status.hidden = !message;
}

function createMeta(meta) {
  const wrap = document.createElement('div');
  wrap.className = 'post-meta';

  if (meta.date) {
    const time = document.createElement('time');
    time.dateTime = String(meta.date);
    time.textContent = formatDate(meta.date);
    wrap.append(time);
  }

  const tags = toList(meta.tags);
  if (tags.length) {
    const list = document.createElement('ul');
    list.className = 'tags';
    list.setAttribute('aria-label', '태그');
    for (const tag of tags) {
      const item = document.createElement('li');
      item.className = 'tag';
      item.textContent = tag;
      list.append(item);
    }
    wrap.append(list);
  }

  return wrap;
}

// ===== 글 목록 =====
async function renderList() {
  const listEl = document.getElementById('post-list');

  let files;
  try {
    files = JSON.parse(await fetchText(`${POSTS_DIR}index.json`));
    if (!Array.isArray(files)) throw new Error('index.json은 배열이어야 합니다');
  } catch (error) {
    console.error(error);
    setStatus('글 목록을 불러오지 못했습니다.');
    return;
  }

  const results = await Promise.allSettled(
    files
      .filter((file) => typeof file === 'string' && SLUG_PATTERN.test(toSlug(file)))
      .map(async (file) => {
        const { meta, body } = parseFrontmatter(await fetchText(POSTS_DIR + file));
        return { slug: toSlug(file), meta, summary: meta.description || makeSummary(body) };
      }),
  );

  const posts = [];
  for (const result of results) {
    if (result.status === 'fulfilled') posts.push(result.value);
    else console.error(result.reason);
  }

  posts.sort((a, b) => String(b.meta.date || '').localeCompare(String(a.meta.date || '')));

  if (!posts.length) {
    setStatus('아직 작성된 글이 없습니다.');
    return;
  }

  for (const post of posts) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'post-card';
    link.href = `post.html?slug=${encodeURIComponent(post.slug)}`;

    const title = document.createElement('h2');
    title.textContent = post.meta.title || post.slug;
    link.append(title, createMeta(post.meta));

    if (post.summary) {
      const summary = document.createElement('p');
      summary.textContent = post.summary;
      link.append(summary);
    }

    item.append(link);
    listEl.append(item);
  }

  setStatus('');
}

// ===== 글 상세 =====
async function renderPost() {
  const slug = new URLSearchParams(location.search).get('slug') || '';

  if (!SLUG_PATTERN.test(slug)) {
    showNotFound();
    return;
  }

  let source;
  try {
    source = await fetchText(`${POSTS_DIR}${slug}.md`);
  } catch (error) {
    console.error(error);
    showNotFound();
    return;
  }

  const { meta, body } = parseFrontmatter(source);
  const title = meta.title || slug;

  document.title = `${title} | ${SITE_NAME}`;
  document.getElementById('post-title').textContent = title;
  document.getElementById('post-meta').replaceWith(createMeta(meta));
  document.getElementById('post-header').hidden = false;
  // markdownToHtml은 원문을 이스케이프한 뒤 변환하므로 innerHTML에 넣어도 안전하다
  document.getElementById('post-body').innerHTML = markdownToHtml(body);

  setStatus('');

  // 주소에 #제목 앵커가 있으면 렌더링 후 그 위치로 이동
  if (location.hash) {
    document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  }
}

function showNotFound() {
  document.title = `글을 찾을 수 없습니다 | ${SITE_NAME}`;
  document.getElementById('post').hidden = true;
  setStatus('글을 찾을 수 없습니다. 주소를 확인하거나 목록으로 돌아가 주세요.');
}

initTheme();

const page = document.body.dataset.page;
if (page === 'list') renderList();
else if (page === 'post') renderPost();
