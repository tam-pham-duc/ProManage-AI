
import React, { useState, useRef, useEffect } from 'react';
import { TAG_PALETTE, PaletteColor, getColorById } from '../utils/colors';
import { Check } from 'lucide-react';

interface ColorPickerProps {
  selectedColorId: string;
  onChange: (colorId: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ selectedColorId, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  
  const selectedColor = getColorById(selectedColorId) || TAG_PALETTE.find(c => c.id === 'slate-1');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-8 h-8 rounded-full border-2 border-white dark:border-slate-700 shadow-sm flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${selectedColor?.dot.replace('bg-', 'bg-') || 'bg-slate-500'}`}
        title="Pick a color"
      >
      </button>

      {isOpen && (
        <div className="absolute z-[60] bottom-full mb-2 -left-2 p-3 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-[200px] animate-fade-in">
          <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto custom-scrollbar p-1">
            {TAG_PALETTE.map((color) => (
              <button
                key={color.id}
                type="button"
                onClick={() => {
                  onChange(color.id);
                  setIsOpen(false);
                }}
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${color.dot}`}
                title={color.id}
              >
                {selectedColorId === color.id && <Check size={12} className="text-white drop-shadow-md" strokeWidth={3} />}
              </button>
            ))}
          </div>
          {/* Little arrow pointing down */}
          <div className="absolute -bottom-1 left-5 w-3 h-3 bg-white dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 transform rotate-45"></div>
        </div>
      )}
    </div>
  );
};

export default ColorPicker;
