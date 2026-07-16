const PRODUCTION_API_URL = 'https://api.entech.p1ck23.ru/api';

const normalizeApiUrl = (value: string): string => {
  const normalizedValue = value.trim().replace(/\/+$/, '');

  try {
    const url = new URL(normalizedValue);
    if (!url.pathname.endsWith('/api')) {
      url.pathname = `${url.pathname.replace(/\/+$/, '')}/api`;
    }

    return url.toString().replace(/\/+$/, '');
  } catch {
    return normalizedValue;
  }
};

function getApiUrl(): string {
  if (typeof window !== 'undefined' && (window as any).__API_URL__) {
    return normalizeApiUrl((window as any).__API_URL__);
  }

  if (import.meta.env.VITE_API_URL) {
    return normalizeApiUrl(import.meta.env.VITE_API_URL);
  }

  if (import.meta.env.MODE === 'development' || import.meta.env.DEV) {
    return 'http://localhost:3001/api';
  }

  return PRODUCTION_API_URL;
}

export const API_BASE_URL = getApiUrl();

console.log('🔗 API Configuration:', {
  VITE_API_URL: import.meta.env.VITE_API_URL,
  hostname: typeof window !== 'undefined' ? window.location.hostname : 'server',
  resolvedApiUrl: API_BASE_URL,
  isProduction: import.meta.env.PROD
});

