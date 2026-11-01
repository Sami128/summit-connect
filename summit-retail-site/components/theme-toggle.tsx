'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';

const STORAGE_KEY = 'summit-theme';
const CHANGE_EVENT = 'summit-theme-change';

function applyTheme(dark: boolean) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#101a17' : '#087f69');
}

function subscribe(onChange: () => void) {
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const preference = () => {
    let stored: string | null = null;
    try { stored = window.localStorage.getItem(STORAGE_KEY); } catch { /* Storage is optional. */ }
    applyTheme(stored === 'dark' || (stored !== 'light' && system.matches));
    onChange();
  };
  const storage = (event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === null) preference(); };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', storage);
  system.addEventListener('change', preference);
  // Synchronize browser chrome after Next.js has rendered its metadata.
  applyTheme(document.documentElement.dataset.theme === 'dark');
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', storage);
    system.removeEventListener('change', preference);
  };
}

export default function ThemeToggle({ floating = false }: { floating?: boolean }) {
  const dark = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme === 'dark', () => false);
  const label = dark ? 'Switch to light theme' : 'Switch to dark theme';

  function toggle() {
    const next = document.documentElement.dataset.theme !== 'dark';
    applyTheme(next);
    try { window.localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light'); } catch { /* Keep working without persistence. */ }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return <button type="button" className={'theme-toggle' + (floating ? ' theme-toggle-floating' : '')} aria-label={label} aria-pressed={dark} title={label} onClick={toggle}>
    <Moon className="theme-moon" size={18} strokeWidth={1.8} />
    <Sun className="theme-sun" size={18} strokeWidth={1.8} />
  </button>;
}
