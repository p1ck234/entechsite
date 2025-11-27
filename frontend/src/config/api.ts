// API Configuration
// Определяем API URL динамически, чтобы он работал и в production

function getApiUrl(): string {
  // 1. Проверяем переменную окружения (устанавливается при сборке)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // 2. Проверяем, есть ли API URL в window (можно установить через скрипт)
  if (typeof window !== 'undefined' && (window as any).__API_URL__) {
    return (window as any).__API_URL__;
  }

  // 3. Определяем по текущему домену
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  
  // Если это production домен
  if (hostname.includes('railway.app') || hostname.includes('entech.p1ck23.ru') || hostname.includes('p1ck23.ru')) {
    // Всегда используем backend URL на Railway
    return 'https://entechsite-backend-production.up.railway.app/api';
  }
  
  // Если открыто через Telegram (t.me или web.telegram.org)
  if (typeof window !== 'undefined') {
    const referrer = document.referrer;
    if (referrer.includes('t.me') || referrer.includes('telegram.org')) {
      return 'https://entechsite-backend-production.up.railway.app/api';
    }
  }

  // 4. По умолчанию для разработки
  return 'http://localhost:3001/api';
}

export const API_BASE_URL = getApiUrl();

console.log('🔗 API Configuration:', {
  VITE_API_URL: import.meta.env.VITE_API_URL,
  hostname: typeof window !== 'undefined' ? window.location.hostname : 'server',
  resolvedApiUrl: API_BASE_URL
});

