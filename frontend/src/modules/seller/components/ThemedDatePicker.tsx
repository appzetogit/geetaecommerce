import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ThemedDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  align?: 'left' | 'right';
}

export default function ThemedDatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  className = '',
  minDate,
  maxDate,
  disabled = false,
  align = 'left',
}: ThemedDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial date or default to today
  const parseDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const [viewDate, setViewDate] = useState(() => parseDate(value || new Date().toISOString().split('T')[0]));

  useEffect(() => {
    if (isOpen && value) {
      setViewDate(parseDate(value));
    }
  }, [isOpen, value]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calendar Logic
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const changeMonth = (delta: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1);
    setViewDate(newDate);
  };

  const handleDateClick = (day: number) => {
    const selectedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    // Format as YYYY-MM-DD (local time)
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const dateStr = `${year}-${month}-${d}`;

    onChange(dateStr);
    setIsOpen(false);
  };

  const renderCalendarDays = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const days = [];

    // Empty slots for previous month
    for (let i = 0; i < firstDay; i++) {
        days.push(<div key={`empty-${i}`} className="h-8 w-8" />);
    }

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isSelected = value === currentDate;
        const isToday = new Date().toISOString().split('T')[0] === currentDate;

        days.push(
            <button
                key={day}
                onClick={(e) => {
                    e.stopPropagation();
                    handleDateClick(day);
                }}
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors
                    ${isSelected
                        ? 'bg-teal-600 text-white shadow-md shadow-teal-200'
                        : isToday
                            ? 'text-teal-600 font-bold border border-teal-200 bg-teal-50'
                            : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                    }
                `}
            >
                {day}
            </button>
        );
    }
    return days;
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const date = parseDate(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-3 py-2 bg-white border border-neutral-300 rounded-lg text-sm transition-all duration-200 outline-none
          ${disabled ? 'opacity-50 cursor-not-allowed bg-neutral-50' : 'hover:border-teal-500 focus:ring-2 focus:ring-teal-500/20 active:bg-neutral-50 cursor-pointer'}
          ${isOpen ? 'border-teal-500 ring-2 ring-teal-500/20' : ''}
        `}
      >
        <div className="flex items-center gap-2 truncate">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${value ? 'text-teal-600' : 'text-neutral-400'}`}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span className={`truncate ${!value ? 'text-neutral-400' : 'text-neutral-700'}`}>
            {value ? formatDateDisplay(value) : placeholder}
            </span>
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className={`absolute z-50 bottom-full mb-2 p-4 bg-white border border-neutral-200 rounded-xl shadow-xl min-w-[280px] sm:min-w-[300px] select-none ${align === 'right' ? 'right-0' : 'left-0'}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 px-1">
                <span className="text-base font-bold text-neutral-800">
                    {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <div className="flex items-center gap-1">
                  <button
                      onClick={() => changeMonth(-1)}
                      className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-neutral-800 transition-colors"
                  >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                  </button>
                  <button
                      onClick={() => changeMonth(1)}
                      className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-neutral-800 transition-colors"
                  >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                  </button>
                </div>
            </div>

            {/* Weekdays */}
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                    <span key={d} className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">{d}</span>
                ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 place-items-center">
                {renderCalendarDays()}
            </div>

            {/* Footer */}
            <div className="mt-3 pt-3 border-t border-neutral-100 flex justify-between">
                 <button
                    onClick={() => {
                        onChange('');
                        setIsOpen(false);
                    }}
                    className="text-xs font-medium text-neutral-400 hover:text-red-500 transition-colors"
                >
                    Clear
                </button>
                <button
                    onClick={() => {
                        const today = new Date();
                        const year = today.getFullYear();
                        const month = String(today.getMonth() + 1).padStart(2, '0');
                        const day = String(today.getDate()).padStart(2, '0');
                        onChange(`${year}-${month}-${day}`);
                        setIsOpen(false);
                    }}
                    className="text-xs font-bold text-teal-600 hover:text-teal-700 transition-colors"
                >
                    Today
                </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
