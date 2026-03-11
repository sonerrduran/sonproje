import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => {
  // Validate that the locale is supported
  const supportedLocales = ['en', 'tr', 'es', 'fr', 'de', 'ar', 'zh', 'pt', 'ru', 'hi'];
  const safeLocale = supportedLocales.includes(locale ?? '') ? locale! : 'en';

  return {
    locale: safeLocale,
    messages: (await import(`../messages/${safeLocale}.json`)).default,
    timeZone: 'UTC',
    now: new Date(),
  };
});
