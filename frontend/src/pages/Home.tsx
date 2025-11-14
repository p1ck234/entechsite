import React from 'react';
import { useLocation } from 'react-router-dom';
import Logo from '../components/Logo';

const Home: React.FC = () => {
  const location = useLocation();

  // Определяем, находимся ли мы внутри Layout (защищенный маршрут /home)
  const isInsideLayout = location.pathname === '/home';

  return (
    <div
      className={`${
        isInsideLayout ? 'min-h-full' : 'min-h-screen'
      } bg-gray-600 flex items-center justify-center p-4`}
    >
      <div className="w-full max-w-7xl flex items-center justify-center">
        {/* Основной блок */}
        <div className="relative flex-1 flex items-center justify-center">
          {/* Серый прямоугольник как на картинке */}
          <div className="relative w-full max-w-5xl aspect-[16/9] bg-[#b9bbbf] rounded-[32px] shadow-2xl border border-white/30 overflow-hidden">
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
            <div className="relative z-10 h-full grid grid-cols-3 gap-2 md:gap-4 px-4 py-4 md:px-8 md:py-8 text-[11px] xs:text-[12px] sm:text-[13px] md:text-[15px] lg:text-[17px] font-semibold leading-tight">
              {/* Верхний левый блок */}
              <div className="flex items-center justify-center">
                <p className="text-[#b81f1f] uppercase transition-all duration-300 hover:scale-105 hover:opacity-80 cursor-default text-center">
                  МЫ СОЗДАЕМ АТМОСФЕРУ,<br />
                  В КОТОРОЙ<br />
                  ХОЧЕТСЯ<br />
                  РАБОТАТЬ
                </p>
              </div>

              {/* Верхний центр */}
              <div className="flex items-center justify-center">
                <p className="text-black uppercase transition-all duration-300 hover:scale-105 hover:text-gray-700 cursor-default text-center">
                  МЫ ВСЕГДА<br />
                  ГОТОВЫ К<br />
                  НОВЫМ<br />
                  РЕШЕНИЯМ
                </p>
              </div>

              {/* Верхний правый блок */}
              <div className="flex items-center justify-center">
                <p className="text-[#b81f1f] uppercase transition-all duration-300 hover:scale-105 hover:opacity-80 cursor-default text-center">
                  МЫ НЕ БОИМСЯ ОШИБОК,<br />
                  ДЛЯ НАС ЭТО<br />
                  ВОЗМОЖНОСТЬ<br />
                  СТАТЬ ЛУЧШЕ
                </p>
              </div>

              {/* Средний левый блок */}
              <div className="flex items-center justify-center">
                <p className="text-black uppercase transition-all duration-300 hover:scale-105 hover:text-gray-700 cursor-default text-center">
                  СВОБОДА<br />
                  ОБЩЕНИЯ<br />
                  БЕЗ РАМОК —<br />
                  НАША ФОРМА<br />
                  СУБОРДИНАЦИИ
                </p>
              </div>

              {/* Центр – ENTECH GROUP */}
              <div className="flex items-center justify-center w-full h-full">
                <div className="transition-all duration-300 hover:scale-110 cursor-default flex items-center justify-center">
                  <Logo size="lg" />
                </div>
              </div>

              {/* Средний правый блок */}
              <div className="flex items-center justify-center">
                <p className="text-[#b81f1f] uppercase transition-all duration-300 hover:scale-105 hover:opacity-80 cursor-default text-center">
                  МЫ СМЕЛО<br />
                  ПРИНИМАЕМ РЕШЕНИЯ
                </p>
              </div>

              {/* Нижний левый блок */}
              <div className="flex items-center justify-center">
                <p className="text-[#b81f1f] uppercase transition-all duration-300 hover:scale-105 hover:opacity-80 cursor-default text-center">
                  НАША СИЛА<br />
                  В КОМАНДЕ
                </p>
              </div>

              {/* Нижний центр */}
              <div className="flex items-center justify-center">
                <p className="text-black uppercase transition-all duration-300 hover:scale-105 hover:text-gray-700 cursor-default text-center">
                  МЫ НЕ ИЩЕМ<br />
                  ВИНОВНЫХ,<br />
                  А ИЩЕМ<br />
                  РЕШЕНИЕ
                </p>
              </div>

              {/* Нижний правый блок */}
              <div className="flex items-center justify-center">
                <p className="text-black uppercase transition-all duration-300 hover:scale-105 hover:text-gray-700 cursor-default text-center">
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
