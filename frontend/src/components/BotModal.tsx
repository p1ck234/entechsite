import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { TelegramBot } from '../types';
import { botsAPI } from '../api/client';
import { useTelegram } from '../contexts/TelegramContext';

interface BotModalProps {
  bot: TelegramBot | null;
  onClose: () => void;
  onSuccess: () => void;
}

const BotModal: React.FC<BotModalProps> = ({ bot, onClose, onSuccess }) => {
  const { isTelegram } = useTelegram();
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    description: '',
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (bot) {
      setFormData({
        name: bot.name,
        username: bot.username,
        description: bot.description || '',
        isActive: bot.isActive,
      });
    } else {
      setFormData({
        name: '',
        username: '',
        description: '',
        isActive: true,
      });
    }
  }, [bot]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (bot) {
        await botsAPI.updateBot(bot.id, formData);
      } else {
        await botsAPI.createBot(formData);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при сохранении бота');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  // Блокируем прокрутку body при открытом попапе
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center ${isTelegram ? 'p-0' : 'p-0 sm:p-4'}`}
      style={{ touchAction: 'none', overflow: 'hidden' }}
      onTouchMove={(e) => {
        // Предотвращаем прокрутку фона
        const target = e.target as HTMLElement;
        if (!target.closest('.modal-content')) {
          e.preventDefault();
        }
      }}
    >
      {!isTelegram && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm" 
          onClick={onClose}
          style={{ touchAction: 'none' }}
        />
      )}
      
      <div 
        className={`relative w-full ${isTelegram ? 'h-full max-w-none max-h-none' : 'max-w-2xl max-h-[85vh] sm:max-h-[90vh]'} overflow-y-auto bg-white ${isTelegram ? 'rounded-none' : 'rounded-t-2xl sm:rounded-2xl'} modal-content`}
        style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`glass-card ${isTelegram ? 'rounded-none' : 'rounded-t-2xl sm:rounded-2xl'} p-6 ${isTelegram ? 'pb-8' : 'pb-24 sm:pb-8'}`}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-pastel-800">
              {bot ? 'Редактировать бота' : 'Добавить бота'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-pastel-400 hover:text-pastel-600 hover:bg-pastel-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="name" className="block text-sm font-medium text-pastel-700 mb-2">
                  Название бота *
                </label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="input-field"
                  placeholder="Например: ENTECH Site Bot"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="username" className="block text-sm font-medium text-pastel-700 mb-2">
                  Username бота (без @) *
                </label>
                <input
                  id="username"
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  className="input-field"
                  placeholder="Например: entechsite_bot"
                />
                <p className="text-xs text-pastel-500 mt-1">
                  Введите username без символа @
                </p>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="description" className="block text-sm font-medium text-pastel-700 mb-2">
                  Описание
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="input-field"
                  placeholder="Краткое описание бота..."
                />
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isActive"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-pastel-300 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="isActive" className="ml-2 text-sm text-pastel-700">
                    Активен
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                disabled={loading}
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Сохранение...' : (bot ? 'Обновить' : 'Создать')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BotModal;

