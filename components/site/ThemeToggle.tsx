'use client';

import { useSyncExternalStore } from 'react';
import styles from './site.module.css';

type Mode = 'system' | 'light' | 'dark';

const ORDER: Mode[] = ['system', 'light', 'dark'];
const LABEL: Record<Mode, string> = { system: 'System', light: 'Light', dark: 'Dark' };
const GLYPH: Record<Mode, string> = { system: '◐', light: '☀', dark: '☾' };

const STORAGE_KEY = 'oddments-theme';
const listeners = new Set<() => void>();

function readMode(): Mode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  if (typeof window !== 'undefined') window.addEventListener('storage', callback);
  return () => {
    listeners.delete(callback);
    if (typeof window !== 'undefined') window.removeEventListener('storage', callback);
  };
}

function getServerSnapshot(): Mode {
  return 'system';
}

function applyMode(mode: Mode): void {
  const el = document.documentElement;
  try {
    if (mode === 'system') {
      el.removeAttribute('data-theme');
      localStorage.removeItem(STORAGE_KEY);
    } else {
      el.setAttribute('data-theme', mode);
      localStorage.setItem(STORAGE_KEY, mode);
    }
  } catch {
    if (mode === 'system') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', mode);
  }
  listeners.forEach((listener) => listener());
}

export function ThemeToggle() {
  const mode = useSyncExternalStore(subscribe, readMode, getServerSnapshot);

  const cycle = () => {
    applyMode(ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length] ?? 'system');
  };

  return (
    <button
      type="button"
      className={styles.themeToggle}
      onClick={cycle}
      aria-label={`Theme: ${LABEL[mode]}. Activate to change.`}
      title={`Theme: ${LABEL[mode]}`}
    >
      <span aria-hidden="true">{GLYPH[mode]}</span>
    </button>
  );
}
