import { isTelegramWebApp } from '../utils/telegram';

// Конфигурация приложения
export const APP_CONFIG = {
  // Режим работы приложения
  isTelegram: isTelegramWebApp(),
  
  // Настройки для Telegram
  telegram: {
    // Использовать ли нативную навигацию Telegram
    useNativeNavigation: true,
    // Показывать ли кнопку "Назад"
    showBackButton: true,
  },
  
  // Настройки для веб-версии
  web: {
    // Показывать ли sidebar на мобильных
    showMobileSidebar: true,
  },
} as const;

export default APP_CONFIG;


