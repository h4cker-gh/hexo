import { useCallback, useEffect, useState } from 'react';

import { THEME_STORAGE_KEY, type Theme } from '@/config';

function isTheme(value: string | null): value is Theme {
  return value === 'dark' || value === 'light' || value === 'h4cker';
}

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    /* localStorage can be unavailable (private mode, embedded webviews) */
  }
  return 'dark';
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'light' ? '#f4f6fb' : '#0a0c12');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore persistence failures */
    }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);

  return [theme, setTheme];
}
