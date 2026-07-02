import React, { useEffect, useMemo, useState } from 'react';
import { bookingsAPI } from '../api/client';
import type { Booking, BookingRecurrenceType, BookingResource } from '../types';
import DatePicker from './DatePicker';
import {
  RECURRENCE_OPTIONS,
  expandRecurrenceDates,
  getMaxBookingDate,
} from '../utils/bookingRecurrence';

interface BookingModalProps {
  resource: BookingResource;
  date: string;
  booking?: Booking | null;
  onClose: () => void;
}

const BookingModal: React.FC<BookingModalProps> = ({ resource, date, booking, onClose }) => {
  const [title, setTitle] = useState(booking?.title || '');
  const [description, setDescription] = useState(booking?.description || '');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [recurrenceType, setRecurrenceType] = useState<BookingRecurrenceType>('none');
  const [untilDate, setUntilDate] = useState(getMaxBookingDate());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxBookingDate = useMemo(() => getMaxBookingDate(), []);

  useEffect(() => {
    if (!booking) {
      setTitle('');
      setDescription('');
      setStartTime('10:00');
      setEndTime('11:00');
      setRecurrenceType('none');
      setUntilDate(maxBookingDate);
      setError(null);
      return;
    }

    const startsAt = new Date(booking.startsAt);
    const endsAt = new Date(booking.endsAt);
    setTitle(booking.title);
    setDescription(booking.description || '');
    setStartTime(
      `${String(startsAt.getHours()).padStart(2, '0')}:${String(startsAt.getMinutes()).padStart(2, '0')}`
    );
    setEndTime(
      `${String(endsAt.getHours()).padStart(2, '0')}:${String(endsAt.getMinutes()).padStart(2, '0')}`
    );
    setRecurrenceType('none');
    setError(null);
  }, [booking, maxBookingDate]);

  const occurrenceDates = useMemo(() => {
    if (booking || recurrenceType === 'none') {
      return [date];
    }

    return expandRecurrenceDates(date, {
      type: recurrenceType,
      untilDate,
    });
  }, [booking, recurrenceType, untilDate, date]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!title.trim()) {
      setError('Укажите тему встречи');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (booking) {
        await bookingsAPI.updateBooking(booking.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          date,
          startTime,
          endTime,
        });
      } else {
        await bookingsAPI.createBooking({
          resourceId: resource.id,
          title: title.trim(),
          description: description.trim() || undefined,
          date,
          startTime,
          endTime,
          recurrence:
            recurrenceType === 'none'
              ? undefined
              : {
                  type: recurrenceType,
                  untilDate,
                },
        });
      }

      onClose();
    } catch (submitError: any) {
      setError(submitError.response?.data?.message || 'Не удалось сохранить бронирование');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (scope: 'single' | 'series') => {
    if (!booking) {
      return;
    }

    const message =
      scope === 'series'
        ? 'Отменить всю серию повторяющихся встреч?'
        : 'Отменить только эту встречу?';

    if (!window.confirm(message)) {
      return;
    }

    try {
      setSaving(true);
      await bookingsAPI.cancelBooking(booking.id, scope);
      onClose();
    } catch (cancelError: any) {
      setError(cancelError.response?.data?.message || 'Не удалось отменить бронирование');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-pastel-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-pastel-800">
            {booking ? 'Редактировать бронь' : 'Новое бронирование'}
          </h2>
          <p className="text-sm text-pastel-500 mt-1">
            {resource.name} · {date}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-pastel-700 mb-2">Тема</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field"
              placeholder="Созвон с командой"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-pastel-700 mb-2">Начало</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="input-field"
                step={1800}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-pastel-700 mb-2">Окончание</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="input-field"
                step={1800}
              />
            </div>
          </div>

          {!booking && (
            <>
              <div>
                <label className="block text-sm font-medium text-pastel-700 mb-2">Повторение</label>
                <select
                  value={recurrenceType}
                  onChange={(e) => setRecurrenceType(e.target.value as BookingRecurrenceType)}
                  className="input-field"
                >
                  {RECURRENCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {recurrenceType !== 'none' && (
                <div>
                  <label className="block text-sm font-medium text-pastel-700 mb-2">Повторять до</label>
                  <DatePicker
                    value={untilDate}
                    onChange={setUntilDate}
                    min={date}
                    max={maxBookingDate}
                    allowClear={false}
                  />
                  <p className="text-xs text-pastel-500 mt-2">
                    Будет создано встреч: {occurrenceDates.length}
                  </p>
                </div>
              )}
            </>
          )}

          {booking?.recurrenceGroupId && (
            <p className="text-xs text-primary-700 bg-primary-50 rounded-xl px-3 py-2">
              Это повторяющаяся встреча. Редактирование меняет только выбранный слот.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-pastel-700 mb-2">Комментарий</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field min-h-[80px]"
              placeholder="Необязательно"
            />
          </div>

          <p className="text-xs text-pastel-500">
            Рабочие часы: 09:00–19:00. Минимум 30 минут, максимум 4 часа.
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-col sm:flex-row sm:justify-between gap-3 pt-2">
            {booking ? (
              booking.recurrenceGroupId ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCancel('single')}
                    disabled={saving}
                    className="btn-secondary text-red-600 border-red-200 hover:bg-red-50"
                  >
                    Отменить эту
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCancel('series')}
                    disabled={saving}
                    className="btn-secondary text-red-700 border-red-300 hover:bg-red-50"
                  >
                    Отменить серию
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleCancel('single')}
                  disabled={saving}
                  className="btn-secondary text-red-600 border-red-200 hover:bg-red-50"
                >
                  Отменить бронь
                </button>
              )
            ) : (
              <span />
            )}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className="btn-secondary">
                Закрыть
              </button>
              <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
                {saving
                  ? 'Сохранение...'
                  : booking
                    ? 'Сохранить'
                    : occurrenceDates.length > 1
                      ? `Забронировать (${occurrenceDates.length})`
                      : 'Забронировать'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingModal;
