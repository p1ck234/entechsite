import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import Logo from '../components/Logo';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Обработчик Telegram OAuth Widget
  useEffect(() => {

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
        
        // Обновляем состояние AuthContext через перезагрузку страницы
        // Это проще чем обновлять контекст вручную
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

    // Инициализация виджета
    const initWidget = () => {
      const container = document.getElementById('telegram-login-container');
      if (!container) {
        console.error('❌ Container not found');
        return;
      }
      
      // Проверяем, не создан ли уже виджет
      if (container.querySelector('script[data-telegram-login]')) {
        console.log('✅ Widget already exists');
        return;
      }
      
      // Очищаем контейнер
      container.innerHTML = '';
      
      console.log('✅ Creating Telegram widget with bot name:', botName);
      
      // Создаем script тег с атрибутами (правильный способ для Telegram Widget)
      // Telegram Widget автоматически найдет все script теги с data-telegram-login
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
        // Проверяем через небольшую задержку, появилась ли кнопка
        setTimeout(() => {
          const widgetButton = container.querySelector('iframe, a, button');
          if (widgetButton) {
            console.log('✅ Widget button found:', widgetButton);
          } else {
            console.warn('⚠️ Widget script loaded but button not found');
            console.log('Container HTML:', container.innerHTML);
            // Пробуем еще раз через задержку
            setTimeout(() => {
              const widgetButton2 = container.querySelector('iframe, a, button');
              if (widgetButton2) {
                console.log('✅ Widget button found on retry:', widgetButton2);
              } else {
                console.error('❌ Widget button still not found after retry');
                setError('Кнопка входа не загрузилась. Попробуйте открыть приложение в обычном браузере.');
              }
            }, 2000);
          }
        }, 1000);
      };
      
      widgetScript.onerror = () => {
        console.error('❌ Failed to load Telegram widget script');
        setError('Не удалось загрузить Telegram виджет. Проверьте подключение к интернету.');
      };
      
      container.appendChild(widgetScript);
      console.log('✅ Widget script element added to container');
      console.log('Container after append:', container.innerHTML.substring(0, 200));
    };

    // Инициализируем виджет сразу
    initWidget();
    
    // Дополнительные попытки на случай если контейнер еще не готов
    const timeoutId = setTimeout(() => {
      const container = document.getElementById('telegram-login-container');
      if (container && !container.querySelector('script[data-telegram-login]')) {
        console.log('🔄 Retrying widget initialization (1s delay)...');
        initWidget();
      }
    }, 1000);
    
    const timeoutId2 = setTimeout(() => {
      const container = document.getElementById('telegram-login-container');
      if (container && !container.querySelector('script[data-telegram-login]')) {
        console.log('🔄 Retrying widget initialization (3s delay)...');
        initWidget();
      }
    }, 3000);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(timeoutId2);
      delete (window as any).onTelegramAuth;
    };
  }, [navigate]);

  // Показываем форму входа с кнопкой Telegram OAuth
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

          {/* Telegram OAuth Widget */}
          <div 
            className="flex justify-center mb-4 min-h-[50px]" 
            id="telegram-login-container"
            style={{ minHeight: '50px' }}
          >
            {/* Виджет будет добавлен скриптом */}
            {!loading && !error && (
              <div className="text-pastel-500 text-sm">
                Загрузка кнопки входа...
              </div>
            )}
          </div>

          <p className="text-pastel-600 text-sm mt-4">
            После нажатия кнопки вы будете перенаправлены на страницу авторизации Telegram, где нужно будет ввести номер телефона и подтвердить код
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
