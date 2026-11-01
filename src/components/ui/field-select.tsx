'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function FieldSelect({ id, label, value, onValueChange, options, disabled = false }: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  disabled?: boolean;
}) {
  return <Select value={value} items={options} onValueChange={value => { if (value !== null) onValueChange(value); }} disabled={disabled}>
    <SelectTrigger id={id} aria-label={label} className="min-h-12 w-full min-w-0 border-slate-400 bg-white px-3 text-base"><SelectValue /></SelectTrigger>
    <SelectContent align="start" alignItemWithTrigger={false} className="border border-slate-300 p-1">
      {options.map(option => <SelectItem key={option.value} value={option.value} disabled={option.disabled} className="min-h-11 px-3">{option.label}</SelectItem>)}
    </SelectContent>
  </Select>;
}
