import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { bookingResourcesAPI, bookingsAPI } from '../api/client';
import type { Booking, BookingResource, BookingResourceType } from '../types';
import { Clock, ExternalLink, Plus, Settings, Video } from 'lucide-react';
import BookingModal from '../components/BookingModal';
import BookingResourceModal from '../components/BookingResourceModal';
import DatePicker from '../components/DatePicker';
import { formatRuDate, toInputDate } from '../utils/date';

const formatTimeRange = (booking: Booking): string => {
  const startsAt = new Date(booking.startsAt);
  const endsAt = new Date(booking.endsAt);
  const start = `${String(startsAt.getHours()).padStart(2, '0')}:${String(startsAt.getMinutes()).padStart(2, '0')}`;
  const end = `${String(endsAt.getHours()).padStart(2, '0')}:${String(endsAt.getMinutes()).padStart(2, '0')}`;
  return `${start}–${end}`;
};

const BOOKING_MAX_ADVANCE_DAYS = 30;

const Bookings: React.FC = () => {
  const { isAdmin, user } = useAuth();
  const [activeTab, setActiveTab] = useState<BookingResourceType>('room');
  const [selectedDate, setSelectedDate] = useState(toInputDate(new Date()));
  const [resources, setResources] = useState<BookingResource[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [resourceModal, setResourceModal] = useState<BookingResource | null | undefined>(undefined);
  const [bookingModal, setBookingModal] = useState<{
    resource: BookingResource;
    booking?: Booking | null;
  } | null>(null);

  const filteredResources = useMemo(
    () => resources.filter((resource) => resource.type === activeTab),
    [resources, activeTab]
  );

  const minBookingDate = useMemo(() => toInputDate(new Date()), []);
  const maxBookingDate = useMemo(() => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + BOOKING_MAX_ADVANCE_DAYS);
    return toInputDate(maxDate);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [resourcesResponse, bookingsResponse] = await Promise.all([
        bookingResourcesAPI.getResources(),
        bookingsAPI.getBookings({ date: selectedDate, type: activeTab }),
      ]);
      setResources(resourcesResponse.resources);
      setBookings(bookingsResponse.bookings);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [selectedDate, activeTab]);

  const getResourceBookings = (resourceId: string) =>
    bookings
      .filter((booking) => booking.resourceId === resourceId)
      .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());

  const canManageBooking = (booking: Booking) =>
    isAdmin || booking.userId === user?.id;

  const handleDeleteResource = async (resource: BookingResource) => {
    if (!window.confirm(`Скрыть «${resource.name}»?`)) {
      return;
    }

    await bookingResourcesAPI.deleteResource(resource.id);
    await loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-pastel-800">Расписание</h1>
          <p className="text-pastel-600 mt-1">Переговорки и Zoom — бронирование без пересечений</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <DatePicker
            value={selectedDate}
            onChange={setSelectedDate}
            min={minBookingDate}
            max={maxBookingDate}
            allowClear={false}
            className="w-full sm:w-[260px]"
          />
          {isAdmin && (
            <button
              type="button"
              onClick={() => setResourceModal(null)}
              className="btn-secondary flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {activeTab === 'room' ? 'Добавить переговорку' : 'Добавить Zoom'}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('room')}
          className={`px-4 py-2 rounded-xl transition-colors ${
            activeTab === 'room' ? 'bg-primary-500 text-white' : 'bg-white/70 text-pastel-700'
          }`}
        >
          Переговорки
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('zoom')}
          className={`px-4 py-2 rounded-xl transition-colors ${
            activeTab === 'zoom' ? 'bg-primary-500 text-white' : 'bg-white/70 text-pastel-700'
          }`}
        >
          Zoom
        </button>
      </div>

      <p className="text-sm text-pastel-600">
        {formatRuDate(selectedDate)} · слоты проверяются на пересечение автоматически
      </p>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-pastel-700">
            {activeTab === 'room'
              ? 'Пока нет переговорок. Админ может добавить первую.'
              : 'Пока нет Zoom-аккаунтов. Админ может добавить Zoom 1.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {filteredResources.map((resource) => {
            const resourceBookings = getResourceBookings(resource.id);

            return (
              <div key={resource.id} className="card p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      {resource.type === 'zoom' ? (
                        <Video className="w-5 h-5 text-primary-600" />
                      ) : (
                        <Settings className="w-5 h-5 text-primary-600" />
                      )}
                      <h2 className="text-xl font-semibold text-pastel-800">{resource.name}</h2>
                    </div>
                    {resource.description && (
                      <p className="text-sm text-pastel-600 mt-1">{resource.description}</p>
                    )}
                    {resource.zoomUrl && (
                      <a
                        href={resource.zoomUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary-600 mt-2 hover:underline"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Ссылка Zoom
                      </a>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setResourceModal(resource)}
                        className="text-sm text-pastel-600 hover:text-primary-600"
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteResource(resource)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Скрыть
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-3 mb-5">
                  {resourceBookings.length === 0 ? (
                    <p className="text-sm text-pastel-500 bg-pastel-50 rounded-xl px-4 py-3">
                      На этот день свободно
                    </p>
                  ) : (
                    resourceBookings.map((booking) => (
                      <button
                        key={booking.id}
                        type="button"
                        onClick={() => {
                          if (canManageBooking(booking)) {
                            setBookingModal({ resource, booking });
                          }
                        }}
                        className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                          canManageBooking(booking)
                            ? 'border-pastel-200 hover:border-primary-300 hover:bg-primary-50/40'
                            : 'border-pastel-200 bg-pastel-50/60 cursor-default'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-pastel-800">{booking.title}</p>
                            <p className="text-sm text-pastel-600 mt-1">
                              {booking.employeeName || booking.userEmail}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-pastel-700 whitespace-nowrap">
                            <Clock className="w-4 h-4" />
                            {formatTimeRange(booking)}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setBookingModal({ resource })}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Забронировать
                </button>
              </div>
            );
          })}
        </div>
      )}

      {resourceModal !== undefined && (
        <BookingResourceModal
          type={activeTab}
          resource={resourceModal}
          onClose={() => {
            setResourceModal(undefined);
            void loadData();
          }}
        />
      )}

      {bookingModal && (
        <BookingModal
          resource={bookingModal.resource}
          booking={bookingModal.booking}
          date={selectedDate}
          onClose={() => {
            setBookingModal(null);
            void loadData();
          }}
        />
      )}
    </div>
  );
};

export default Bookings;
