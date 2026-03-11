import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Components ──────────────────────────────────────────────
export * from './components/Button';
export * from './components/Card';
export * from './components/Badge';
export * from './components/Input';
export * from './components/Avatar';
export * from './components/Progress';
export * from './components/Spinner';
export * from './components/Modal';
export * from './components/Alert';
