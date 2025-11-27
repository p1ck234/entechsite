// API Configuration
// Определяем API URL динамически, чтобы он работал и в production

function getApiUrl(): string {
  // 1. Определяем по текущему домену (приоритет для production)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Если это production домен - всегда используем production backend
    if (hostname.includes('railway.app') || hostname.includes('entech.p1ck23.ru') || hostname.includes('p1ck23.ru')) {
      return 'https://entechsite-backend-production.up.railway.app/api';
    }
    
    // Если открыто через Telegram (t.me или web.telegram.org)
    const referrer = document.referrer;
    if (referrer.includes('t.me') || referrer.includes('telegram.org')) {
      return 'https://entechsite-backend-production.up.railway.app/api';
    }
  }

  // 2. Проверяем переменную окружения (может быть установлена при сборке)
  // Но не полагаемся на неё в production, так как она встраивается при сборке
  if (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost')) {
    return import.meta.env.VITE_API_URL;
  }

  // 3. Проверяем, есть ли API URL в window (можно установить через скрипт)
  if (typeof window !== 'undefined' && (window as any).__API_URL__) {
    return (window as any).__API_URL__;
  }

  // 4. По умолчанию - используем production URL, если не в development режиме
  if (import.meta.env.MODE === 'development' || import.meta.env.DEV) {
    return 'http://localhost:3001/api';
  }
  // В production используем production URL
  return 'https://entechsite-backend-production.up.railway.app/api';
}

export const API_BASE_URL = getApiUrl();

console.log('🔗 API Configuration:', {
  VITE_API_URL: import.meta.env.VITE_API_URL,
  hostname: typeof window !== 'undefined' ? window.location.hostname : 'server',
  resolvedApiUrl: API_BASE_URL,
  isProduction: typeof window !== 'undefined' ? (window.location.hostname.includes('railway.app') || window.location.hostname.includes('p1ck23.ru')) : false
});

