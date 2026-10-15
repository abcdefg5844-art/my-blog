# CLAUDE.md

이 파일은 이 저장소에서 작업하는 Claude Code에게 프로젝트의 목적, 구조, 규칙을 안내합니다.

## 프로젝트 개요

마크다운(`.md`) 파일로 작성한 글을 읽어서 블로그 웹사이트로 보여주는 정적 사이트입니다.

- **프레임워크·빌드 도구 없음**: 순수 HTML, CSS, JavaScript(ES 모듈)만 사용합니다.
  React, Vue, Tailwind, Bootstrap, jQuery, 번들러(Vite, Webpack 등)를 도입하지 마세요.
- **npm 의존성 없음**: `package.json`을 만들지 않습니다. 마크다운 파서도 직접 구현합니다.
- **디자인 목표**: 깔끔하고 읽기 좋은 타이포그래피, 다크 모드 지원, 모바일 우선 반응형.

## 디렉터리 구조

```
my-blog/
├── index.html          # 글 목록(홈) 페이지
├── post.html           # 글 상세 페이지 (?slug=파일명 으로 글 지정)
├── css/
│   └── style.css       # 전체 스타일 (테마 변수, 레이아웃, 본문 타이포그래피)
├── js/
│   ├── main.js         # 진입점: 페이지 종류에 따라 목록/상세 렌더링
│   ├── markdown.js     # 마크다운 → HTML 변환기 (직접 구현)
│   ├── frontmatter.js  # 글 상단 메타데이터 파싱
│   └── theme.js        # 다크/라이트 모드 토글
└── posts/
    ├── index.json      # 글 목록 매니페스트 (파일명 배열)
    └── *.md            # 블로그 글
```

## 동작 방식

1. `index.html`은 `posts/index.json`을 `fetch`해서 글 파일 목록을 얻습니다.
   (브라우저는 디렉터리 내용을 직접 읽을 수 없으므로 매니페스트가 필요합니다.)
2. 각 `.md` 파일을 `fetch`해 프런트매터(제목, 날짜, 태그, 요약)를 읽고, 날짜 내림차순으로 카드 목록을 그립니다.
3. 글을 클릭하면 `post.html?slug=파일명`으로 이동하고, 해당 파일을 받아 `markdown.js`로 HTML 변환 후 본문에 삽입합니다.

### 새 글 추가 절차

1. `posts/`에 `my-new-post.md` 파일을 만듭니다 (파일명 = slug, 영문 소문자·숫자·하이픈).
2. `posts/index.json` 배열에 `"my-new-post.md"`를 추가합니다.

### 글 파일 형식

```markdown
---
title: 글 제목
date: 2026-10-15
tags: [javascript, css]
description: 목록에 보일 한두 줄 요약
---

# 본문 시작
```

- `title`, `date`는 필수. `tags`, `description`은 선택.
- `description`이 없으면 본문 첫 문단에서 앞부분을 잘라 요약으로 씁니다.

## 마크다운 변환기 (`js/markdown.js`)

지원해야 하는 문법:

