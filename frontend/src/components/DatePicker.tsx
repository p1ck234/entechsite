import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { extractIsoDate, formatRuDate, toInputDate } from '../utils/date';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  allowClear?: boolean;
}

const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const WEEKDAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const parseLocalDate = (isoDate: string): Date | null => {
  const normalized = extractIsoDate(isoDate);
  if (!normalized) {
    return null;
  }

  const [year, month, day] = normalized.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isSameDay = (left: Date, right: Date): boolean => {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
};

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  min,
  max,
  className = '',
  disabled = false,
  placeholder = 'Выберите дату',
  id,
  allowClear = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const selectedDate = useMemo(() => parseLocalDate(value), [value]);
  const minDate = useMemo(() => (min ? parseLocalDate(min) : null), [min]);
  const maxDate = useMemo(() => (max ? parseLocalDate(max) : null), [max]);

  const [viewDate, setViewDate] = useState<Date>(() => selectedDate || new Date());

  useEffect(() => {
    if (selectedDate) {
      setViewDate(selectedDate);
    }
  }, [value]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const isDisabledDate = (date: Date): boolean => {
    if (minDate && date < minDate && !isSameDay(date, minDate)) {
      return true;
    }

    if (maxDate && date > maxDate && !isSameDay(date, maxDate)) {
      return true;
    }

    return false;
  };

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const mondayBasedOffset = (firstDayOfMonth.getDay() + 6) % 7;

    const days: Array<{ date: Date; inCurrentMonth: boolean }> = [];

    for (let index = 0; index < mondayBasedOffset; index += 1) {
      const date = new Date(year, month, index - mondayBasedOffset + 1);
      days.push({ date, inCurrentMonth: false });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      days.push({ date: new Date(year, month, day), inCurrentMonth: true });
    }

    let nextMonthDay = 1;
    while (days.length % 7 !== 0) {
      days.push({ date: new Date(year, month + 1, nextMonthDay), inCurrentMonth: false });
      nextMonthDay += 1;
    }

    return days;
  }, [viewDate]);

  const handleSelectDate = (date: Date) => {
    if (isDisabledDate(date)) {
      return;
    }

    onChange(toInputDate(date));
    setIsOpen(false);
  };

  const displayValue = value ? formatRuDate(value) : placeholder;
  const today = new Date();

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        className={`
          w-full flex items-center gap-3 rounded-xl border border-pastel-200 bg-white/80 px-4 py-2.5
          text-left transition-all duration-200 shadow-sm hover:shadow-md
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary-300'}
          ${isOpen ? 'ring-2 ring-primary-500 border-transparent' : ''}
        `}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <CalendarDays className="w-4 h-4 text-primary-500 flex-shrink-0" />
        <span className={`truncate ${value ? 'text-pastel-800' : 'text-pastel-400'}`}>
          {displayValue}
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,320px)] rounded-2xl border border-pastel-200 bg-white/95 backdrop-blur-md p-4 shadow-2xl animate-slide-down"
          role="dialog"
          aria-label="Выбор даты"
        >
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
              className="p-2 rounded-lg text-pastel-600 hover:bg-pastel-100 hover:text-pastel-800 transition-colors"
              aria-label="Предыдущий месяц"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="text-sm font-semibold text-pastel-800">
              {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
            </div>

            <button
              type="button"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
              className="p-2 rounded-lg text-pastel-600 hover:bg-pastel-100 hover:text-pastel-800 transition-colors"
              aria-label="Следующий месяц"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAY_NAMES.map((weekday) => (
              <div
                key={weekday}
                className="text-center text-[11px] font-medium uppercase tracking-wide text-pastel-400 py-1"
              >
                {weekday}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(({ date, inCurrentMonth }) => {
              const isoDate = toInputDate(date);
              const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
              const isToday = isSameDay(date, today);
              const isDisabled = isDisabledDate(date);

              return (
                <button
                  key={isoDate}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelectDate(date)}
                  className={`
                    h-9 rounded-lg text-sm transition-all duration-150
                    ${!inCurrentMonth ? 'text-pastel-300' : 'text-pastel-700'}
                    ${isSelected ? 'bg-primary-500 text-white shadow-md' : 'hover:bg-primary-50'}
                    ${isToday && !isSelected ? 'ring-1 ring-primary-300 font-semibold' : ''}
                    ${isDisabled ? 'opacity-30 cursor-not-allowed hover:bg-transparent' : ''}
                  `}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2 border-t border-pastel-100 pt-3">
            {allowClear ? (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className="text-sm text-pastel-500 hover:text-pastel-700 transition-colors"
              >
                Очистить
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => handleSelectDate(today)}
              disabled={isDisabledDate(today)}
              className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors disabled:opacity-40"
            >
              Сегодня
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
