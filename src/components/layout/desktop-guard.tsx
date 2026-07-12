'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { Laptop } from 'lucide-react';

interface DesktopGuardProps {
  children: ReactNode;
  theme?: 'blue' | 'red' | 'purple';
}

export function DesktopGuard({ children, theme = 'blue' }: DesktopGuardProps) {
  return <>{children}</>;
}
