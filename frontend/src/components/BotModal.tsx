import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { TelegramBot } from '../types';
import { botsAPI } from '../api/client';

interface BotModalProps {
  bot: TelegramBot | null;
  onClose: () => void;
  onSuccess: () => void;
}

const BotModal: React.FC<BotModalProps> = ({ bot, onClose, onSuccess }) => {
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" 
      style={{ touchAction: 'none', overflow: 'hidden' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto pb-24 sm:pb-8"
        style={{ touchAction: 'pan-y' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-pastel-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-pastel-800">
            {bot ? 'Редактировать бота' : 'Добавить бота'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-pastel-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-pastel-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-pastel-700 mb-2">
              Название бота *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="input-field"
              placeholder="Например: ENTECH Site Bot"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-pastel-700 mb-2">
              Username бота (без @) *
            </label>
            <input
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

          <div>
            <label className="block text-sm font-medium text-pastel-700 mb-2">
              Описание
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="input-field"
              placeholder="Краткое описание бота..."
            />
          </div>

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

          <div className="flex space-x-3 pt-4 sticky bottom-0 bg-white border-t border-pastel-200 -mx-6 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-pastel-300 text-pastel-700 rounded-lg hover:bg-pastel-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Сохранение...' : bot ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BotModal;

