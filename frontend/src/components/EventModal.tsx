import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Event } from '../types';
import { eventsAPI, uploadAPI } from '../api/client';
import ImageWithLoader from './ImageWithLoader';
import DatePicker from './DatePicker';
import { useTelegram } from '../contexts/TelegramContext';

interface EventModalProps {
  event: Event | null;
  onClose: () => void;
}

const EventModal: React.FC<EventModalProps> = ({ event, onClose }) => {
  const { isTelegram } = useTelegram();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    googleDriveUrl: '',
    previewImages: [] as string[],
    eventDate: '',
  });
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || '',
        description: event.description || '',
        googleDriveUrl: event.googleDriveUrl || '',
        previewImages: event.previewImages || [],
        eventDate: event.eventDate ? event.eventDate.split('T')[0] : '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        googleDriveUrl: '',
        previewImages: [],
        eventDate: '',
      });
    }
  }, [event]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (event) {
        await eventsAPI.updateEvent(event.id, {
          ...formData,
          previewImages: formData.previewImages,
        });
      } else {
        await eventsAPI.createEvent({
          ...formData,
          previewImages: formData.previewImages,
          isActive: true,
        });
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

  const handleRemoveImage = (index: number) => {
    setFormData({
      ...formData,
      previewImages: formData.previewImages.filter((_, i) => i !== index),
    });
  };

  const handleUploadImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) {
      return;
    }

    setUploadingImages(true);
    setError('');

    try {
      const uploadedImages = await Promise.all(
        files.map(async (file) => {
          const result = await uploadAPI.uploadPhoto(file);
          return result.url;
        })
      );

      setFormData((prev) => ({
        ...prev,
        previewImages: [...prev.previewImages, ...uploadedImages],
      }));
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Ошибка при загрузке изображений');
    } finally {
      setUploadingImages(false);
      e.target.value = '';
    }
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
      className={`fixed inset-0 z-50 ${isTelegram ? '' : 'flex items-end sm:items-center justify-center p-0 sm:p-4'}`}
      style={isTelegram ? {} : { touchAction: 'none', overflow: 'hidden' }}
      onTouchMove={isTelegram ? undefined : (e) => {
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
        className={`${isTelegram ? 'fixed inset-0' : 'relative'} w-full ${isTelegram ? 'h-full max-w-none max-h-none' : 'max-w-2xl max-h-[85vh] sm:max-h-[90vh]'} overflow-y-auto bg-white ${isTelegram ? 'rounded-none' : 'rounded-t-2xl sm:rounded-2xl'} modal-content`}
        style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch', height: isTelegram ? '100vh' : undefined }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`glass-card ${isTelegram ? 'rounded-none' : 'rounded-t-2xl sm:rounded-2xl'} p-6 ${isTelegram ? 'pb-24' : 'pb-24 sm:pb-8'}`}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-pastel-800">
              {event ? 'Редактировать мероприятие' : 'Добавить мероприятие'}
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
              <label htmlFor="eventDate" className="block text-sm font-medium text-pastel-700 mb-2">
                Дата мероприятия
              </label>
              <DatePicker
                id="eventDate"
                value={formData.eventDate}
                onChange={(eventDate) => setFormData((prev) => ({ ...prev, eventDate }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-pastel-700 mb-2">
                Превью изображения
              </label>
              <div className="mb-3">
                <input
                  id="previewImagesUpload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  onChange={handleUploadImages}
                  disabled={uploadingImages || loading}
                  className="input-field"
                />
                <p className="text-xs text-pastel-500 mt-1">
                  Загружайте файлы сюда: они сохраняются на сервере и стабильно открываются в Mini App.
                </p>
              </div>
              {uploadingImages && (
                <p className="text-sm text-pastel-500">Загрузка изображений...</p>
              )}
              
              {formData.previewImages.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                  {formData.previewImages.map((image, index) => (
                    <div key={index} className="relative group h-24">
                      <ImageWithLoader
                        src={image}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                disabled={loading || uploadingImages}
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={loading || uploadingImages}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Сохранение...' : uploadingImages ? 'Загрузка...' : (event ? 'Обновить' : 'Создать')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EventModal;

