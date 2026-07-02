import React, { useEffect, useState } from 'react';
import { bookingResourcesAPI, bookingTagsAPI } from '../api/client';
import type { BookingResource, BookingResourceType, BookingTag } from '../types';
import { Plus } from 'lucide-react';

interface BookingResourceModalProps {
  type: BookingResourceType;
  resource?: BookingResource | null;
  onClose: () => void;
}

const BookingResourceModal: React.FC<BookingResourceModalProps> = ({ type, resource, onClose }) => {
  const [name, setName] = useState(resource?.name || '');
  const [zoomUrl, setZoomUrl] = useState(resource?.zoomUrl || '');
  const [description, setDescription] = useState(resource?.description || '');
  const [availableTags, setAvailableTags] = useState<BookingTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(resource?.tags?.map((tag) => tag.id) || []);
  const [newTagName, setNewTagName] = useState('');
  const [creatingTag, setCreatingTag] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTags = async () => {
      try {
        const response = await bookingTagsAPI.getTags();
        setAvailableTags(response.tags);
      } catch (loadError) {
        console.error('Error loading booking tags:', loadError);
      }
    };

    void loadTags();
  }, []);

  useEffect(() => {
    setName(resource?.name || '');
    setZoomUrl(resource?.zoomUrl || '');
    setDescription(resource?.description || '');
    setSelectedTagIds(resource?.tags?.map((tag) => tag.id) || []);
    setNewTagName('');
    setError(null);
  }, [resource]);

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]
    );
  };

  const handleCreateTag = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) {
      return;
    }

    try {
      setCreatingTag(true);
      setError(null);
      const response = await bookingTagsAPI.createTag(trimmed);
      setAvailableTags((current) => {
        if (current.some((tag) => tag.id === response.tag.id)) {
          return current;
        }
        return [...current, response.tag].sort((left, right) => left.name.localeCompare(right.name, 'ru'));
      });
      setSelectedTagIds((current) =>
        current.includes(response.tag.id) ? current : [...current, response.tag.id]
      );
      setNewTagName('');
    } catch (createError: any) {
      setError(createError.response?.data?.message || 'Не удалось создать тег');
    } finally {
      setCreatingTag(false);
    }
  };

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
        tagIds: selectedTagIds,
      };

      if (resource) {
        await bookingResourcesAPI.updateResource(resource.id, payload);
      } else {
        await bookingResourcesAPI.createResource({
          name: payload.name,
          type: payload.type,
          zoomUrl: type === 'zoom' ? zoomUrl.trim() || undefined : undefined,
          description: payload.description,
          tagIds: payload.tagIds,
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

          <div>
            <label className="block text-sm font-medium text-pastel-700 mb-2">Теги</label>
            {availableTags.length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-3">
                {availableTags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors ${
                        isSelected
                          ? 'bg-primary-500 text-white'
                          : 'bg-pastel-100 text-pastel-700 hover:bg-pastel-200'
                      }`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-pastel-500 mb-3">Пока нет тегов. Создайте первый ниже.</p>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="input-field"
                placeholder="Новый тег, например SCRUM"
                maxLength={50}
              />
              <button
                type="button"
                onClick={() => void handleCreateTag()}
                disabled={creatingTag || !newTagName.trim()}
                className="btn-secondary whitespace-nowrap disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-1">
                  <Plus className="w-4 h-4" />
                  {creatingTag ? '...' : 'Тег'}
                </span>
              </button>
            </div>
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
