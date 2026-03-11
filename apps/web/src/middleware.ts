import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  // Supported locales
  locales: ['en', 'tr', 'es', 'fr', 'de', 'ar', 'zh', 'pt', 'ru', 'hi'],

  // Default locale (fallback)
  defaultLocale: 'en',

  // Locale detection strategy
  localeDetection: true,

  // Locale prefix strategy: 'always' | 'as-needed' | 'never'
  // 'as-needed' means /en/* is not prefixed but /tr/* is
  localePrefix: 'as-needed',
});

export const config = {
  // Match all request paths except for:
  // - API routes
  // - _next static files
  // - favicon.ico
  // - images
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
