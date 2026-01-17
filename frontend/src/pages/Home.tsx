import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTelegram } from '../contexts/TelegramContext';
import Logo from '../components/Logo';

const Home: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, loginTelegram } = useAuth();
  const { isTelegram, initData } = useTelegram();
  const [loading, setLoading] = useState(false);

  // Определяем, находимся ли мы внутри Layout (защищенный маршрут /home)
  const isInsideLayout = location.pathname === '/home';

  // Автоматическая авторизация через Telegram на главной странице
  useEffect(() => {
    // Если это Telegram Mini App, пользователь не авторизован, и есть initData
    if (isTelegram && !isAuthenticated && initData && location.pathname === '/') {
      const handleTelegramLogin = async () => {
        try {
          setLoading(true);
          await loginTelegram(initData);
          navigate('/home');
        } catch (err: any) {
          // Если заявка на регистрацию создана автоматически - перенаправляем на /login с сообщением
          if (err.needsRegistration || 
              err.status === 'PENDING' ||
              err.response?.data?.needsRegistration || 
              err.response?.data?.status === 'PENDING' ||
              (err.response?.status === 403 && (
                err.response?.data?.message?.includes('заявка') ||
                err.response?.data?.message?.includes('ожидайте') ||
                err.response?.data?.message?.includes('подтверждения')
              ))) {
            // Перенаправляем на /login, где будет показано сообщение о созданной заявке
            navigate('/login', { 
              state: { 
                message: err.message || err.response?.data?.message || 
                  'Ваша заявка на регистрацию отправлена. Ожидайте подтверждения администратора.' 
              } 
            });
            return;
          }
          // Если ошибка авторизации, перенаправляем на /login для показа ошибки
          console.error('Telegram login error:', err);
          navigate('/login', { 
            state: { 
              message: err.message || 'Ошибка авторизации через Telegram' 
            } 
          });
        }
      };
      handleTelegramLogin();
    }
  }, [isTelegram, isAuthenticated, initData, location.pathname, loginTelegram, navigate]);

  // Если идет авторизация, показываем загрузку
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-pastel-600">Авторизация через Telegram...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${
        isInsideLayout ? 'h-full w-full absolute inset-0' : 'min-h-screen'
      } bg-gray-600 flex items-center justify-center ${isInsideLayout ? 'p-0' : 'p-2 sm:p-4'}`}
    >
      <div className={`w-full ${isInsideLayout ? 'h-full' : 'max-w-7xl'} flex items-center justify-center`}>
        {/* Основной блок */}
        <div className={`relative ${isInsideLayout ? 'w-full h-full' : 'flex-1'} flex items-center justify-center`}>
          {/* Серый прямоугольник с вертикальным списком ценностей */}
          <div className={`relative ${isInsideLayout ? 'w-full h-full rounded-none' : 'w-full max-w-3xl rounded-[32px]'} bg-[#b9bbbf] ${isInsideLayout ? '' : 'shadow-2xl'} border border-white/30 overflow-y-auto`}>
            <div className="relative z-10 flex flex-col items-center px-4 sm:px-6 md:px-8 py-6 sm:py-8 md:py-12 space-y-6 sm:space-y-8 md:space-y-10">
              {/* Логотип сверху */}
              <div className="flex items-center justify-center mb-4 sm:mb-6 mt-4 sm:mt-6 md:mt-8">
                <div className="transition-all duration-300 hover:scale-110 cursor-default">
                  <Logo size="lg" showText={true} />
                </div>
              </div>

              {/* Список ценностей */}
              <div className="w-full space-y-4 sm:space-y-5 md:space-y-6 text-sm sm:text-base md:text-lg lg:text-xl font-semibold leading-relaxed" style={{ fontFamily: 'Raleway, sans-serif' }}>
                {/* Ценность 1 */}
                <div className="text-center">
                  <p className="text-[#b81f1f] uppercase transition-all duration-300 hover:scale-105 hover:opacity-80 cursor-default">
                    МЫ СОЗДАЕМ АТМОСФЕРУ, В КОТОРОЙ ХОЧЕТСЯ РАБОТАТЬ
                  </p>
                </div>

                {/* Ценность 2 */}
                <div className="text-center">
                  <p className="text-black uppercase transition-all duration-300 hover:scale-105 hover:text-gray-700 cursor-default">
                    МЫ ВСЕГДА ГОТОВЫ К НОВЫМ РЕШЕНИЯМ
                  </p>
                </div>

                {/* Ценность 3 */}
                <div className="text-center">
                  <p className="text-[#b81f1f] uppercase transition-all duration-300 hover:scale-105 hover:opacity-80 cursor-default">
                    МЫ НЕ БОИМСЯ ОШИБОК, ДЛЯ НАС ЭТО ВОЗМОЖНОСТЬ СТАТЬ ЛУЧШЕ
                  </p>
                </div>

                {/* Ценность 4 */}
                <div className="text-center">
                  <p className="text-black uppercase transition-all duration-300 hover:scale-105 hover:text-gray-700 cursor-default">
                    СВОБОДА ОБЩЕНИЯ БЕЗ РАМОК — НАША ФОРМА СУБОРДИНАЦИИ
                  </p>
                </div>

                {/* Ценность 5 */}
                <div className="text-center">
                  <p className="text-[#b81f1f] uppercase transition-all duration-300 hover:scale-105 hover:opacity-80 cursor-default">
                    МЫ СМЕЛО ПРИНИМАЕМ РЕШЕНИЯ
                  </p>
                </div>

                {/* Ценность 6 */}
                <div className="text-center">
                  <p className="text-black uppercase transition-all duration-300 hover:scale-105 hover:text-gray-700 cursor-default">
                    НАША СИЛА В КОМАНДЕ
                  </p>
                </div>

                {/* Ценность 7 */}
                <div className="text-center">
                  <p className="text-[#b81f1f] uppercase transition-all duration-300 hover:scale-105 hover:opacity-80 cursor-default">
                    МЫ НЕ ИЩЕМ ВИНОВНЫХ, А ИЩЕМ РЕШЕНИЕ
                  </p>
                </div>

                {/* Ценность 8 */}
                <div className="text-center">
                  <p className="text-black uppercase transition-all duration-300 hover:scale-105 hover:text-gray-700 cursor-default">
                    И НЕСЕМ ОТВЕТСТВЕННОСТЬ ЗА НИХ
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
