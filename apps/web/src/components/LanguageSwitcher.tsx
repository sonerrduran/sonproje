'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  direction: 'ltr' | 'rtl';
}

const LANGUAGES: Language[] = [
  { code: 'en', name: 'English',    nativeName: 'English',    flag: '🇬🇧', direction: 'ltr' },
  { code: 'tr', name: 'Turkish',    nativeName: 'Türkçe',     flag: '🇹🇷', direction: 'ltr' },
  { code: 'es', name: 'Spanish',    nativeName: 'Español',    flag: '🇪🇸', direction: 'ltr' },
  { code: 'fr', name: 'French',     nativeName: 'Français',   flag: '🇫🇷', direction: 'ltr' },
  { code: 'de', name: 'German',     nativeName: 'Deutsch',    flag: '🇩🇪', direction: 'ltr' },
  { code: 'ar', name: 'Arabic',     nativeName: 'العربية',    flag: '🇸🇦', direction: 'rtl' },
  { code: 'zh', name: 'Chinese',    nativeName: '中文',        flag: '🇨🇳', direction: 'ltr' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português',  flag: '🇧🇷', direction: 'ltr' },
  { code: 'ru', name: 'Russian',    nativeName: 'Русский',    flag: '🇷🇺', direction: 'ltr' },
  { code: 'hi', name: 'Hindi',      nativeName: 'हिन्दी',       flag: '🇮🇳', direction: 'ltr' },
];

interface LanguageSwitcherProps {
  /** Display mode */
  variant?: 'dropdown' | 'compact';
  /** Callback after language change */
  onLanguageChange?: (code: string) => void;
}

export function LanguageSwitcher({
  variant = 'dropdown',
  onLanguageChange,
}: LanguageSwitcherProps) {
  const t = useTranslations('settings');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLang = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (lang: Language) => {
    setOpen(false);

    // Update html lang & dir attributes for proper RTL support
    document.documentElement.lang = lang.code;
    document.documentElement.dir = lang.direction;

    // Save preference to localStorage and cookie
    localStorage.setItem('preferred-locale', lang.code);
    document.cookie = `NEXT_LOCALE=${lang.code};path=/;max-age=31536000`;

    // Navigate to new locale path
    const newPath = pathname.replace(`/${locale}`, `/${lang.code}`);
    router.push(newPath !== pathname ? newPath : pathname);
    router.refresh();

    onLanguageChange?.(lang.code);
  };

  if (variant === 'compact') {
    return (
      <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
        <button
          id="language-switcher-compact"
          onClick={() => setOpen(!open)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '6px 10px',
            cursor: 'pointer',
            color: 'inherit',
            fontSize: '14px',
          }}
          aria-label={t('selectLanguage')}
          aria-expanded={open}
        >
          <span>{currentLang.flag}</span>
          <span>{currentLang.code.toUpperCase()}</span>
          <span style={{ fontSize: '10px', opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
        </button>
        {open && <LanguageMenu languages={LANGUAGES} onSelect={handleSelect} currentCode={locale} />}
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        id="language-switcher-dropdown"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '10px',
          padding: '10px 14px',
          cursor: 'pointer',
          color: 'inherit',
          fontSize: '14px',
          transition: 'background 0.2s',
        }}
        aria-label={t('selectLanguage')}
        aria-expanded={open}
      >
        <span style={{ fontSize: '20px' }}>{currentLang.flag}</span>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontWeight: 600 }}>{currentLang.nativeName}</div>
          <div style={{ fontSize: '12px', opacity: 0.6 }}>{currentLang.name}</div>
        </div>
        <span style={{ opacity: 0.5 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <LanguageMenu languages={LANGUAGES} onSelect={handleSelect} currentCode={locale} />}
    </div>
  );
}

function LanguageMenu({
  languages,
  onSelect,
  currentCode,
}: {
  languages: Language[];
  onSelect: (l: Language) => void;
  currentCode: string;
}) {
  return (
    <div
      role="listbox"
      aria-label="Language options"
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        zIndex: 1000,
        background: '#1e1e2e',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '12px',
        padding: '8px',
        minWidth: '200px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(20px)',
        animation: 'dropdownOpen 0.15s ease-out',
      }}
    >
      {languages.map((lang) => (
        <button
          key={lang.code}
          role="option"
          aria-selected={lang.code === currentCode}
          onClick={() => onSelect(lang)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
            background: lang.code === currentCode ? 'rgba(139,92,246,0.2)' : 'none',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 10px',
            cursor: 'pointer',
            color: 'inherit',
            fontSize: '14px',
            transition: 'background 0.15s',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            if (lang.code !== currentCode)
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
          }}
          onMouseLeave={(e) => {
            if (lang.code !== currentCode)
              (e.currentTarget as HTMLElement).style.background = 'none';
          }}
        >
          <span style={{ fontSize: '20px' }}>{lang.flag}</span>
          <div>
            <div style={{ fontWeight: lang.code === currentCode ? 600 : 400 }}>
              {lang.nativeName}
            </div>
            <div style={{ fontSize: '11px', opacity: 0.5 }}>{lang.name}</div>
          </div>
          {lang.code === currentCode && (
            <span style={{ marginLeft: 'auto', color: '#8b5cf6' }}>✓</span>
          )}
        </button>
      ))}
    </div>
  );
}
