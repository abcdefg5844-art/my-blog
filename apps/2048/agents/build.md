# Build 서브에이전트 지침 — 2048 게임

## 너의 역할
승인된 계획서 `apps/2048/spec.md`대로 2048 웹앱을 **구현**한다. 검증(Review)은 다른 서브에이전트가 따로 하므로, 너는 구현과 기본적인 자체 확인까지만 한다.

## 먼저 읽을 것
1. `apps/2048/spec.md` — 이 문서가 기준이다. 특히 맨 끝의 "사용자 결정" 절을 따른다.
2. `CLAUDE.md` — 프로젝트 규칙
3. `css/style.css` — 블로그 색상 변수 값(복사해서 쓸 것, import 금지)

## 수정 범위 (이 밖의 파일은 절대 만들거나 고치지 않는다)
만들 파일:
- `apps/2048/index.html`
- `apps/2048/style.css`
- `apps/2048/game.js`
- `apps/2048/main.js`
- `apps/2048/test.html`

금지: `apps/2048/spec.md`, `apps/2048/agents/`, 블로그 파일(`index.html`, `post.html`, `css/`, `js/`, `posts/`), `CLAUDE.md`, `.claude/` 폴더. git 커밋·푸시도 하지 않는다.

## 구현 조건 요약 (상세는 spec.md)
- HTML/CSS/JS만, 외부 라이브러리·CDN 없음, ES 모듈.
- `game.js`는 DOM 없는 순수 함수만 export: `createEmptyBoard`, `slideLine`, `move`, `canMove`, `hasWon`, `emptyCells`, `addRandomTile(board, rng)`, `newGame(rng)`. `rng` 기본값은 `Math.random`.
- `move`는 `{ board, gained, moved }`와 애니메이션용 이동 정보를 함께 돌려준다. 입력 보드는 변경하지 않는다(불변).
- 입력: 방향키, WASD(대소문자), 보드 위 스와이프(최소 30px, 주축 판정). 게임 키는 `preventDefault()`. `.board`에만 `touch-action: none`.
- 점수판: 현재 점수, 최고 점수(`localStorage` 키 `2048-best`, try/catch), `+N` 떠오름 표시.
- 새 게임 버튼, 승리 오버레이(계속하기/새 게임, 같은 게임에서 한 번만), 게임 오버 오버레이(최종 점수, 다시 하기).
- 테마: head 인라인 스크립트로 `localStorage.theme` → OS 설정 순서로 `<html data-theme>` 설정. JS 없을 때 대비 미디어 쿼리. `storage` 이벤트와 OS 설정 변경을 따라감. 앱 안 테마 버튼 없음.
- 타일 색: 블로그 파랑 계열 단계, 2048은 금색 계열 강조, 4096 이상 별도 색. 라이트/다크 모두 글자 대비 WCAG AA.
- 반응형: 최대 폭 480px, 375px 폭에서 가로 스크롤 없음, 낮은 iframe 높이에서도 보드가 잘리지 않음.
- 접근성: spec 6장 그대로(보드 포커스, 오버레이 포커스 이동, `aria-live` 알림, 숨김 보드 설명, `prefers-reduced-motion`).
- `test.html`: `game.js`를 import해 spec 7장의 로직 테스트를 모두 실행하고, 결과(통과/실패, 기대값/실제값)를 표로 보여 준다. 맨 위에 "N개 중 N개 통과" 요약.
- 코드 주석·UI 문구는 한국어, 들여쓰기 2칸, 세미콜론, 작은따옴표.

## 자체 확인 (끝내기 전에)
- Node가 있으면 `game.js`의 순수 함수를 Node로 간단히 실행해 spec 7장의 `slideLine` 예시가 맞는지 확인한다(파일을 남기지 말 것. 임시 파일이 필요하면 프로젝트 밖 임시 폴더에 둔다).
- 수정 범위 밖 파일을 건드리지 않았는지 `git status`로 확인한다.

## 보고
만든 파일 목록, 자체 확인 결과, spec과 다르게 한 점(있다면 이유)을 한국어로 짧게 보고한다.
