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

  const ankItems = [
    {
      title: 'ПОЛУЧИЛ ЗАДАЧУ — ЗАПИШИ, ЧТОБЫ НЕ ЗАБЫТЬ.',
      description: 'Фиксируй каждое поручение: в блокноте, телефоне, CRM — не полагайся на память',
    },
    {
      title: 'УТОЧНЯЙ, ЧТОБЫ НЕ ПЕРЕДЕЛЫВАТЬ. Лучше спросить, чем переделывать.',
      description: 'Если задача вызывает сомнения — уточни. Если возникла проблема — сообщи сразу.',
    },
    {
      title: 'СООБЩАЯ О ПРОБЛЕМЕ, ПРЕДЛОЖИ РЕШЕНИЕ.',
      description: 'Проанализируй ситуацию и предложи варианты действий — это ускоряет процесс выполнения задачи и развивает аналитические навыки',
    },
    {
      title: 'НЕ УСПЕВАЕШЬ ИЛИ НЕСКОЛЬКО ЗАДАЧ? СПРОСИ, ЧТО ВАЖНЕЕ!',
      description: 'Один уточняющий вопрос помогает расставить приоритеты и избежать ошибок',
    },
    {
      title: 'ЗАДАЧА ПРИНЯТА? НАВЕДИ ПОРЯДОК!',
      description: 'Небрежное обращение с документами и материалами ведет к потере времени, денег, репутации.',
    },
    {
      title: 'НЕ ТОРОПИСЬ ЗАВЕРШАТЬ ЗАДАЧУ, ПРОВЕРЬ, ЧТОБЫ НЕ КРАСНЕТЬ',
      description: '',
    },
    {
      title: 'НЕ МОЖЕШЬ ДОДЕЛАТЬ ЗАДАЧУ — НЕ БРОСАЙ, ПОПРОСИ ПОМОЩИ КОЛЛЕГ.',
      description: '',
    },
    {
      title: 'ОТЧИТЫВАЙСЯ КРАТКО, ЭКОНОМЬ ВРЕМЯ.',
      description: 'Это снижает когнитивную нагрузку и ускоряет принятие решений.',
    },
  ];

  return (
    <div
      className={`${
        isInsideLayout ? 'h-full w-full absolute inset-0' : 'min-h-screen'
      } bg-[#f4ece6] flex items-center justify-center ${isInsideLayout ? 'p-0' : 'p-2 sm:p-4'}`}
    >
      <div className={`w-full ${isInsideLayout ? 'h-full' : 'max-w-7xl'} flex items-center justify-center`}>
        <div
          className={`${
            isInsideLayout ? 'w-full h-full rounded-none' : 'w-full max-w-6xl rounded-[28px]'
          } bg-[#f4ece6] ${isInsideLayout ? '' : 'shadow-xl border border-[#e4d7cf]'} overflow-y-auto`}
        >
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-8 lg:px-14 py-8 sm:py-12 lg:py-16">
            <div className="flex justify-center">
              <Logo size="lg" showText={true} />
            </div>

            <h1 className="mt-6 sm:mt-8 text-center text-3xl sm:text-4xl font-bold tracking-wide text-[#7f2127]">
              [ ДНК ]
            </h1>

            <div className="mt-8 sm:mt-12 grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-8 sm:gap-y-10">
              {ankItems.map((item) => (
                <article key={item.title} className="text-[#7f2127] uppercase">
                  <h2 className="text-xl sm:text-2xl font-extrabold leading-tight">{item.title}</h2>
                  {item.description && (
                    <p className="mt-3 text-sm sm:text-base font-semibold leading-snug">
                      {item.description}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
