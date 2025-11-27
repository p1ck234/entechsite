import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Course } from '../types';
import { coursesAPI } from '../api/client';

interface CourseModalProps {
  course: Course | null;
  onClose: () => void;
}

const CourseModal: React.FC<CourseModalProps> = ({ course, onClose }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    googleDriveUrl: '',
    duration: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (course) {
      setFormData({
        title: course.title,
        description: course.description || '',
        googleDriveUrl: course.googleDriveUrl,
        duration: course.duration?.toString() || '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        googleDriveUrl: '',
        duration: '',
      });
    }
  }, [course]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const courseData = {
        ...formData,
        duration: formData.duration ? parseInt(formData.duration) : undefined,
        isActive: true,
      };

      if (course) {
        await coursesAPI.updateCourse(course.id, courseData);
      } else {
        await coursesAPI.createCourse(courseData);
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ touchAction: 'none' }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl" style={{ touchAction: 'pan-y' }}>
        <div className="glass-card rounded-t-2xl sm:rounded-2xl p-6 pb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-pastel-800">
              {course ? 'Редактировать курс' : 'Добавить курс'}
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
                Название курса *
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                value={formData.title}
                onChange={handleChange}
                className="input-field"
                placeholder="Название курса"
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
                placeholder="Описание курса"
              />
            </div>

            <div>
              <label htmlFor="googleDriveUrl" className="block text-sm font-medium text-pastel-700 mb-2">
                Ссылка на Google Drive *
              </label>
              <input
                id="googleDriveUrl"
                name="googleDriveUrl"
                type="url"
                required
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
                placeholder="120"
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
                {loading ? 'Сохранение...' : (course ? 'Обновить' : 'Создать')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CourseModal;
