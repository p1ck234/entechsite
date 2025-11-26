import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { calendarAPI } from '../api/client';
import { CalendarEvent } from '../types';
import { ChevronLeft, ChevronRight, Plus, Clock } from 'lucide-react';
import CalendarEventModal from '../components/CalendarEventModal';

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
      const eventDateStr = event.eventDate.split('T')[0];
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
    // Parse date correctly (event.eventDate is in format YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
    const dateStr = event.eventDate.split('T')[0];
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-pastel-800">Календарь мероприятий</h1>
          <p className="text-pastel-600 mt-1">Планирование и отслеживание событий</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setSelectedDate(new Date());
              setEditingEvent(null);
              setShowModal(true);
            }}
            className="mt-4 sm:mt-0 btn-primary flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Добавить мероприятие</span>
          </button>
        )}
      </div>

      {/* Calendar Navigation */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handlePreviousMonth}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-pastel-700" />
          </button>
          
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-bold text-pastel-800">
              {monthNames[month]} {year}
            </h2>
            <button
              onClick={handleToday}
              className="btn-secondary text-sm"
            >
              Сегодня
            </button>
          </div>
          
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ChevronRight className="w-6 h-6 text-pastel-700" />
          </button>
        </div>

        {/* Calendar Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {/* Day headers */}
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center font-semibold text-pastel-700 py-2 text-sm"
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
                    min-h-[100px] border border-pastel-200 rounded-lg p-2
                    ${!isCurrentMonthDay ? 'opacity-40' : ''}
                    ${isTodayDay ? 'bg-primary-50 border-primary-300 border-2' : 'bg-white/50'}
                    ${isAdmin ? 'cursor-pointer hover:bg-white/70 transition-colors' : ''}
                  `}
                >
                  <div className={`
                    text-sm font-medium mb-1
                    ${isTodayDay ? 'text-primary-700' : 'text-pastel-700'}
                  `}>
                    {date.getDate()}
                  </div>
                  
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        onClick={(e) => handleEventClick(event, e)}
                        className={`
                          text-xs p-1.5 rounded truncate font-medium
                          cursor-pointer hover:opacity-80 transition-opacity
                          ${event.isAllDay ? 'bg-primary-500 text-white' : 'bg-primary-200 text-primary-800'}
                        `}
                        title={`${event.title}${event.location ? ` - ${event.location}` : ''}${event.description ? `\n${event.description}` : ''}`}
                      >
                        {event.isAllDay ? (
                          <span className="font-semibold">{event.title}</span>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 inline mr-1 align-middle" />
                            <span className="font-semibold">{event.eventTime?.substring(0, 5)}</span>
                            <span className="ml-1">{event.title}</span>
                          </>
                        )}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div 
                        className="text-xs text-pastel-600 font-medium cursor-pointer hover:text-pastel-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Можно показать модальное окно со всеми событиями дня
                        }}
                      >
                        +{dayEvents.length - 3} еще
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

