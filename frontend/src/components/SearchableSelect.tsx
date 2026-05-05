import React, { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ options, value, onChange, placeholder = "Select...", className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(opt => 
    (opt.label || "").toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative w-full h-full ${className}`} ref={containerRef}>
      <div 
        className="w-full h-full px-3 py-2 text-sm cursor-pointer flex items-center justify-between bg-transparent hover:bg-white transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`truncate mr-2 ${!selectedOption ? "text-gray-400" : "text-gray-900"}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded shadow-xl z-[100] animate-in fade-in slide-in-from-top-1 duration-200 overflow-hidden">
          <div className="p-2 bg-gray-50 border-b border-gray-100">
            <div className="relative">
              <input
                type="text"
                autoFocus
                className="w-full px-8 py-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-[#f187b5] focus:border-[#f187b5] focus:outline-none"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {search && (
                <button 
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => (
                <div
                  key={opt.value}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-pink-50 transition-colors ${value === opt.value ? 'bg-pink-100 text-[#f187b5] font-semibold' : 'text-gray-700'}`}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearch("");
                  }}
                >
                  {opt.label}
                </div>
              ))
            ) : (
              <div className="px-3 py-6 text-center">
                <p className="text-sm text-gray-400 italic">No results found</p>
                {search && (
                   <button 
                    onClick={() => setSearch("")}
                    className="mt-2 text-xs text-[#f187b5] font-semibold hover:underline"
                   >
                     Clear Search
                   </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
