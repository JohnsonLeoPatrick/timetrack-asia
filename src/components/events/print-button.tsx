'use client';

import { Printer } from 'lucide-react';

export function PrintButton() {
  return <button onClick={() => window.print()} className="btn-primary print:hidden"><Printer size={18} aria-hidden="true" />Print / Save PDF</button>;
}
