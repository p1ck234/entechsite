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

    // Загружаем скрипт Telegram OAuth Widget если его еще нет
    const existingScript = document.querySelector('script[src*="telegram-widget.js"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.async = true;
      document.head.appendChild(script);
    }

    // Создаем виджет после небольшой задержки, чтобы скрипт успел загрузиться
    const initWidget = () => {
      const container = document.getElementById('telegram-login-container');
      if (container && !container.querySelector('script[data-telegram-login]')) {
        const widgetScript = document.createElement('script');
        widgetScript.src = 'https://telegram.org/js/telegram-widget.js?22';
        widgetScript.setAttribute('data-telegram-login', import.meta.env.VITE_TELEGRAM_BOT_NAME || 'your_bot_name');
        widgetScript.setAttribute('data-size', 'large');
        widgetScript.setAttribute('data-onauth', 'onTelegramAuth(user)');
        widgetScript.setAttribute('data-request-access', 'write');
        widgetScript.async = true;
        container.appendChild(widgetScript);
      }
    };

    // Пытаемся инициализировать виджет сразу и после задержки
    initWidget();
    const timeoutId = setTimeout(initWidget, 500);
    const timeoutId2 = setTimeout(initWidget, 1500); // Еще одна попытка

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (timeoutId2) clearTimeout(timeoutId2);
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
          <div className="flex justify-center mb-4" id="telegram-login-container">
            {/* Виджет будет добавлен скриптом */}
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
