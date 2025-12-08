import React, { useState, useEffect, useRef } from 'react';
import { useTelegram } from '../contexts/TelegramContext';
import { API_BASE_URL } from '../config/api';
import Logo from '../components/Logo';

const TelegramAuth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { isTelegram } = useTelegram();
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  const widgetInitializedRef = useRef(false);
  const retryCountRef = useRef(0);

  // Обработчик Telegram OAuth Widget (только для веба)
  useEffect(() => {
    // Проверяем окружение более точно
    // Виджет OAuth работает только в обычных браузерах, не в Telegram Mini App
    const hasTelegramWebApp = typeof window !== 'undefined' && !!window.Telegram?.WebApp;
    const initData = hasTelegramWebApp ? window.Telegram?.WebApp?.initData : null;
    const hasInitData = !!initData && initData.length > 0;
    const isInMiniApp = hasTelegramWebApp && hasInitData; // Mini App всегда имеет initData
    
    console.log('🔍 TelegramAuth Debug Info:');
    console.log('  - isTelegram (from context):', isTelegram);
    console.log('  - window.Telegram exists:', typeof window !== 'undefined' && !!window.Telegram);
    console.log('  - window.Telegram.WebApp exists:', hasTelegramWebApp);
    console.log('  - initData:', initData ? `${initData.substring(0, 50)}...` : 'null/empty');
    console.log('  - has initData:', hasInitData);
    console.log('  - isInMiniApp:', isInMiniApp);
    console.log('  - User Agent:', typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A');
    console.log('  - window.location:', typeof window !== 'undefined' ? window.location.href : 'N/A');
    
    // Если это Mini App (есть initData), не инициализируем виджет
    // Виджет OAuth не работает в Mini App, только в обычных браузерах
    if (isTelegram || isInMiniApp) {
      console.log('⚠️ Skipping widget initialization - Telegram Mini App detected');
      console.log('💡 OAuth Widget работает только в обычных браузерах. Для Mini App используйте /login');
      return;
    }
    
    console.log('✅ Initializing Telegram OAuth Widget for web browser');

    // Создаем глобальную функцию для обработки OAuth callback
    (window as any).onTelegramAuth = async (user: any) => {
      try {
        setLoading(true);
        setError('');

        // Используем API_BASE_URL из config/api.ts
        const apiUrl = API_BASE_URL;
        
        // Отправляем данные на backend
        const response = await fetch(`${apiUrl}/auth/telegram-oauth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username,
            photo_url: user.photo_url,
            auth_date: user.auth_date,
            hash: user.hash,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Ошибка авторизации');
        }

        // Сохраняем токен и пользователя
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        console.log('✅ Авторизация успешна, перенаправление на главную...');

        // Используем window.location для надежного редиректа
        // Это гарантирует полную перезагрузку страницы и обновление AuthContext
        window.location.href = '/home';
      } catch (err: any) {
        console.error('Telegram OAuth error:', err);
        setError(err.message || 'Ошибка авторизации через Telegram');
        setLoading(false);
      }
    };

    const botName = import.meta.env.VITE_TELEGRAM_BOT_NAME || 'entechsite_bot';

    // Логируем для отладки
    console.log('🤖 Telegram Bot Name:', botName);
    console.log('🔍 import.meta.env.VITE_TELEGRAM_BOT_NAME:', import.meta.env.VITE_TELEGRAM_BOT_NAME);

    // Проверяем что имя бота указано
    if (!botName || botName === 'your_bot_name') {
      setError('Telegram бот не настроен. Обратитесь к администратору.');
      return;
    }

    // Инициализация виджета - используем useRef чтобы избежать конфликтов с React
    const initWidget = () => {
      // Проверяем, не инициализирован ли уже виджет
      if (widgetInitializedRef.current) {
        console.log('✅ Widget already initialized');
        return;
      }

      const container = widgetContainerRef.current;
      if (!container) {
        console.error('❌ Container ref not found, retrying...', retryCountRef.current);
        // Повторяем попытку через небольшую задержку (максимум 5 попыток)
        if (retryCountRef.current < 5) {
          retryCountRef.current++;
          setTimeout(initWidget, 300);
        } else {
          console.error('❌ Failed to find container after 5 retries');
          setError('Не удалось загрузить виджет авторизации. Обновите страницу.');
        }
        return;
      }
      
      console.log('✅ Container found, initializing widget...');
      retryCountRef.current = 0; // Сбрасываем счетчик при успехе

      // Проверяем, не создан ли уже виджет (iframe)
      if (container.querySelector('iframe[id*="telegram-login"]')) {
        console.log('✅ Widget already exists');
        widgetInitializedRef.current = true;
        return;
      }

      // Проверяем, есть ли уже iframe виджета
      const existingWidget = container.querySelector('iframe[id*="telegram-login"]');
      if (existingWidget) {
        widgetInitializedRef.current = true;
        return; // Виджет уже есть, не трогаем его
      }

      // Если есть script тег, но нет iframe - ждем
      const existingScript = container.querySelector('script[data-telegram-login]');
      if (existingScript) {
        console.log('⏳ Script exists, waiting for iframe...');
        return; // Скрипт уже загружается, ждем
      }

      // Очищаем контейнер только если там нет ни виджета, ни скрипта
      // Используем innerHTML для полной очистки, чтобы избежать конфликтов с React
      container.innerHTML = '';

      console.log('✅ Creating Telegram widget with bot name:', botName);

      // Создаем script тег с атрибутами (правильный способ для Telegram Widget)
      const widgetScript = document.createElement('script');
      widgetScript.type = 'text/javascript';
      widgetScript.async = true;
      widgetScript.src = 'https://telegram.org/js/telegram-widget.js?22';
      widgetScript.setAttribute('data-telegram-login', botName);
      widgetScript.setAttribute('data-size', 'large');
      widgetScript.setAttribute('data-onauth', 'onTelegramAuth(user)');
      widgetScript.setAttribute('data-request-access', 'write');

      widgetScript.onload = () => {
        console.log('✅ Telegram widget script loaded');
        widgetInitializedRef.current = true;
        // Проверяем через небольшую задержку, появилась ли кнопка
        setTimeout(() => {
          const widgetButton = container.querySelector('iframe[id*="telegram-login"]');
          if (widgetButton) {
            console.log('✅ Widget button found:', widgetButton);
          } else {
            console.warn('⚠️ Widget script loaded but button not found');
          }
        }, 1000);
      };

      widgetScript.onerror = () => {
        console.error('❌ Failed to load Telegram widget script');
        setError('Не удалось загрузить Telegram виджет. Проверьте подключение к интернету.');
        widgetInitializedRef.current = false;
      };

      // Безопасно добавляем скрипт
      try {
        container.appendChild(widgetScript);
        console.log('✅ Widget script element added to container');
        console.log('🔍 Container HTML after script:', container.innerHTML.substring(0, 200));
        
        // Дополнительная проверка через 2 секунды
        setTimeout(() => {
          const iframe = container.querySelector('iframe[id*="telegram-login"]');
          if (!iframe) {
            console.warn('⚠️ Widget iframe still not found after 2 seconds');
            console.log('🔍 Container children:', Array.from(container.children).map(c => c.tagName));
            console.log('🔍 Container HTML:', container.innerHTML.substring(0, 500));
          } else {
            console.log('✅ Widget iframe found:', iframe);
          }
        }, 2000);
      } catch (err) {
        console.error('❌ Error appending widget script:', err);
        widgetInitializedRef.current = false;
      }
    };

    // Инициализируем виджет после небольшой задержки, чтобы контейнер точно был в DOM
    // Используем requestAnimationFrame для гарантии, что DOM обновлен
    const initTimeout = setTimeout(() => {
      requestAnimationFrame(() => {
        console.log('🔄 Starting widget initialization...');
        console.log('🔍 isTelegram:', isTelegram);
        console.log('🔍 Container ref:', widgetContainerRef.current);
        console.log('🔍 Container in DOM:', document.getElementById('telegram-login-container'));
        initWidget();
      });
    }, 500);

    return () => {
      clearTimeout(initTimeout);
      delete (window as any).onTelegramAuth;
      widgetInitializedRef.current = false;
    };
  }, [isTelegram]);

  // Показываем форму входа с кнопкой Telegram OAuth (только для веба)
  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg p-4">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-2xl p-8 shadow-2xl text-center">
          <div className="mb-4">
            <Logo size="lg" />
          </div>
          <h2 className="text-2xl font-bold text-pastel-800 mb-4">
            Вход через Telegram
          </h2>
          <p className="text-pastel-600 mb-6">
            Нажмите кнопку ниже, чтобы войти через Telegram
          </p>

          {loading && (
            <div className="mb-4">
              <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-pastel-600">Авторизация...</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <p className="font-semibold mb-1">Ошибка:</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Telegram OAuth Widget - только для веба */}
          {(() => {
            // Более точная проверка: Mini App всегда имеет initData
            const hasTelegramWebApp = typeof window !== 'undefined' && !!window.Telegram?.WebApp;
            const initData = hasTelegramWebApp ? window.Telegram?.WebApp?.initData : null;
            const hasInitData = !!initData && initData.length > 0;
            const isInMiniApp = hasTelegramWebApp && hasInitData;
            const shouldShowWidget = !isTelegram && !isInMiniApp;
            
            if (!shouldShowWidget) {
              return (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
                  <p className="font-semibold mb-1">⚠️ Обнаружен Telegram Mini App</p>
                  <p className="text-sm mb-2">
                    Виджет Telegram OAuth работает только в обычных браузерах (Chrome, Safari, Firefox), 
                    а не в Telegram Mini App.
                  </p>
                  <p className="text-sm">
                    Для авторизации в Telegram Mini App используйте страницу{' '}
                    <a href="/login" className="underline font-semibold">/login</a>
                  </p>
                  <p className="text-xs mt-2 text-yellow-700">
                    Debug: isTelegram={String(isTelegram)}, hasWebApp={String(hasTelegramWebApp)}, hasInitData={String(hasInitData)}
                  </p>
                </div>
              );
            }
            
            return (
              <>
                <div
                  className="flex justify-center mb-4 min-h-[50px] relative"
                  style={{ minHeight: '50px' }}
                >
                  <div
                    ref={widgetContainerRef}
                    id="telegram-login-container"
                    suppressHydrationWarning
                    style={{ minHeight: '50px', minWidth: '200px' }}
                  />
                  {!loading && !error && !widgetInitializedRef.current && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-pastel-500 text-sm">
                        Загрузка кнопки входа...
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-pastel-600 text-sm mt-4">
                  После нажатия кнопки вы будете перенаправлены на страницу авторизации Telegram, где нужно будет ввести номер телефона и подтвердить код
                </p>
              </>
            );
          })()}

        </div>
      </div>
    </div>
  );
};

export default TelegramAuth;

