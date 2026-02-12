
import React, { useState, useRef, useEffect } from 'react';

interface Attribute {
  _id: string;
  name: string;
}

interface AttributeDropdownProps {
  options: Attribute[];
  selectedAttributes: string[];
  onChange: (selected: string[]) => void;
}

const AttributeDropdown: React.FC<AttributeDropdownProps> = ({
  options,
  selectedAttributes,
  onChange,
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

  const toggleAttribute = (name: string) => {
    const newSelected = selectedAttributes.includes(name)
      ? selectedAttributes.filter((attr) => attr !== name)
      : [...selectedAttributes, name];
    onChange(newSelected);
  };

  return (
    <div className="relative w-full h-full" ref={dropdownRef}>
      <div
        className="w-full h-full px-2 py-2 bg-transparent text-sm cursor-pointer flex items-center justify-between overflow-hidden"
        onClick={() => setIsOpen(!isOpen)}
        title={selectedAttributes.join(', ')}
      >
        <span className="truncate">
          {selectedAttributes.length > 0 ? selectedAttributes.join(', ') : 'Select...'}
        </span>
        <span className="text-gray-400 text-[10px] ml-1">▼</span>
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 shadow-lg rounded z-50 w-48 max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="p-2 text-xs text-gray-500">No attributes found</div>
          ) : (
            options.map((attr) => (
              <div
                key={attr._id}
                className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                onClick={() => toggleAttribute(attr.name)}
              >
                <input
                  type="checkbox"
                  checked={selectedAttributes.includes(attr.name)}
                  readOnly
                  className="mr-2 h-3.5 w-3.5 text-[#f187b5] focus:ring-[#f187b5] border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">{attr.name}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AttributeDropdown;
