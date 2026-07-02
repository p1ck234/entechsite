import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { eventsAPI } from '../api/client';
import { Event, EventsResponse } from '../types';
import { ExternalLink, Plus, Edit, Trash2, Calendar, ImageOff, RefreshCw, Image } from 'lucide-react';
import EventModal from '../components/EventModal';
import EventGalleryModal from '../components/EventGalleryModal';
import ImageWithLoader from '../components/ImageWithLoader';
import { preloadImages } from '../utils/imagePreload';

const EVENT_PREVIEW_IMAGE_OPTIONS = {
  width: 320,
  height: 320,
  quality: 64,
  fit: 'cover',
} as const;

const EventPreviewTile: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [src]);

  if (!src?.trim() || imageError) {
    return (
      <div className="w-full h-full bg-pastel-100 flex items-center justify-center">
        <ImageOff className="w-5 h-5 text-pastel-400" />
      </div>
    );
  }

  return (
    <ImageWithLoader
      src={src}
      alt={alt}
      className="w-full h-full object-cover"
      imageOptions={EVENT_PREVIEW_IMAGE_OPTIONS}
      onLoadError={() => {
        setImageError(true);
      }}
      onError={() => {
        setImageError(true);
      }}
    />
  );
};

const Life: React.FC = () => {
  const { isAdmin } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [galleryEvent, setGalleryEvent] = useState<Event | null>(null);
  const [syncingLife, setSyncingLife] = useState(false);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response: EventsResponse = await eventsAPI.getEvents({
        page: 1,
        limit: 50,
      });

      const preloadEntries = response.events.flatMap((event) =>
        (event.previewImages || []).slice(0, 4).map((src) => ({
          src,
          options: EVENT_PREVIEW_IMAGE_OPTIONS
        }))
      );

      preloadImages(preloadEntries, 80);
      setEvents(response.events);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    
    if (window.confirm('Вы уверены, что хотите удалить это мероприятие?')) {
      try {
        await eventsAPI.deleteEvent(id);
        fetchEvents();
      } catch (error) {
        console.error('Error deleting event:', error);
      }
    }
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingEvent(null);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingEvent(null);
    fetchEvents();
  };

  const handleSyncLife = async () => {
    if (!isAdmin || syncingLife) return;

    try {
      setSyncingLife(true);
      const result = await eventsAPI.syncLifeFromDrive();
      await fetchEvents();
      window.alert(
        `${result.message}\n` +
        `Элементов найдено: ${result.eventsFound}\n` +
        `Событий создано: ${result.eventsCreated}, обновлено: ${result.eventsUpdated}, без изменений: ${result.eventsUnchanged}\n` +
        `Скрыто старых событий: ${result.eventsArchived}\n` +
        `Пропущено без даты в названии: ${result.eventsSkippedNoDate}`
      );
    } catch (error: any) {
      console.error('Error syncing life from Google Drive:', error);
      window.alert(error.response?.data?.message || error.message || 'Ошибка синхронизации Google Drive');
    } finally {
      setSyncingLife(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-pastel-800">Наша жизнь</h1>
          <p className="text-pastel-600 mt-1">Мероприятия и события компании</p>
        </div>
        {isAdmin && (
          <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleSyncLife}
              disabled={syncingLife}
              className="btn-secondary flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-5 h-5 ${syncingLife ? 'animate-spin' : ''}`} />
              <span>{syncingLife ? 'Синхронизация...' : 'Синхронизировать Drive'}</span>
            </button>
            <button
              onClick={handleAdd}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Добавить мероприятие</span>
            </button>
          </div>
        )}
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-pastel-600 text-lg">Пока нет мероприятий</p>
          {isAdmin && (
            <p className="text-pastel-500 text-sm mt-2">Добавьте первое мероприятие, нажав кнопку выше</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <div key={event.id} className="card overflow-hidden hover:scale-105 transition-transform">
              <button
                type="button"
                onClick={() => setGalleryEvent(event)}
                className="w-full text-left"
              >
                {event.previewImages && event.previewImages.length > 0 ? (
                  <div className="relative h-48 bg-pastel-100 overflow-hidden">
                    <div className="grid grid-cols-2 gap-1 h-full">
                      {event.previewImages.slice(0, 4).map((image, index) => (
                        <div key={index} className="relative overflow-hidden">
                          <EventPreviewTile
                            src={image}
                            alt={`${event.title} ${index + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="relative h-48 bg-pastel-100 overflow-hidden flex items-center justify-center">
                    <div className="text-center text-pastel-500">
                      <Image className="w-10 h-10 mx-auto mb-2" />
                      <span className="text-sm">Смотреть фото</span>
                    </div>
                  </div>
                )}
              </button>
              
              {/* Event Info */}
              <div className="p-6">
                <h3 className="text-xl font-semibold text-pastel-800 mb-2">
                  {event.title}
                </h3>
                
                {event.eventDate && (
                  <div className="flex items-center space-x-2 text-pastel-600 text-sm mb-3">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(event.eventDate)}</span>
                  </div>
                )}
                
                {event.description && (
                  <p className="text-pastel-600 text-sm mb-4 line-clamp-2">
                    {event.description}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setGalleryEvent(event)}
                  className="btn-primary w-full flex items-center justify-center space-x-2 mb-3"
                >
                  <Image className="w-4 h-4" />
                  <span>Смотреть фото</span>
                </button>

                <a
                  href={event.googleDriveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary w-full flex items-center justify-center space-x-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Открыть в Google Drive</span>
                </a>

                {/* Admin Actions */}
                {isAdmin && (
                  <div
                    className="flex justify-end space-x-2 pt-3 border-t border-pastel-200"
                    onClick={(clickEvent) => clickEvent.stopPropagation()}
                  >
                    <button
                      onClick={() => handleEdit(event)}
                      className="p-2 text-pastel-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(event.id)}
                      className="p-2 text-pastel-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Event Modal */}
      {showModal && (
        <EventModal
          event={editingEvent}
          onClose={handleModalClose}
        />
      )}

      {galleryEvent && (
        <EventGalleryModal
          event={galleryEvent}
          onClose={() => setGalleryEvent(null)}
        />
      )}
    </div>
  );
};

export default Life;

