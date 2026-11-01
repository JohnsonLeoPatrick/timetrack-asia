'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { Laptop } from 'lucide-react';

interface DesktopGuardProps {
  children: ReactNode;
  theme?: 'blue' | 'red' | 'purple';
}

const THEME_CLASSES: Record<NonNullable<DesktopGuardProps['theme']>, string> = {
  blue: 'text-blue-700 border-blue-400/20 bg-blue-400/5',
  red: 'text-red-700 border-red-400/20 bg-red-400/5',
  purple: 'text-purple-700 border-purple-400/20 bg-purple-400/5',
};

export function DesktopGuard({ children, theme = 'blue' }: DesktopGuardProps) {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  if (isDesktop === null || isDesktop) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center bg-[#f5f5f7] text-slate-900">
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border mb-6 ${THEME_CLASSES[theme]}`}>
        <Laptop size={28} />
      </div>
      <h2 className="text-2xl font-display font-semibold normal-case tracking-tight mb-2">Use a larger screen</h2>
      <p className="text-base font-normal normal-case tracking-normal text-slate-600 max-w-sm">
        This dashboard is optimized for larger screens. Please access it from a desktop or laptop.
      </p>
    </div>
  );
}
