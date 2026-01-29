import React, { useState, useRef, useEffect } from 'react';

interface Option {
  id: string | number;
  label: string;
  value: string | number;
}

interface ThemedDropdownProps {
  options: Option[] | string[] | number[];
  value: string | number;
  onChange: (value: any) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function ThemedDropdown({
  options,
  value,
  onChange,
  placeholder = 'Select option',
  className = '',
  disabled = false,
}: ThemedDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Normalize options to Option[] format
  const normalizedOptions: Option[] = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null && 'label' in opt && 'value' in opt) {
      return opt as Option;
    }
    return { id: opt, label: String(opt), value: opt } as Option;
  });

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: Option) => {
    onChange(option.value);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-3 py-2 bg-white border border-neutral-300 rounded-lg text-sm transition-all duration-200 outline-none
          ${disabled ? 'opacity-50 cursor-not-allowed bg-neutral-50' : 'hover:border-teal-500 focus:ring-1 focus:ring-teal-500/20 active:bg-neutral-50 cursor-pointer'}
          ${isOpen ? 'border-teal-500 ring-1 ring-teal-500/20' : ''}
        `}
      >
        <span className={`truncate ${!selectedOption ? 'text-neutral-400' : 'text-neutral-700'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute z-50 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none py-1"
        >
          {normalizedOptions.length > 0 ? (
            normalizedOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelect(option)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors duration-150
                  ${option.value === value
                    ? 'bg-teal-50 text-teal-700 font-medium'
                    : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900'
                  }
                `}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-neutral-400 text-center">
              No options available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
