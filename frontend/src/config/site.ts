// Site configuration
import { API_BASE_URL } from './api';

export const SITE_CONFIG = {
  name: 'Энтех Групп',
  description: 'Управление компанией',
  url: import.meta.env.VITE_SITE_URL || 'http://localhost:5173',
  apiUrl: API_BASE_URL, // Используем функцию из config/api.ts
  version: '1.0.0',
  author: 'p1ck23',
  contact: {
    email: 'admin@entech.com',
    phone: '+7 (967) 807-97-38',
    telegram: '@p1ck23'
  },
  social: {
    telegram: '@p1ck23',
    github: 'https://github.com/p1ck23'
  }
} as const;

export default SITE_CONFIG;
