// Site configuration
export const SITE_CONFIG = {
  name: 'EnTech',
  description: 'Система управления компанией',
  url: 'https://entech.p1ck23.ru',
  apiUrl: import.meta.env.VITE_API_URL || 'https://entech.p1ck23.ru/api',
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
