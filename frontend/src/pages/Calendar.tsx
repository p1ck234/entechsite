import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { calendarAPI } from '../api/client';
import { CalendarEvent } from '../types';
import { ChevronLeft, ChevronRight, Plus, Clock } from 'lucide-react';
import CalendarEventModal from '../components/CalendarEventModal';
import { extractIsoDate } from '../utils/date';

const Calendar: React.FC = () => {
  const { isAdmin } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const adjustedStartingDay = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1; // Monday = 0

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await calendarAPI.getEvents({
        month: month + 1,
        year: year
      });
      setEvents(response.events);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [currentDate]);

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const dayEvents = events.filter(event => {
      const eventDateStr = extractIsoDate(event.eventDate);
      return eventDateStr === dateStr;
    });
    
    return dayEvents;
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    if (isAdmin) {
      setEditingEvent(null);
      setShowModal(true);
    }
  };

  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEvent(event);
    // Нормализуем дату из разных форматов API (с T, пробелом и т.д.)
    const dateStr = extractIsoDate(event.eventDate);
    if (!dateStr) {
      setSelectedDate(new Date());
      setShowModal(true);
      return;
    }
    const [year, month, day] = dateStr.split('-').map(Number);
    setSelectedDate(new Date(year, month - 1, day));
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingEvent(null);
    setSelectedDate(null);
    fetchEvents();
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === month && date.getFullYear() === year;
  };

  const renderCalendarDays = () => {
    const days = [];
    const totalCells = Math.ceil((adjustedStartingDay + daysInMonth) / 7) * 7;

    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = adjustedStartingDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      days.push(date);
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    // Next month days
    const remainingDays = totalCells - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      days.push(new Date(year, month + 1, day));
    }

    return days;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-pastel-800">Календарь мероприятий</h1>
          <p className="text-pastel-600 mt-1 text-sm sm:text-base">Планирование и отслеживание событий</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setSelectedDate(new Date());
              setEditingEvent(null);
              setShowModal(true);
            }}
            className="btn-primary flex items-center justify-center space-x-2 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-sm sm:text-base">Добавить мероприятие</span>
          </button>
        )}
      </div>

      {/* Calendar Navigation */}
      <div className="glass-card p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <button
            onClick={handlePreviousMonth}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-pastel-700" />
          </button>
          
          <div className="flex items-center space-x-2 sm:space-x-4 flex-1 justify-center">
            <h2 className="text-lg sm:text-2xl font-bold text-pastel-800 text-center">
              {monthNames[month]} {year}
            </h2>
            <button
              onClick={handleToday}
              className="btn-secondary text-xs sm:text-sm px-2 sm:px-4 py-1 sm:py-2"
            >
              Сегодня
            </button>
          </div>
          
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
            aria-label="Следующий месяц"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-pastel-700" />
          </button>
        </div>

        {/* Calendar Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {/* Day headers */}
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center font-semibold text-pastel-700 py-1 sm:py-2 text-xs sm:text-sm"
              >
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {renderCalendarDays().map((date, index) => {
              const dayEvents = getEventsForDate(date);
              const isCurrentMonthDay = isCurrentMonth(date);
              const isTodayDay = isToday(date);

              return (
                <div
                  key={index}
                  onClick={() => isAdmin && handleDateClick(date)}
                  className={`
                    min-h-[60px] sm:min-h-[80px] md:min-h-[100px] border border-pastel-200 rounded-lg p-1 sm:p-2
                    ${!isCurrentMonthDay ? 'opacity-40' : ''}
                    ${isTodayDay ? 'bg-primary-50 border-primary-300 border-2' : 'bg-white/50'}
                    ${isAdmin ? 'cursor-pointer hover:bg-white/70 transition-colors' : ''}
                  `}
                >
                  <div className={`
                    text-xs sm:text-sm font-medium mb-0.5 sm:mb-1
                    ${isTodayDay ? 'text-primary-700' : 'text-pastel-700'}
                  `}>
                    {date.getDate()}
                  </div>
                  
                  <div className="space-y-0.5 sm:space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        onClick={(e) => handleEventClick(event, e)}
                        className={`
                          text-[10px] sm:text-xs p-0.5 sm:p-1.5 rounded truncate font-medium
                          cursor-pointer hover:opacity-80 transition-opacity
                          ${event.isAllDay ? 'bg-primary-500 text-white' : 'bg-primary-200 text-primary-800'}
                        `}
                        title={`${event.title}${event.location ? ` - ${event.location}` : ''}${event.description ? `\n${event.description}` : ''}`}
                      >
                        {event.isAllDay ? (
                          <span className="font-semibold truncate block">{event.title}</span>
                        ) : (
                          <div className="flex items-center gap-0.5 sm:gap-1">
                            <Clock className="w-2 h-2 sm:w-3 sm:h-3 flex-shrink-0" />
                            <span className="font-semibold text-[9px] sm:text-xs">{event.eventTime?.substring(0, 5)}</span>
                            <span className="truncate">{event.title}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div 
                        className="text-[10px] sm:text-xs text-pastel-600 font-medium cursor-pointer hover:text-pastel-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Можно показать модальное окно со всеми событиями дня
                        }}
                      >
                        +{dayEvents.length - 2} еще
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Event Modal */}
      {showModal && (
        <CalendarEventModal
          event={editingEvent}
          selectedDate={selectedDate}
          onClose={handleModalClose}
          onSuccess={fetchEvents}
        />
      )}
    </div>
  );
};

export default Calendar;

