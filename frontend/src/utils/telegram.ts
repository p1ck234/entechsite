// Telegram Web App SDK utilities

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            is_premium?: boolean;
            photo_url?: string;
          };
          auth_date: number;
          hash: string;
        };
        version: string;
        platform: string;
        colorScheme: 'light' | 'dark';
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        headerColor: string;
        backgroundColor: string;
        isClosingConfirmationEnabled: boolean;
        BackButton: {
          isVisible: boolean;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          show: () => void;
          hide: () => void;
        };
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          setText: (text: string) => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
          setParams: (params: {
            text?: string;
            color?: string;
            text_color?: string;
            is_active?: boolean;
            is_visible?: boolean;
          }) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        CloudStorage: {
          setItem: (key: string, value: string, callback?: (error: Error | null, success: boolean) => void) => void;
          getItem: (key: string, callback: (error: Error | null, value: string | null) => void) => void;
          getItems: (keys: string[], callback: (error: Error | null, values: Record<string, string>) => void) => void;
          removeItem: (key: string, callback?: (error: Error | null, success: boolean) => void) => void;
          removeItems: (keys: string[], callback?: (error: Error | null, success: boolean) => void) => void;
          getKeys: (callback: (error: Error | null, keys: string[]) => void) => void;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        enableClosingConfirmation: () => void;
        disableClosingConfirmation: () => void;
        onEvent: (eventType: string, eventHandler: () => void) => void;
        offEvent: (eventType: string, eventHandler: () => void) => void;
        sendData: (data: string) => void;
        openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
        openTelegramLink: (url: string) => void;
        openInvoice: (url: string, callback?: (status: string) => void) => void;
        showPopup: (params: {
          title?: string;
          message: string;
          buttons?: Array<{
            id?: string;
            type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
            text: string;
          }>;
        }, callback?: (id: string) => void) => void;
        showAlert: (message: string, callback?: () => void) => void;
        showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
        showScanQrPopup: (params: {
          text?: string;
        }, callback?: (data: string) => void) => void;
        closeScanQrPopup: () => void;
        readTextFromClipboard: (callback?: (text: string) => void) => void;
        requestWriteAccess: (callback?: (granted: boolean) => void) => void;
        requestContact: (callback?: (granted: boolean, contact?: {
          contact: {
            phone_number: string;
            first_name: string;
            last_name?: string;
            user_id?: number;
          };
        }) => void) => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        enableVerticalSwipes: () => void;
        disableVerticalSwipes: () => void;
      };
    };
  }
}

/**
 * Проверяет, запущено ли приложение в Telegram Mini App
 * В обычном браузере скрипт telegram-web-app.js может создать объект,
 * но initData будет пустым или отсутствовать
 */
export const isTelegramWebApp = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  
  const webApp = window.Telegram?.WebApp;
  if (!webApp) {
    return false;
  }
  
  // В Mini App всегда есть initData, в обычном браузере его нет
  return !!webApp.initData && webApp.initData.length > 0;
};

/**
 * Получает экземпляр Telegram WebApp
 */
export const getTelegramWebApp = () => {
  if (!isTelegramWebApp()) {
    return null;
  }
  return window.Telegram!.WebApp;
};

/**
 * Получает данные пользователя из Telegram
 */
export const getTelegramUser = () => {
  const webApp = getTelegramWebApp();
  if (!webApp) {
    return null;
  }
  return webApp.initDataUnsafe.user || null;
};

/**
 * Инициализирует Telegram Web App
 */
export const initTelegramWebApp = () => {
  const webApp = getTelegramWebApp();
  if (!webApp) {
    return;
  }

  // Расширяем приложение на весь экран
  webApp.expand();

  // Готовим приложение к использованию
  webApp.ready();

  // Настраиваем цветовую схему
  if (webApp.colorScheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  // Применяем тему Telegram
  if (webApp.themeParams.bg_color) {
    document.documentElement.style.setProperty('--tg-theme-bg-color', webApp.themeParams.bg_color);
  }
  if (webApp.themeParams.text_color) {
    document.documentElement.style.setProperty('--tg-theme-text-color', webApp.themeParams.text_color);
  }
  if (webApp.themeParams.hint_color) {
    document.documentElement.style.setProperty('--tg-theme-hint-color', webApp.themeParams.hint_color);
  }
  if (webApp.themeParams.link_color) {
    document.documentElement.style.setProperty('--tg-theme-link-color', webApp.themeParams.link_color);
  }
  if (webApp.themeParams.button_color) {
    document.documentElement.style.setProperty('--tg-theme-button-color', webApp.themeParams.button_color);
  }
  if (webApp.themeParams.button_text_color) {
    document.documentElement.style.setProperty('--tg-theme-button-text-color', webApp.themeParams.button_text_color);
  }
  if (webApp.themeParams.secondary_bg_color) {
    document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', webApp.themeParams.secondary_bg_color);
  }
};

/**
 * Получает initData для авторизации
 */
export const getTelegramInitData = (): string | null => {
  const webApp = getTelegramWebApp();
  return webApp?.initData || null;
};


