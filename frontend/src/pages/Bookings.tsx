import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { bookingResourcesAPI, bookingsAPI } from '../api/client';
import type { Booking, BookingResource, BookingResourceType } from '../types';
import { ChevronLeft, ChevronRight, Clock, ExternalLink, Plus, Repeat, Settings, Video } from 'lucide-react';
import BookingModal from '../components/BookingModal';
import BookingResourceModal from '../components/BookingResourceModal';
import DatePicker from '../components/DatePicker';
import {
  addDays,
  extractIsoDate,
  formatWeekRange,
  formatWeekdayShort,
  getWeekDays,
  getWeekStart,
  isPastDate,
  isSameDate,
  toInputDate,
} from '../utils/date';
import { formatBookingTimeRange, getBookingDate } from '../utils/bookingTime';

const formatTimeRange = (booking: Booking): string => {
  if (booking.startTime && booking.endTime) {
    return `${booking.startTime}–${booking.endTime}`;
  }

  return formatBookingTimeRange(booking.startsAt, booking.endsAt);
};

const Bookings: React.FC = () => {
  const { isAdmin, user } = useAuth();
  const [activeTab, setActiveTab] = useState<BookingResourceType>('room');
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [resources, setResources] = useState<BookingResource[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resourceModal, setResourceModal] = useState<BookingResource | null | undefined>(undefined);
  const [bookingModal, setBookingModal] = useState<{
    resource: BookingResource;
    booking?: Booking | null;
    date: string;
  } | null>(null);

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const weekEnd = weekDays[6];
  const today = useMemo(() => toInputDate(new Date()), []);

  const filteredResources = useMemo(
    () => resources.filter((resource) => resource.type === activeTab),
    [resources, activeTab]
  );

  const bookingModalResource = useMemo(() => {
    if (!bookingModal) {
      return null;
    }

    return resources.find((resource) => resource.id === bookingModal.resource.id) || bookingModal.resource;
  }, [bookingModal, resources]);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(null);

      let resourcesError: string | null = null;
      let bookingsError: string | null = null;

      const [resourcesResponse, bookingsResponse] = await Promise.all([
        bookingResourcesAPI.getResources().catch((error: any) => {
          resourcesError = error.response?.data?.message || 'Не удалось загрузить ресурсы';
          return { resources: [] as BookingResource[] };
        }),
        bookingsAPI
          .getBookings({ fromDate: weekStart, toDate: weekEnd, type: activeTab })
          .catch((error: any) => {
            bookingsError = error.response?.data?.message || 'Не удалось загрузить брони';
            return { bookings: [] as Booking[] };
          }),
      ]);

      setResources(resourcesResponse.resources);
      setBookings(bookingsResponse.bookings);
      setLoadError(resourcesError || bookingsError);
    } catch (error: any) {
      console.error('Error loading bookings page:', error);
      setLoadError(error.response?.data?.message || 'Не удалось загрузить расписание');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [weekStart, activeTab]);

  const getResourceBookingsForDay = (resourceId: string, day: string) =>
    bookings
      .filter(
        (booking) =>
          booking.resourceId === resourceId &&
          (booking.date || getBookingDate(booking.startsAt)) === extractIsoDate(day)
      )
      .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());

  const canManageBooking = (booking: Booking) =>
    isAdmin || booking.userId === user?.id;

  const handleDeleteResource = async (resource: BookingResource) => {
    if (!window.confirm(`Скрыть «${resource.name}»?`)) {
      return;
    }

    try {
      setLoadError(null);
      await bookingResourcesAPI.deleteResource(resource.id);
      await loadData();
    } catch (error: any) {
      console.error('Hide booking resource error:', error);
      setLoadError(error.response?.data?.message || 'Не удалось скрыть ресурс');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-pastel-800">Расписание</h1>
          <p className="text-pastel-600 mt-1">
            Переговорки и Zoom — бронировать может каждый, редактировать — автор или админ
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-pastel-200 bg-white/70 px-2 py-1">
            <button
              type="button"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="p-2 rounded-lg text-pastel-700 hover:bg-pastel-50"
              aria-label="Предыдущая неделя"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setWeekStart(getWeekStart(new Date()))}
              className="px-3 py-1.5 text-sm font-medium text-primary-700 hover:bg-primary-50 rounded-lg whitespace-nowrap"
            >
              Сегодня
            </button>
            <button
              type="button"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="p-2 rounded-lg text-pastel-700 hover:bg-pastel-50"
              aria-label="Следующая неделя"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <DatePicker
              value={weekStart}
              onChange={(value) => setWeekStart(getWeekStart(value))}
              allowClear={false}
              className="w-[160px] border-0 bg-transparent shadow-none"
            />
          </div>
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
        {formatWeekRange(weekStart, weekEnd)} · слоты проверяются на пересечение автоматически
      </p>

      {loadError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

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
        <div className="space-y-6">
          {filteredResources.map((resource) => (
            <div key={resource.id} className="card p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                {weekDays.map((day) => {
                  const dayBookings = getResourceBookingsForDay(resource.id, day);
                  const isToday = isSameDate(day, today);
                  const pastDay = isPastDate(day);

                  return (
                    <div
                      key={day}
                      className={`rounded-xl border p-3 min-h-[180px] flex flex-col ${
                        isToday
                          ? 'border-primary-300 bg-primary-50/40'
                          : 'border-pastel-100 bg-pastel-50/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide ${
                            isToday ? 'text-primary-700' : 'text-pastel-700'
                          }`}
                        >
                          {formatWeekdayShort(day)}
                        </p>
                        {!pastDay && (
                          <button
                            type="button"
                            onClick={() => setBookingModal({ resource, date: day })}
                            className="p-1 rounded-md text-primary-600 hover:bg-primary-100"
                            title="Забронировать"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="space-y-2 flex-1">
                        {dayBookings.length === 0 ? (
                          <p className="text-xs text-pastel-500">Свободно</p>
                        ) : (
                          dayBookings.map((booking) => {
                            const manageable = canManageBooking(booking);

                            return (
                              <button
                                key={booking.id}
                                type="button"
                                onClick={() => {
                                  setBookingModal({
                                    resource,
                                    booking,
                                    date: booking.date || getBookingDate(booking.startsAt),
                                  });
                                }}
                                className={`w-full text-left rounded-lg border px-2 py-2 transition-colors ${
                                  manageable
                                    ? 'border-pastel-200 bg-white hover:border-primary-300'
                                    : 'border-pastel-200 bg-white/80'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1">
                                      <p className="text-xs font-medium text-pastel-800 truncate">
                                        {booking.title}
                                      </p>
                                      {booking.recurrenceGroupId && (
                                        <Repeat className="w-3 h-3 text-primary-600 shrink-0" />
                                      )}
                                    </div>
                                    <p className="text-[11px] text-pastel-600 truncate mt-0.5">
                                      {booking.employeeName || booking.userEmail}
                                    </p>
                                    {booking.tags && booking.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {booking.tags.map((tag) => (
                                          <span
                                            key={tag.id}
                                            className="inline-flex rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700"
                                          >
                                            {tag.name}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-0.5 text-[11px] text-pastel-700 whitespace-nowrap shrink-0">
                                    <Clock className="w-3 h-3" />
                                    {formatTimeRange(booking)}
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {isAdmin && resourceModal !== undefined && (
        <BookingResourceModal
          type={activeTab}
          resource={resourceModal}
          onClose={() => {
            setResourceModal(undefined);
            void loadData();
          }}
        />
      )}

      {bookingModal && bookingModalResource && (
        <BookingModal
          resource={bookingModalResource}
          booking={bookingModal.booking}
          canManage={bookingModal.booking ? canManageBooking(bookingModal.booking) : true}
          isAdmin={isAdmin}
          date={bookingModal.date}
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
