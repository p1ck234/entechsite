import React from 'react';
import { Calendar, Heart } from 'lucide-react';

interface ComingSoonProps {
  title: string;
}

const ComingSoon: React.FC<ComingSoonProps> = ({ title }) => {
  const isLife = title === 'Наша жизнь';
  const isEvents = title === 'Календарь мероприятий';
  
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center glass-card p-12 rounded-2xl max-w-md w-full">
        <div className="flex justify-center mb-6">
          {isEvents ? (
            <Calendar className="w-16 h-16 text-primary-500" />
          ) : isLife ? (
            <Heart className="w-16 h-16 text-primary-500" />
          ) : (
            <div className="w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">?</span>
            </div>
          )}
        </div>
        <h2 className="text-3xl font-bold text-pastel-800 mb-4">{title}</h2>
        <p className="text-lg text-pastel-600 mb-2">
          Страница находится в разработке
        </p>
        <p className="text-sm text-pastel-500">
          Скоро здесь появится новый контент
        </p>
      </div>
    </div>
  );
};

export default ComingSoon;

