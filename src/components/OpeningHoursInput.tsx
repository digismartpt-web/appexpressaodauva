import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';

interface TimeSlot {
  start: string;
  end: string;
}

interface OpeningHoursInputProps {
  value: string;
  onChange: (value: string) => void;
  dayLabel: string;
}

export const OpeningHoursInput: React.FC<OpeningHoursInputProps> = ({ value, onChange, dayLabel }) => {
  const [isClosed, setIsClosed] = useState(false);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([{ start: '', end: '' }]);

  useEffect(() => {
    if (!value || typeof value !== 'string') {
      setIsClosed(true);
      setTimeSlots([{ start: '', end: '' }]);
      return;
    }

    const lowerValue = value.toLowerCase();
    if (lowerValue.includes('fechado') || lowerValue.includes('fermé') || lowerValue.includes('closed')) {
      setIsClosed(true);
      setTimeSlots([{ start: '', end: '' }]);
      return;
    }

    setIsClosed(false);

    const periods = value.split('/').map(s => s.trim());
    const slots: TimeSlot[] = [];

    for (const period of periods) {
      if (!period) continue;

      const parts = period.split('-').map(s => s.trim());
      if (parts.length === 2 && parts[0] && parts[1]) {
        slots.push({ start: parts[0], end: parts[1] });
      }
    }

    if (slots.length > 0) {
      setTimeSlots(slots);
    } else {
      setTimeSlots([{ start: '', end: '' }]);
    }
  }, [value]);

  const handleClosedToggle = () => {
    const newClosed = !isClosed;
    setIsClosed(newClosed);

    if (newClosed) {
      onChange('Fechado');
    } else {
      setTimeSlots([{ start: '11h30', end: '22h30' }]);
      onChange('11h30-22h30');
    }
  };

  const handleTimeSlotChange = (index: number, field: 'start' | 'end', val: string) => {
    const newSlots = [...timeSlots];
    newSlots[index][field] = val;
    setTimeSlots(newSlots);

    const validSlots = newSlots.filter(slot => slot.start && slot.end);

    if (validSlots.length === 0) {
      onChange('Fechado');
      return;
    }

    const formattedValue = validSlots
      .map(slot => `${slot.start}-${slot.end}`)
      .join('/');

    onChange(formattedValue);
  };

  const addTimeSlot = () => {
    setTimeSlots([...timeSlots, { start: '', end: '' }]);
  };

  const removeTimeSlot = (index: number) => {
    if (timeSlots.length === 1) return;

    const newSlots = timeSlots.filter((_, i) => i !== index);
    setTimeSlots(newSlots);

    const validSlots = newSlots.filter(slot => slot.start && slot.end);

    if (validSlots.length === 0) {
      onChange('Fechado');
      return;
    }

    const formattedValue = validSlots
      .map(slot => `${slot.start}-${slot.end}`)
      .join('/');

    onChange(formattedValue);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-primary-700">
          {dayLabel}
        </label>
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isClosed}
            onChange={handleClosedToggle}
            className="mr-2"
          />
          <span className="text-sm text-gray-600">Fechado</span>
        </label>
      </div>

      {!isClosed && (
        <div className="space-y-2">
          {timeSlots.map((slot, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={slot.start}
                onChange={(e) => handleTimeSlotChange(index, 'start', e.target.value)}
                className="flex-1 px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                placeholder="11h30"
              />
              <span className="text-gray-500">até</span>
              <input
                type="text"
                value={slot.end}
                onChange={(e) => handleTimeSlotChange(index, 'end', e.target.value)}
                className="flex-1 px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                placeholder="22h30"
              />
              {timeSlots.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTimeSlot(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Remover horário"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}

          {timeSlots.length < 3 && (
            <button
              type="button"
              onClick={addTimeSlot}
              className="flex items-center gap-1 text-sm text-accent-600 hover:text-accent-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Adicionar pausa
            </button>
          )}
        </div>
      )}
    </div>
  );
};
