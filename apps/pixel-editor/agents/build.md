# Build 서브에이전트 지침 — 픽셀 아트 에디터

## 너의 역할
승인된 계획서 `apps/pixel-editor/spec.md`대로 픽셀 아트 에디터를 **구현**한다. 검증(Review)은 다른 서브에이전트가 따로 하므로, 너는 구현과 기본적인 자체 확인까지만 한다.

## 먼저 읽을 것
1. `apps/pixel-editor/spec.md` — 기준 문서. 특히 "사용자 결정 (2026-10-15 승인)" 절이 10장의 제안보다 우선한다.
2. `CLAUDE.md` — 프로젝트 규칙
3. `css/style.css` — 블로그 색상 변수 값(복사해서 쓸 것, import 금지)
4. 참고: `apps/2048/`의 코드와 `apps/2048/review.md` — 같은 블로그의 이전 웹앱. 테마 동기화(head 인라인 스크립트, `storage` 이벤트), iframe 크기 대응(`.board-area` + 컨테이너 쿼리), 오버레이/알림 처리에서 Review가 지적했던 점을 처음부터 반영한다. 코드를 import하지는 않는다.

## 수정 범위 (이 밖의 파일은 절대 만들거나 고치지 않는다)
만들 파일: spec.md 4장 "파일 구조"에 적힌 `apps/pixel-editor/` 안의 파일
(`index.html`, `style.css`, `editor.js`, `main.js`, `test.html` 등 spec에 적힌 것만)

금지: `apps/pixel-editor/spec.md`, `apps/pixel-editor/agents/`, `apps/2048/`, 블로그 파일(`index.html`, `post.html`, `css/`, `js/`, `posts/`), `CLAUDE.md`, `.claude/`. git 커밋·푸시도 하지 않는다.

## 핵심 조건 (상세는 spec.md)
- HTML/CSS/JS만, 외부 라이브러리·CDN 없음, ES 모듈.
- `editor.js`는 DOM 없는 순수 함수만(spec 3장 함수 목록 그대로), 입력 배열 불변.
- PNG는 `pixelsToRGBA` + `putImageData` + `toBlob`으로 만든다(테마·CSS 무관, 스무딩 없음). 투명 배경, 배율 1/8/16/32×(기본 16×), 파일 이름 `pixel-art-YYYYMMDD-HHmmss.png`.
- 드래그 연속 칠하기는 `cellsOnLine` 보간 + `getCoalescedEvents`. 보드에만 `touch-action: none`, 보드 `contextmenu` 막기, 다른 포인터 무시.
- 스포이트·전체 지우기 확인 창·흰 배경 옵션은 넣지 않는다.
- 접근성·키보드 조작·`aria-live`·`prefers-reduced-motion`은 spec 6장 그대로.
- 375px 폭 가로 스크롤 없음, 카드 iframe(모바일 약 300×440, 데스크톱 약 634×520)과 더 작은 iframe에서도 잘림 없음.
- `test.html`: `editor.js`의 spec 7장 로직 테스트를 모두 실행해 표로 보여 주고 맨 위에 "N개 중 N개 통과" 요약.
- 코드 주석·UI 문구는 한국어, 들여쓰기 2칸, 세미콜론, 작은따옴표. 사용자 입력이나 저장 데이터를 `innerHTML`로 넣지 않는다.

## 자체 확인
- `node --check`로 JS 문법 확인, `test.html`의 로직 테스트를 Node로 실행해 모두 통과하는지 확인(임시 파일은 프로젝트 밖에 두고 지울 것).
- `git status`로 범위 밖 파일을 건드리지 않았는지 확인.

## 보고
만든 파일, 자체 확인 결과, spec과 다르게 한 점(이유)을 한국어로 짧게 보고한다.
