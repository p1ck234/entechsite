import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTelegram } from '../contexts/TelegramContext';
import Logo from '../components/Logo';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { loginTelegram } = useAuth();
  const { isTelegram, initData } = useTelegram();
  
  // Показываем сообщение из state (например, после перенаправления с Home)
  useEffect(() => {
    if (location.state?.message) {
      setError(location.state.message);
      // Очищаем state после показа сообщения
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  // Автоматическая авторизация в Mini App через initData
  useEffect(() => {
    if (isTelegram && initData) {
      const handleMiniAppLogin = async () => {
        try {
          setLoading(true);
          setError('');
          await loginTelegram(initData);
          navigate('/home');
        } catch (err: any) {
          console.error('Telegram Mini App login error:', err);
          const errorMessage = err.response?.data?.message || err.message || 'Ошибка авторизации';
          
          // Если заявка на регистрацию создана - показываем информативное сообщение
          if (err.response?.data?.needsRegistration || 
              err.response?.data?.status === 'PENDING' ||
              errorMessage.includes('заявка') ||
              errorMessage.includes('ожидайте') ||
              errorMessage.includes('подтверждения')) {
            setError(errorMessage);
            setLoading(false);
            // Не перенаправляем, остаемся на странице логина с сообщением
          } else {
            setError(errorMessage);
            setLoading(false);
          }
        }
      };
      
      handleMiniAppLogin();
    }
  }, [isTelegram, initData, loginTelegram, navigate]);

  // Показываем форму входа
  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg p-4">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-2xl p-8 shadow-2xl text-center">
          <div className="mb-4">
            <Logo size="lg" />
          </div>
          <h2 className="text-2xl font-bold text-pastel-800 mb-4">
            {isTelegram ? 'Авторизация в Telegram Mini App' : 'Вход в систему'}
          </h2>
          <p className="text-pastel-600 mb-6">
            {isTelegram
              ? 'Выполняется автоматическая авторизация...'
              : 'Для входа используйте Telegram авторизацию'}
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

          {/* Сообщение для Mini App */}
          {isTelegram && !loading && !error && (
            <p className="text-pastel-600 text-sm mt-4">
              Если авторизация не выполнилась автоматически, обратитесь к администратору
            </p>
          )}

          {/* Сообщение для веба */}
          {!isTelegram && (
            <div className="mt-4">
              <p className="text-pastel-600 text-sm mb-4">
                Эта страница предназначена для Telegram Mini App.
              </p>
              <button
                onClick={() => navigate('/auth')}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white px-4 py-3 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg font-medium"
              >
                Войти с ПК
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
