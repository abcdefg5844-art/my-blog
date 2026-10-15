---
title: 오늘 배운 것
date: 2026-10-15
tags: [HTML, CSS, JavaScript, 회고]
description: 클로드 코드로 블로그를 만들면서 알게 된 HTML, CSS, JavaScript의 역할을 정리했습니다.
---

오늘은 클로드 코드와 함께 프레임워크 없이 이 블로그를 만들었습니다. 만들면서 웹페이지를 이루는 세 가지 기술이 각각 무슨 일을 하는지 조금 더 분명하게 알게 되어 정리해 둡니다.

## 한 줄 요약

| 기술 | 역할 | 비유 |
|:-----|:-----|:-----|
| HTML | 내용과 구조 | 집의 뼈대 |
| CSS | 모양과 배치 | 인테리어 |
| JavaScript | 동작과 데이터 처리 | 전기와 배선 |

## HTML: 무엇이 있는가

HTML은 페이지에 **어떤 내용이 어떤 순서로** 있는지 정합니다.

- `<header>`, `<main>`, `<article>`, `<footer>` 같은 태그로 페이지의 영역을 나눕니다.
- 의미에 맞는 태그를 쓰면 화면 낭독기 같은 보조 기술도 페이지를 잘 이해합니다.
- 이 블로그에서는 `index.html`(글 목록)과 `post.html`(글 본문) 두 개의 뼈대만 만들고, 글 내용은 비워 두었습니다.

## CSS: 어떻게 보이는가

CSS는 같은 HTML을 **어떻게 보여줄지** 정합니다.

- 색상을 `--bg`, `--text` 같은 **변수**로 모아 두니, 다크 모드는 변수 값만 바꾸면 끝났습니다.
- 본문 폭을 약 70글자로 제한하고 줄 간격을 넉넉히 주면 글이 훨씬 읽기 편해집니다.
- 작은 화면을 기준으로 먼저 만들고 `@media (min-width: 640px)`로 넓은 화면을 다듬으면 모바일 대응이 자연스럽습니다.

```css
:root { --bg: #ffffff; --text: #1f2328; }
:root[data-theme="dark"] { --bg: #16171a; --text: #e6e6e6; }
body { background: var(--bg); color: var(--text); }
```

## JavaScript: 무엇을 하는가

JavaScript는 페이지가 **움직이고 데이터를 다루게** 합니다.

1. `fetch`로 `posts/` 폴더의 마크다운 파일을 불러옵니다.
2. 직접 만든 변환기로 마크다운을 HTML로 바꿔 화면에 넣습니다.
3. 다크 모드 버튼을 누르면 테마를 바꾸고, 선택을 `localStorage`에 저장합니다.

```js
const response = await fetch('posts/welcome.md');
const markdown = await response.text();
document.getElementById('post-body').innerHTML = markdownToHtml(markdown);
```

## 덤으로 배운 것

- 브라우저는 폴더 안의 파일 목록을 직접 읽지 못해서 `index.json`에 글 목록을 적어 둡니다.
- `fetch`는 파일을 더블클릭해서 열면(`file://`) 동작하지 않아 로컬 서버가 필요합니다.
- 사용자가 쓴 내용을 화면에 넣을 때는 HTML 특수문자를 이스케이프해야 `<script>` 같은 코드가 실행되지 않습니다.

> 세 기술이 각자 맡은 일만 잘하도록 나누어 두면, 고칠 곳을 찾기도 쉽고 코드도 깔끔해진다.

다음에는 글 검색이나 태그별 모아보기를 만들어 보고 싶습니다.
