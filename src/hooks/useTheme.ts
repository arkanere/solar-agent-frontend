import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

/** The Svelte app's key, so a session carries across the two implementations. */
const THEME_KEY = 'theme';

function preferredTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  // No stored choice: follow the operating system rather than guessing.
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Light/dark, as a `.dark` class on `<html>` — the same mechanism the Svelte app
 * uses, and what `index.css` and shadcn's `dark:` utilities both key off.
 *
 * An explicit choice is remembered and wins from then on. Until one is made the
 * system preference is followed live, so a customer whose machine switches to
 * dark at sunset gets a dark widget without touching anything.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(preferredTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return;

    const follow = (event: MediaQueryListEvent) => {
      // A stored choice is the customer's, and outranks the system.
      if (localStorage.getItem(THEME_KEY)) return;
      setTheme(event.matches ? 'dark' : 'light');
    };
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_KEY, next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
