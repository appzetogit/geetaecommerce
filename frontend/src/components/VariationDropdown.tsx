
import React, { useState, useRef, useEffect } from 'react';

interface VariationDropdownProps {
  variations: any[];
  onEdit?: () => void;
}

const VariationDropdown: React.FC<VariationDropdownProps> = ({
  variations,
  onEdit,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to format variation summary
  const getVariationSummary = (v: any) => {
    // Frontend logic for display name
    // Assuming structure: name/value or title
    const name = v.title || (v.name && v.value ? `${v.name}: ${v.value}` : v.variation || "Variation");
    const stock = v.stock !== undefined ? `Stock: ${v.stock}` : "";
    const price = v.price ? `₹${v.price}` : "";

    return (
      <div className="flex justify-between items-center text-xs w-full">
        <div className="flex items-center gap-1.5 truncate mr-2">
            {v.colorCode && (
                <span
                    className="w-2.5 h-2.5 rounded-full border border-gray-300 flex-shrink-0"
                    style={{ backgroundColor: v.colorCode }}
                    title={v.colorCode}
                />
            )}
            <span className="font-medium truncate" title={name}>{name}</span>
        </div>
        <div className="flex gap-2 text-gray-500 flex-shrink-0">
           <span>{price}</span>
           <span>{stock}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full h-full" ref={dropdownRef}>
      <div
        className="w-full h-full px-2 py-2 bg-transparent text-sm cursor-pointer flex items-center justify-between overflow-hidden"
        onClick={() => setIsOpen(!isOpen)}
        title={`${variations.length} Variations`}
      >
        <span className="truncate text-gray-700">
           {variations.length > 0 ? `${variations.length} Variations` : 'No Variations'}
        </span>
        <span className="text-gray-400 text-[10px] ml-1">▼</span>
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 shadow-lg rounded z-50 w-64 max-h-60 flex flex-col">
          <div className="flex-1 overflow-y-auto p-1">
            {variations.length === 0 ? (
                <div className="p-2 text-xs text-gray-500 text-center">No variations added yet.</div>
            ) : (
                variations.map((v: any, i: number) => (
                    <div
                        key={i}
                        className="px-3 py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50"
                    >
                        {getVariationSummary(v)}
                    </div>
                ))
            )}
          </div>
          {onEdit && (
            <div className="p-2 border-t border-gray-100 bg-gray-50 rounded-b">
                <button
                  onClick={() => {
                      onEdit();
                      setIsOpen(false);
                  }}
                  className="w-full py-1.5 bg-[#f187b5] hover:bg-[#e076a5] text-white text-xs font-bold rounded transition-colors flex items-center justify-center gap-1"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  Manage / Edit Variations
                </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VariationDropdown;
