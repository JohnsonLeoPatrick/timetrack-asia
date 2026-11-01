import { bibAssignmentSchema, type ManagedParticipant } from '@/lib/participants';

const headers = ['event_id', 'participant_id', 'order_number', 'full_name', 'ic_last_four', 'bib_number', 'expected_bib_number'];

export function participantCSV(eventId: string, participants: ManagedParticipant[]) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const safeText = (value: string) => /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return [headers, ...participants.map(person => [eventId, person.id, safeText(person.registration_number),
    safeText(person.full_name), safeText(person.ic_passport?.slice(-4) || ''), safeText(person.bib_number || ''), safeText(person.bib_number || '')])]
    .map(row => row.map(escape).join(',')).join('\r\n');
}

// Strict quoted-field parser preserves leading zeroes and rejects broken rows.
export function parseBibCSV(text: string, eventId: string) {
  if (text.length > 2_000_000) throw new Error('CSV must be at most 2 MB');
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false, closed = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === ',' || char === '\n' || char === '\r') {
      row.push(field); field = ''; closed = false;
      if (char !== ',') {
        if (char === '\r' && source[index + 1] === '\n') index++;
        if (row.some(cell => cell !== '')) rows.push(row);
        row = [];
      }
    } else if (char === '"' && !field && !closed) quoted = true;
    else {
      if (closed || char === '"') throw new Error('Malformed CSV quoting');
      field += char;
    }
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  row.push(field);
  if (row.some(cell => cell !== '')) rows.push(row);
  const columns = rows.shift()?.map(value => value.trim());
  if (!columns || new Set(columns).size !== columns.length ||
    !['event_id', 'participant_id', 'bib_number', 'expected_bib_number'].every(column => columns.includes(column))) {
    throw new Error('Use the exported CSV headers, including expected_bib_number');
  }
  if (!rows.length || rows.length > 10000) throw new Error('CSV must contain 1-10000 participants');
  const seen = new Set<string>();
  return rows.map((values, index) => {
    if (values.length !== columns.length) throw new Error(`CSV row ${index + 2}: incorrect column count`);
    const record = Object.fromEntries(columns.map((column, position) => [column, values[position]]));
    if (record.event_id !== eventId) throw new Error(`CSV row ${index + 2}: participant belongs to another event`);
    if (seen.has(record.participant_id)) throw new Error(`CSV row ${index + 2}: repeated participant`);
    seen.add(record.participant_id);
    const parsed = bibAssignmentSchema.safeParse({ participant_id: record.participant_id,
      bib_number: record.bib_number, expected_bib_number: record.expected_bib_number || null });
    if (!parsed.success) throw new Error(`CSV row ${index + 2}: ${parsed.error.issues[0].message}`);
    return parsed.data;
  });
}