- 제목 `#` ~ `######`, 문단, 줄바꿈
- **굵게**, *기울임*, ~~취소선~~, `인라인 코드`
- 링크 `[텍스트](url)`, 이미지 `![alt](src)`
- 순서 있는/없는 목록 (중첩 포함), 인용문 `>`
- 코드 블록 (```` ```언어 ````) — `<pre><code class="language-xxx">`로 출력
- 수평선 `---`, 표(GFM 테이블)

규칙:

- **보안**: 변환 전에 원문의 HTML 특수문자(`& < > " '`)를 이스케이프합니다. 코드 블록 내용은 반드시 이스케이프하고 인라인 문법을 적용하지 않습니다. `javascript:` 링크는 막습니다.
- 블록 단위 파싱 → 인라인 파싱 순서로 처리합니다. 정규식 하나로 전부 처리하려 하지 마세요.
- 제목에는 `id`를 붙여(슬러그화, 한글 유지) 앵커 링크가 가능하게 합니다.
- 외부 링크(`http`로 시작, 다른 도메인)에는 `target="_blank" rel="noopener noreferrer"`를 붙입니다.

## 디자인 가이드

### 테마와 다크 모드

- 모든 색상은 `:root`의 CSS 사용자 정의 속성(변수)으로만 정의합니다. 컴포넌트에 색상 값을 직접 쓰지 마세요.
- 다크 모드 적용 우선순위:
  1. 사용자가 토글로 고른 값 (`localStorage`의 `theme` 키, `light` | `dark`)
  2. 없으면 OS 설정 `prefers-color-scheme`
- `<html data-theme="dark">` 속성으로 테마를 전환합니다.
- **깜빡임 방지**: 테마 결정 스크립트는 `<head>` 안에 인라인으로 넣어 CSS 로드 전에 실행합니다.
- `localStorage` 접근은 `try/catch`로 감쌉니다 (사생활 보호 모드 대비).
- 다크 모드는 순수 검정(`#000`) 대신 약간 밝은 배경(예: `#121212`~`#1a1b1e`)과 살짝 낮춘 흰색 글자를 씁니다.

변수 예시:

```css
:root {
  --bg: #ffffff;
  --text: #1f2328;
  --text-muted: #656d76;
  --accent: #2563eb;
  --border: #e5e7eb;
  --code-bg: #f6f8fa;
}
:root[data-theme="dark"] {
  --bg: #16171a;
  --text: #e6e6e6;
  --text-muted: #9aa0a6;
  --accent: #60a5fa;
  --border: #2d2f34;
  --code-bg: #1f2125;
}
```

### 타이포그래피 (가독성 최우선)

- 본문 폭: `max-width: 70ch` 안팎 (약 680–720px), 가운데 정렬.
- 본문 글자 크기 `1.0625rem`~`1.125rem`, 줄 간격 `1.7`~`1.8` (한글 기준).
- 글꼴: 시스템 글꼴 스택 우선 — `Pretendard`(선택적 웹폰트), `-apple-system`, `"Apple SD Gothic Neo"`, `"Malgun Gothic"`, `sans-serif`.
- 코드: `ui-monospace, "SF Mono", Consolas, monospace`.
- `word-break: keep-all`로 한글 단어가 중간에 끊기지 않게 합니다.
- 문단·제목 간 여백을 넉넉하게. 장식은 최소화.

### 반응형 / 모바일

- **모바일 우선**으로 작성하고 `min-width` 미디어 쿼리로 확장합니다. 기준점 예: `640px`, `1024px`.
- 화면 좌우 여백은 모바일에서 최소 `16px`.
- 가로 스크롤 금지: 이미지는 `max-width: 100%; height: auto`, 코드 블록과 표는 자체 `overflow-x: auto`.
- 터치 대상(버튼, 링크)은 최소 `44×44px`.
- `<meta name="viewport" content="width=device-width, initial-scale=1">`를 모든 HTML에 넣습니다.

### 접근성

- 시맨틱 태그 사용: `<header>`, `<main>`, `<article>`, `<nav>`, `<footer>`, `<time datetime="">`.
- 텍스트 대비 WCAG AA(4.5:1) 이상을 라이트/다크 양쪽에서 유지합니다.
- 테마 토글 버튼에 `aria-label`과 현재 상태(`aria-pressed`)를 제공합니다.
- 키보드 포커스가 보이도록 `:focus-visible` 스타일을 지정합니다.
- `prefers-reduced-motion`이면 전환 애니메이션을 끕니다.

## 코딩 규칙

- JavaScript는 ES 모듈(`<script type="module">`)과 `const`/`let`, `async/await`를 씁니다. 전역 변수를 만들지 않습니다.
- DOM에 사용자 데이터(제목, 태그 등)를 넣을 때는 `textContent`를 사용합니다. `innerHTML`은 이스케이프를 거친 마크다운 변환 결과에만 씁니다.
- `fetch` 실패(파일 없음, 잘못된 slug)는 사용자에게 "글을 찾을 수 없습니다" 같은 안내를 보여줍니다.
- 들여쓰기 2칸, 세미콜론 사용, 작은따옴표.
- 주석과 UI 문구는 한국어로 작성합니다.

## 로컬 실행

`fetch`는 `file://`에서 동작하지 않으므로 로컬 서버로 열어야 합니다. 아래 중 하나를 사용하세요.

```bash
python -m http.server 8000
```

```bash
npx serve .
```

그 다음 브라우저에서 `http://localhost:8000`을 엽니다.

## 확인 체크리스트

변경 후 다음을 확인합니다.

- [ ] 라이트/다크 모드 양쪽에서 글 목록과 본문(코드 블록, 표, 인용문 포함)이 잘 보이는가
- [ ] 새로고침 시 테마가 깜빡이지 않는가
- [ ] 375px 폭(모바일)에서 가로 스크롤이 생기지 않는가
- [ ] 존재하지 않는 slug로 접근하면 안내 메시지가 나오는가
- [ ] 마크다운에 `<script>`를 넣어도 실행되지 않는가
