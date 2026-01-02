
import React from 'react';

interface StepCardProps {
  title: string;
  options: string[];
  onSelect: (val: string) => void;
  selected?: string;
}

export const StepCard: React.FC<StepCardProps> = ({ title, options, onSelect, selected }) => {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-lg mb-4 w-full animate-fadeIn border-t-4 border-orange-500">
      <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
      <div className="grid grid-cols-1 gap-3">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            className={`py-3 px-4 rounded-xl text-left transition-all border-2 text-base font-bold shadow-sm ${
              selected === opt 
                ? 'bg-orange-600 border-orange-700 text-white' 
                : 'bg-orange-50 border-orange-100 text-gray-800 hover:border-orange-300'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
};
