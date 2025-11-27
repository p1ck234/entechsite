import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { CalendarEvent } from '../types';
import { calendarAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface CalendarEventModalProps {
  event: CalendarEvent | null;
  selectedDate?: Date | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const CalendarEventModal: React.FC<CalendarEventModalProps> = ({ event, selectedDate, onClose, onSuccess }) => {
  const { isAdmin } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventDate: '',
    eventTime: '',
    location: '',
    isAllDay: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (event) {
      // Format time to remove seconds if present
      let eventTime = event.eventTime || '';
      if (eventTime && eventTime.includes(':')) {
        const timeParts = eventTime.split(':');
        if (timeParts.length >= 2) {
          eventTime = `${timeParts[0]}:${timeParts[1]}`;
        }
      }
      
      setFormData({
        title: event.title || '',
        description: event.description || '',
        eventDate: event.eventDate ? event.eventDate.split('T')[0] : '',
        eventTime: eventTime,
        location: event.location || '',
        isAllDay: event.isAllDay || false,
      });
      setIsEditing(isAdmin); // Для админов сразу режим редактирования, для обычных - просмотр
    } else if (selectedDate) {
      const dateStr = formatDateForInput(selectedDate);
      setFormData({
        title: '',
        description: '',
        eventDate: dateStr,
        eventTime: '',
        location: '',
        isAllDay: false,
      });
      setIsEditing(false);
    } else {
      const today = formatDateForInput(new Date());
      setFormData({
        title: '',
        description: '',
        eventDate: today,
        eventTime: '',
        location: '',
        isAllDay: false,
      });
      setIsEditing(false);
    }
  }, [event, selectedDate, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const eventData: any = {
        title: formData.title.trim(),
        eventDate: formData.eventDate,
        isAllDay: formData.isAllDay,
      };

      if (formData.description && formData.description.trim()) {
        eventData.description = formData.description.trim();
      }

      if (formData.location && formData.location.trim()) {
        eventData.location = formData.location.trim();
      }

      if (!formData.isAllDay && formData.eventTime) {
        // Remove seconds if present (HH:MM:SS -> HH:MM)
        const timeStr = formData.eventTime.split(':').slice(0, 2).join(':');
        eventData.eventTime = timeStr;
      }

      if (event) {
        await calendarAPI.updateEvent(event.id, eventData);
      } else {
        await calendarAPI.createEvent(eventData);
      }
      
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving calendar event:', err);
      console.error('Error response:', err.response);
      const errorMessage = err.response?.data?.message || 
                          (err.response?.data?.errors && err.response.data.errors[0]?.msg) ||
                          err.message || 
                          'Ошибка при сохранении';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ touchAction: 'none' }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl" style={{ touchAction: 'pan-y' }}>
        <div className="glass-card rounded-t-2xl sm:rounded-2xl p-6 pb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-pastel-800">
              {event 
                ? (isEditing ? 'Редактировать мероприятие' : 'Мероприятие')
                : 'Добавить мероприятие'
              }
            </h2>
            <div className="flex items-center space-x-2">
              {event && !isEditing && isAdmin && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 text-sm btn-secondary"
                >
                  Редактировать
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-pastel-400 hover:text-pastel-600 hover:bg-pastel-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {event && !isEditing ? (
            // View mode for non-admin users or when not editing
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-pastel-700 mb-2">
                  Название мероприятия
                </label>
                <div className="input-field bg-pastel-50">
                  {formData.title}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-pastel-700 mb-2">
                  Дата
                </label>
                <div className="input-field bg-pastel-50">
                  {new Date(formData.eventDate).toLocaleDateString('ru-RU', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>

              {!formData.isAllDay && formData.eventTime && (
                <div>
                  <label className="block text-sm font-medium text-pastel-700 mb-2">
                    Время
                  </label>
                  <div className="input-field bg-pastel-50">
                    {formData.eventTime}
                  </div>
                </div>
              )}

              {formData.location && (
                <div>
                  <label className="block text-sm font-medium text-pastel-700 mb-2">
                    Место проведения
                  </label>
                  <div className="input-field bg-pastel-50">
                    {formData.location}
                  </div>
                </div>
              )}

              {formData.description && (
                <div>
                  <label className="block text-sm font-medium text-pastel-700 mb-2">
                    Описание
                  </label>
                  <div className="input-field bg-pastel-50 min-h-[80px] whitespace-pre-wrap">
                    {formData.description}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary"
                >
                  Закрыть
                </button>
              </div>
            </div>
          ) : (
            // Edit/Create mode
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-pastel-700 mb-2">
                  Название мероприятия *
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  value={formData.title}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Название мероприятия"
                />
              </div>

            <div>
              <label htmlFor="eventDate" className="block text-sm font-medium text-pastel-700 mb-2">
                Дата *
              </label>
              <input
                id="eventDate"
                name="eventDate"
                type="date"
                required
                value={formData.eventDate}
                onChange={handleChange}
                className="input-field"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                id="isAllDay"
                name="isAllDay"
                type="checkbox"
                checked={formData.isAllDay}
                onChange={handleChange}
                className="w-4 h-4 text-primary-600 rounded"
              />
              <label htmlFor="isAllDay" className="text-sm font-medium text-pastel-700">
                Весь день
              </label>
            </div>

            {!formData.isAllDay && (
              <div>
                <label htmlFor="eventTime" className="block text-sm font-medium text-pastel-700 mb-2">
                  Время
                </label>
                <input
                  id="eventTime"
                  name="eventTime"
                  type="time"
                  value={formData.eventTime}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>
            )}

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-pastel-700 mb-2">
                Место проведения
              </label>
              <input
                id="location"
                name="location"
                type="text"
                value={formData.location}
                onChange={handleChange}
                className="input-field"
                placeholder="Место проведения"
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
                rows={3}
                placeholder="Описание мероприятия"
              />
            </div>

              <div className="flex justify-between items-center pt-4">
                {event && isAdmin && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm('Вы уверены, что хотите удалить это мероприятие?')) {
                        try {
                          setLoading(true);
                          await calendarAPI.deleteEvent(event.id);
                          if (onSuccess) {
                            onSuccess();
                          }
                          onClose();
                        } catch (err: any) {
                          console.error('Error deleting event:', err);
                          setError(err.response?.data?.message || 'Ошибка при удалении');
                        } finally {
                          setLoading(false);
                        }
                      }
                    }}
                    className="btn-secondary text-red-600 hover:bg-red-50 border-red-200"
                    disabled={loading}
                  >
                    Удалить
                  </button>
                )}
                <div className="flex space-x-4 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      if (event && isEditing) {
                        setIsEditing(false);
                      } else {
                        onClose();
                      }
                    }}
                    className="btn-secondary"
                    disabled={loading}
                  >
                    {event && isEditing ? 'Отмена' : 'Закрыть'}
                  </button>
                  {isAdmin && (
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Сохранение...' : (event ? 'Обновить' : 'Создать')}
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarEventModal;

