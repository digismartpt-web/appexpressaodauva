import React, { useEffect, useRef, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { getGoogleMapsLibrary } from '../lib/googleMaps';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  onPlaceSelect?: (place: google.maps.places.PlaceResult) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  onPlaceSelect,
  placeholder = 'Comece a escrever o seu endereço...',
  disabled = false
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [internalValue, setInternalValue] = useState(value);

  // Synchroniser la valeur interne avec la prop value si elle change de l'extérieur
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const onChangeRef = useRef(onChange);
  const onPlaceSelectRef = useRef(onPlaceSelect);

  // Sync refs to avoid stale closures in listeners
  useEffect(() => {
    onChangeRef.current = onChange;
    onPlaceSelectRef.current = onPlaceSelect;
  });

  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        const timeoutPromise = new Promise<void>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout loading Google Maps')), 3000)
        );

        if (!active || !inputRef.current) return;

        const { Autocomplete } = await Promise.race([getGoogleMapsLibrary('places'), timeoutPromise]) as google.maps.PlacesLibrary;

        if (!active || !inputRef.current) return;

        autocompleteRef.current = new Autocomplete(
          inputRef.current,
          {
            types: ['address'],
            componentRestrictions: { country: 'pt' },
            fields: ['address_components', 'formatted_address', 'geometry', 'name']
          }
        );

        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current?.getPlace();
          if (place && place.formatted_address) {
            setInternalValue(place.formatted_address);
            onChangeRef.current(place.formatted_address);
            onPlaceSelectRef.current?.(place);
          }
        });

        setIsLoading(false);
      } catch (err: any) {
        console.error('🗺️ Autocomplete Error:', err);
        if (active) {
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      active = false;
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    onChange(newValue);
  };

  return (
    <div className="relative group w-full">
      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none group-focus-within:text-accent-500 transition-colors" />
      <input
        ref={inputRef}
        type="text"
        value={internalValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="new-password"
        spellCheck={false}
        className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
      />

      {internalValue && !disabled && (
        <button
          type="button"
          onClick={() => {
            setInternalValue('');
            onChange('');
          }}
          className="absolute right-10 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
          title="Limpar endereço"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {isLoading ? (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="w-5 h-5 border-2 border-gray-100 border-t-accent-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-300">
          <MapPin className="w-4 h-4" />
        </div>
      )}

      {/* Aide à la saisie manuelle */}
      {!disabled && (
        <p className="mt-2 text-[11px] text-gray-500 italic">
          Não encontra a sua morada? Pode escrevê-la manualmente acima.
        </p>
      )}
    </div>
  );
};
