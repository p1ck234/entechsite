import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { isTelegramWebApp, getTelegramWebApp, getTelegramUser, initTelegramWebApp } from '../utils/telegram';

interface TelegramContextType {
  isTelegram: boolean;
  webApp: ReturnType<typeof getTelegramWebApp>;
  user: ReturnType<typeof getTelegramUser>;
  initData: string | null;
}

const TelegramContext = createContext<TelegramContextType | undefined>(undefined);

export const useTelegram = () => {
  const context = useContext(TelegramContext);
  if (context === undefined) {
    throw new Error('useTelegram must be used within a TelegramProvider');
  }
  return context;
};

interface TelegramProviderProps {
  children: ReactNode;
}

export const TelegramProvider: React.FC<TelegramProviderProps> = ({ children }) => {
  const [isTelegram, setIsTelegram] = useState(false);
  const [webApp, setWebApp] = useState<ReturnType<typeof getTelegramWebApp>>(null);
  const [user, setUser] = useState<ReturnType<typeof getTelegramUser>>(null);
  const [initData, setInitData] = useState<string | null>(null);

  useEffect(() => {
    const checkTelegram = () => {
      const isTg = isTelegramWebApp();
      setIsTelegram(isTg);

      if (isTg) {
        const app = getTelegramWebApp();
        setWebApp(app);
        setUser(getTelegramUser());
        setInitData(app?.initData || null);
        
        // Инициализируем приложение
        initTelegramWebApp();

        // Применяем тему
        if (app?.colorScheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }

        // Подписываемся на события изменения viewport
        app?.onEvent('viewportChanged', () => {
          // Обновляем высоту viewport при необходимости
        });

        return () => {
          app?.offEvent('viewportChanged', () => {});
        };
      }
    };

    // Проверяем сразу
    checkTelegram();

    // Также проверяем после небольшой задержки на случай, если скрипт загружается асинхронно
    const timeoutId = setTimeout(checkTelegram, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  const value: TelegramContextType = {
    isTelegram,
    webApp,
    user,
    initData,
  };

  return (
    <TelegramContext.Provider value={value}>
      {children}
    </TelegramContext.Provider>
  );
};


