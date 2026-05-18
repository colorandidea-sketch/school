'use client';

import { createContext, useContext, useEffect, useState } from 'react';

interface RTLContextType {
  isRTL: boolean;
  toggleDirection: () => void;
}

const RTLContext = createContext<RTLContextType>({
  isRTL: true,
  toggleDirection: () => {},
});

export function useRTL() {
  return useContext(RTLContext);
}

export function RTLProvider({ children }: { children: React.ReactNode }) {
  const [isRTL, setIsRTL] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('direction');
    if (stored) {
      setIsRTL(stored === 'rtl');
    }
  }, []);

  const toggleDirection = () => {
    const newDirection = isRTL ? 'ltr' : 'rtl';
    setIsRTL(!isRTL);
    localStorage.setItem('direction', newDirection);
    document.documentElement.dir = newDirection;
    document.documentElement.lang = newDirection === 'rtl' ? 'ar' : 'en';
  };

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = isRTL ? 'ar' : 'en';
  }, [isRTL]);

  return (
    <RTLContext.Provider value={{ isRTL, toggleDirection }}>
      {children}
    </RTLContext.Provider>
  );
}