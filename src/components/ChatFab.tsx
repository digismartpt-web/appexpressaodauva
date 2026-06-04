import { useState, useEffect } from 'react';

interface ChatFabProps {
  onOpen: () => void;
  isOpen: boolean;
}

export default function ChatFab({ onOpen, isOpen }: ChatFabProps) {
  const [showPulse, setShowPulse] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setShowPulse(false);
      return;
    }
    const timer = setTimeout(() => setShowPulse(true), 3000);
    return () => clearTimeout(timer);
  }, [isOpen]);

  if (isOpen) return null;

  return (
    <>
      {showPulse && (
        <div className="fixed bottom-16 right-6 w-14 h-14 rounded-full bg-[#111]/5 animate-ping pointer-events-none z-50" />
      )}
      <button
        onClick={onOpen}
        className="fixed bottom-16 right-6 w-14 h-14 rounded-full bg-[#111] text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all z-50 flex items-center justify-center border border-[#C8A96E]/30"
        title="Falar com Luis"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <line x1="10" y1="9" x2="16" y2="9" strokeWidth={2} />
          <line x1="10" y1="13" x2="14" y2="13" strokeWidth={2} />
        </svg>
      </button>
    </>
  );
}
