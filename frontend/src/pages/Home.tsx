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
          {/* Серый прямоугольник как на картинке */}
          <div className={`relative ${isInsideLayout ? 'w-full h-full rounded-none' : 'w-full max-w-5xl aspect-[16/9] rounded-[32px]'} bg-[#b9bbbf] ${isInsideLayout ? '' : 'shadow-2xl'} border border-white/30 overflow-hidden`}>
            {/* Светящиеся линии (крест) */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Горизонтальные */}
              <div className="absolute top-[32.5%] left-[7%] right-[7%] h-[4px] bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.9)]" />
              <div className="absolute top-[66%] left-[7%] right-[7%] h-[4px] bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.9)]" />
              {/* Вертикальные */}
              <div className="absolute left-[33%] top-[7%] bottom-[7%] w-[4px] bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.9)]" />
              <div className="absolute left-[66%] top-[7%] bottom-[7%] w-[4px] bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.9)]" />
            </div>

            {/* Сетка 3×3 с текстами */}
            <div className="relative z-10 h-full grid grid-cols-3 gap-1 sm:gap-2 md:gap-4 px-1 py-1 sm:px-2 sm:py-2 md:px-4 md:py-4 text-[10px] xs:text-[11px] sm:text-[13px] md:text-[16px] lg:text-[18px] font-semibold leading-tight">
              {/* Верхний левый блок */}
              <div className="flex items-center justify-center lg:items-start lg:justify-start lg:pt-4">
                <p className="text-[#b81f1f] uppercase transition-all duration-300 hover:scale-105 hover:opacity-80 cursor-default text-center lg:text-left">
                  МЫ СОЗДАЕМ АТМОСФЕРУ,<br />
                  В КОТОРОЙ<br />
                  ХОЧЕТСЯ<br />
                  РАБОТАТЬ
                </p>
              </div>

              {/* Верхний центр */}
              <div className="flex items-center justify-center lg:items-start lg:justify-center lg:pt-4">
                <p className="text-black uppercase transition-all duration-300 hover:scale-105 hover:text-gray-700 cursor-default text-center">
                  МЫ ВСЕГДА<br />
                  ГОТОВЫ К<br />
                  НОВЫМ<br />
                  РЕШЕНИЯМ
                </p>
              </div>

              {/* Верхний правый блок */}
              <div className="flex items-center justify-center lg:items-start lg:justify-end lg:pt-4">
                <p className="text-[#b81f1f] uppercase transition-all duration-300 hover:scale-105 hover:opacity-80 cursor-default text-center lg:text-right">
                  МЫ НЕ БОИМСЯ ОШИБОК,<br />
                  ДЛЯ НАС ЭТО<br />
                  ВОЗМОЖНОСТЬ<br />
                  СТАТЬ ЛУЧШЕ
                </p>
              </div>

              {/* Средний левый блок */}
              <div className="flex items-center justify-center lg:items-center lg:justify-start">
                <p className="text-black uppercase transition-all duration-300 hover:scale-105 hover:text-gray-700 cursor-default text-center lg:text-left">
                  СВОБОДА<br />
                  ОБЩЕНИЯ<br />
                  БЕЗ РАМОК —<br />
                  НАША ФОРМА<br />
                  СУБОРДИНАЦИИ
                </p>
              </div>

              {/* Центр – ENTECH GROUP */}
              <div className="flex items-center justify-center w-full h-full p-1 sm:p-2">
                <div className="transition-all duration-300 hover:scale-110 cursor-default flex items-center justify-center w-full h-full">
                  <Logo size="lg" showText={false} className="w-full h-full max-w-full max-h-full object-contain" />
                </div>
              </div>

              {/* Средний правый блок */}
              <div className="flex items-center justify-center lg:items-center lg:justify-end">
                <p className="text-[#b81f1f] uppercase transition-all duration-300 hover:scale-105 hover:opacity-80 cursor-default text-center lg:text-right">
                  МЫ СМЕЛО<br />
                  ПРИНИМАЕМ РЕШЕНИЯ
                </p>
              </div>

              {/* Нижний левый блок */}
              <div className="flex items-center justify-center lg:items-end lg:justify-start lg:pb-4">
                <p className="text-[#b81f1f] uppercase transition-all duration-300 hover:scale-105 hover:opacity-80 cursor-default text-center lg:text-left">
                  НАША СИЛА<br />
                  В КОМАНДЕ
                </p>
              </div>

              {/* Нижний центр */}
              <div className="flex items-center justify-center lg:items-end lg:justify-center lg:pb-4">
                <p className="text-black uppercase transition-all duration-300 hover:scale-105 hover:text-gray-700 cursor-default text-center">
                  МЫ НЕ ИЩЕМ<br />
                  ВИНОВНЫХ,<br />
                  А ИЩЕМ<br />
                  РЕШЕНИЕ
                </p>
              </div>

              {/* Нижний правый блок */}
              <div className="flex items-center justify-center lg:items-end lg:justify-end lg:pb-4">
                <p className="text-black uppercase transition-all duration-300 hover:scale-105 hover:text-gray-700 cursor-default text-center lg:text-right">
                  И НЕСЕМ ОТВЕТСТВЕННОСТЬ<br />
                  ЗА НИХ
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
