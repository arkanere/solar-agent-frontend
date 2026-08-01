import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from '@/hooks/useTheme';

type Listener = (event: MediaQueryListEvent) => void;

/** A controllable `prefers-color-scheme` — jsdom's matchMedia does not exist. */
function stubMatchMedia(prefersDark: boolean) {
  const listeners = new Set<Listener>();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: prefersDark,
      addEventListener: (_type: string, fn: Listener) => listeners.add(fn),
      removeEventListener: (_type: string, fn: Listener) => listeners.delete(fn),
    })),
  );
  return {
    change: (dark: boolean) =>
      listeners.forEach((fn) => fn({ matches: dark } as MediaQueryListEvent)),
  };
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

afterEach(() => vi.unstubAllGlobals());

describe('useTheme', () => {
  it('follows the system preference when nothing has been chosen', () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('keeps following the system while no choice has been made', () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');

    act(() => media.change(true));
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('remembers an explicit choice and stops following the system', () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggle());
    expect(result.current.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');

    // The customer has spoken; sunset on their machine does not overrule them.
    act(() => media.change(false));
    expect(result.current.theme).toBe('dark');
  });

  it('restores a stored choice over the system preference', () => {
    localStorage.setItem('theme', 'light');
    stubMatchMedia(true);
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });
});
