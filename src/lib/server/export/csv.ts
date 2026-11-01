import type { Registration, Participant, Result, Event, User } from '@/lib/types';
type ExportRegistration = Registration & { events?: Event; athlete?: User };
type ExportParticipant = Participant & { event_categories?: { name: string } };
type ExportResult = Result & { participants?: { full_name: string; event_categories?: { name: string } } };
export function generateCSV(headers: string[], rows: Record<string, unknown>[]): string {
  const escapeField = (value: unknown): string => {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeField).join(',');
  const dataLines = rows.map(row =>
    headers.map(h => escapeField(row[h])).join(',')
  );

  return [headerLine, ...dataLines].join('\n');
}

export function generateRegistrationsCSV(registrations: ExportRegistration[]): string {
  const headers = [
    'Registration #', 'Event', 'Athlete', 'Email', 'Phone',
    'Status', 'Total (RM)', 'Discount (RM)', 'Net (RM)',
    'Participants', 'Created At',
  ];

  const rows = registrations.map(r => ({
    'Registration #': r.registration_number,
    'Event': r.events?.title || '',
    'Athlete': `${r.athlete?.first_name || ''} ${r.athlete?.last_name || ''}`.trim(),
    'Email': r.billing_details?.email || r.athlete?.email || '',
    'Phone': r.billing_details?.phone || r.athlete?.phone || '',
    'Status': r.status,
    'Total (RM)': Number(r.total_amount).toFixed(2),
    'Discount (RM)': Number(r.discount_amount).toFixed(2),
    'Net (RM)': Number(r.net_amount).toFixed(2),
    'Participants': r.persons_count,
    'Created At': new Date(r.created_at).toISOString(),
  }));

  return generateCSV(headers, rows);
}

export function generateParticipantsCSV(participants: ExportParticipant[]): string {
  const headers = [
    'Bib #', 'Full Name', 'Category', 'Gender', 'IC/Passport',
    'Email', 'Phone', 'DOB', 'Age', 'Country',
    'Emergency Contact', 'Emergency Phone', 'Medical',
  ];

  const rows = participants.map(p => ({
    'Bib #': p.bib_number || '',
    'Full Name': p.full_name,
    'Category': p.event_categories?.name || '',
    'Gender': p.gender || '',
    'IC/Passport': p.ic_passport || '',
    'Email': p.email || '',
    'Phone': p.phone || '',
    'DOB': p.dob || '',
    'Age': p.age || '',
    'Country': p.country || '',
    'Emergency Contact': p.emergency_name || '',
    'Emergency Phone': p.emergency_phone || '',
    'Medical': p.medical_status ? 'Yes' : 'No',
  }));

  return generateCSV(headers, rows);
}

export function generateResultsCSV(results: ExportResult[]): string {
  const headers = [
    'Bib #', 'Participant', 'Category', 'Status',
    'Finish Time', 'Gun Time', 'Chip Time',
    'Overall Rank', 'Gender Rank', 'Category Rank',
  ];

  const rows = results.map(r => ({
    'Bib #': r.bib_number,
    'Participant': r.participants?.full_name || '',
    'Category': r.participants?.event_categories?.name || '',
    'Status': r.status,
    'Finish Time': r.finish_time || '',
    'Gun Time': r.gun_time || '',
    'Chip Time': r.chip_time || '',
    'Overall Rank': r.overall_rank || '',
    'Gender Rank': r.gender_rank || '',
    'Category Rank': r.category_rank || '',
  }));

  return generateCSV(headers, rows);
}
