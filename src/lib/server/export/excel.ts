import type { Registration, Event, User } from '@/lib/types';
type ExportRegistration = Registration & { events?: Event; athlete?: User };
import * as XLSX from 'xlsx';

export function generateExcelBuffer(sheets: Record<string, Record<string, unknown>[]>): Buffer {
  const workbook = XLSX.utils.book_new();

  for (const [name, data] of Object.entries(sheets)) {
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  }

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function parseExcelFile(buffer: Buffer, sheetName?: string): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = sheetName ? workbook.Sheets[sheetName] : workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet);
}

export function generateRegistrationsExcel(registrations: ExportRegistration[]): Buffer {
  const data = registrations.map(r => ({
    RegistrationNo: r.registration_number,
    Event: r.events?.title || '',
    Athlete: `${r.athlete?.first_name || ''} ${r.athlete?.last_name || ''}`.trim(),
    Email: r.billing_details?.email || '',
    Phone: r.billing_details?.phone || '',
    Status: r.status,
    Total: Number(r.total_amount),
    Discount: Number(r.discount_amount),
    Net: Number(r.net_amount),
    Participants: r.persons_count,
    CreatedAt: new Date(r.created_at).toISOString(),
  }));

  return generateExcelBuffer({ Registrations: data });
}
