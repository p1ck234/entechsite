import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Lesson } from '../types';
import { lessonsAPI } from '../api/client';

interface LessonModalProps {
  lesson: Lesson | null;
  courseId: string;
  onClose: () => void;
}

const LessonModal: React.FC<LessonModalProps> = ({ lesson, courseId, onClose }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    googleDriveUrl: '',
    duration: '',
    orderIndex: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (lesson) {
      setFormData({
        title: lesson.title || '',
        description: lesson.description || '',
        googleDriveUrl: lesson.googleDriveUrl || '',
        duration: lesson.duration?.toString() || '',
        orderIndex: lesson.orderIndex || 0,
      });
    } else {
      setFormData({
        title: '',
        description: '',
        googleDriveUrl: '',
        duration: '',
        orderIndex: 0,
      });
    }
  }, [lesson]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (lesson) {
        // Update lesson - only send fields that can be updated
        const updateData = {
          title: formData.title,
          description: formData.description,
          googleDriveUrl: formData.googleDriveUrl,
          duration: formData.duration ? parseInt(formData.duration) : undefined,
          orderIndex: parseInt(formData.orderIndex.toString()) || 0,
        };
        await lessonsAPI.updateLesson(lesson.id, updateData);
      } else {
        // Create lesson - include courseId
        const createData = {
          ...formData,
          courseId: courseId,
          duration: formData.duration ? parseInt(formData.duration) : undefined,
          orderIndex: parseInt(formData.orderIndex.toString()) || 0,
          isActive: true,
        };
        await lessonsAPI.createLesson(createData);
      }
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при сохранении');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
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
      onTouchMove={(e) => {
        // Предотвращаем прокрутку фона
        const target = e.target as HTMLElement;
        if (!target.closest('.modal-content')) {
          e.preventDefault();
        }
      }}
    >
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={onClose}
        style={{ touchAction: 'none' }}
      />
      
      <div 
        className="relative w-full max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl modal-content" 
        style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-card rounded-t-2xl sm:rounded-2xl p-6 pb-24 sm:pb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-pastel-800">
              {lesson ? 'Редактировать урок' : 'Добавить урок'}
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
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-pastel-700 mb-2">
                Название урока *
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                value={formData.title}
                onChange={handleChange}
                className="input-field"
                placeholder="Название урока"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-pastel-700 mb-2">
                Описание
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="input-field"
                rows={4}
                placeholder="Описание урока"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="googleDriveUrl" className="block text-sm font-medium text-pastel-700 mb-2">
                  Ссылка на Google Drive
                </label>
                <input
                  id="googleDriveUrl"
                  name="googleDriveUrl"
                  type="url"
                  value={formData.googleDriveUrl}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="https://drive.google.com/..."
                />
              </div>

              <div>
                <label htmlFor="duration" className="block text-sm font-medium text-pastel-700 mb-2">
                  Длительность (минуты)
                </label>
                <input
                  id="duration"
                  name="duration"
                  type="number"
                  min="1"
                  value={formData.duration}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="30"
                />
              </div>
            </div>

            <div>
              <label htmlFor="orderIndex" className="block text-sm font-medium text-pastel-700 mb-2">
                Порядок урока
              </label>
              <input
                id="orderIndex"
                name="orderIndex"
                type="number"
                min="0"
                value={formData.orderIndex}
                onChange={handleChange}
                className="input-field"
                placeholder="0"
              />
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
                {loading ? 'Сохранение...' : (lesson ? 'Обновить' : 'Создать')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LessonModal;
