'use client';

import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'mfd.theme';

/** Script inline (no <head>) que aplica o tema antes da pintura, evitando "piscar". */
export const themeBootScript = `(function(){try{var t=localStorage.getItem('${KEY}');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}})();`;

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    setThemeState((document.documentElement.dataset.theme as Theme) ?? 'light');
    const obs = new MutationObserver(() => setThemeState(document.documentElement.dataset.theme as Theme));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const setTheme = (t: Theme) => {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem(KEY, t);
    } catch {}
  };

  return { theme, setTheme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') };
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      onClick={toggle}
      title={dark ? 'Tema claro' : 'Tema escuro'}
      aria-label={dark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      className={`relative flex h-8 w-14 items-center rounded-full border border-line bg-surface-2 p-0.5 transition ${className}`}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full bg-surface text-ink shadow-soft transition-transform duration-300 ${dark ? 'translate-x-6' : ''}`}
      >
        {dark ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        )}
      </span>
    </button>
  );
}
