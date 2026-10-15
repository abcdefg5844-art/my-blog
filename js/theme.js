// 다크/라이트 모드 토글

const STORAGE_KEY = 'theme';
const root = document.documentElement;
const media = window.matchMedia('(prefers-color-scheme: dark)');

function readStoredTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 저장할 수 없어도 현재 화면에는 적용한다
  }
}

function updateButton(button, theme) {
  const isDark = theme === 'dark';
  button.setAttribute('aria-pressed', String(isDark));
  button.setAttribute('aria-label', isDark ? '라이트 모드 켜기' : '다크 모드 켜기');
}

function applyTheme(theme, button) {
  root.setAttribute('data-theme', theme);
  if (button) updateButton(button, theme);
}

export function initTheme() {
  const button = document.querySelector('.theme-toggle');
  const current = root.getAttribute('data-theme') || (media.matches ? 'dark' : 'light');
  applyTheme(current, button);

  button?.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next, button);
    storeTheme(next);
  });

  // 사용자가 직접 고른 적이 없으면 OS 설정 변경을 따라간다
  media.addEventListener('change', (event) => {
    if (readStoredTheme()) return;
    applyTheme(event.matches ? 'dark' : 'light', button);
  });
}
