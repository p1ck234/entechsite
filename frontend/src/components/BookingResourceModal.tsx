import React, { useEffect, useState } from 'react';
import { bookingResourcesAPI } from '../api/client';
import type { BookingResource, BookingResourceType } from '../types';

interface BookingResourceModalProps {
  type: BookingResourceType;
  resource?: BookingResource | null;
  onClose: () => void;
}

const BookingResourceModal: React.FC<BookingResourceModalProps> = ({ type, resource, onClose }) => {
  const [name, setName] = useState(resource?.name || '');
  const [zoomUrl, setZoomUrl] = useState(resource?.zoomUrl || '');
  const [description, setDescription] = useState(resource?.description || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(resource?.name || '');
    setZoomUrl(resource?.zoomUrl || '');
    setDescription(resource?.description || '');
    setError(null);
  }, [resource]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      setError('Укажите название');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        name: name.trim(),
        type,
        zoomUrl: type === 'zoom' ? zoomUrl.trim() || null : null,
        description: description.trim() || undefined,
      };

      if (resource) {
        await bookingResourcesAPI.updateResource(resource.id, payload);
      } else {
        await bookingResourcesAPI.createResource({
          name: payload.name,
          type: payload.type,
          zoomUrl: type === 'zoom' ? zoomUrl.trim() || undefined : undefined,
          description: payload.description,
        });
      }

      onClose();
    } catch (submitError: any) {
      setError(submitError.response?.data?.message || 'Не удалось сохранить ресурс');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-pastel-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-pastel-800">
            {resource ? 'Редактировать' : 'Добавить'} {type === 'room' ? 'переговорку' : 'Zoom'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-pastel-700 mb-2">Название</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              placeholder={type === 'room' ? 'Переговорка 1' : 'Zoom 2'}
            />
          </div>

          {type === 'zoom' && (
            <div>
              <label className="block text-sm font-medium text-pastel-700 mb-2">Ссылка Zoom</label>
              <input
                type="url"
                value={zoomUrl}
                onChange={(e) => setZoomUrl(e.target.value)}
                className="input-field"
                placeholder="https://zoom.us/j/..."
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-pastel-700 mb-2">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field min-h-[90px]"
              placeholder="Необязательно"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Отмена
            </button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingResourceModal;
