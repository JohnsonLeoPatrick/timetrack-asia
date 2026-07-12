import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import PDFDocument from 'pdfkit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  
  const { data: reg, error: regError } = await supabase
    .from('registrations')
    .select('*, events(*), billing_details(*), participants(*)')
    .eq('id', id)
    .single();

  if (regError || !reg) {
    return new NextResponse('Receipt not found', { status: 404 });
  }

  const doc = new PDFDocument({ margin: 50 });
  const chunks: any[] = [];
  
  doc.on('data', (chunk) => chunks.push(chunk));
  
  // Design the PDF
  doc.fillColor('#000000').rect(0, 0, 612, 120).fill('#000000'); // dark header banner
  
  // Header Title
  doc.fillColor('#ccff00').fontSize(24).font('Helvetica-Bold').text('TIMETRACK ASIA', 50, 45);
  doc.fillColor('#ffffff').fontSize(10).font('Helvetica').text('OFFICIAL RECEIPT & INVOICE', 50, 75);
  
  // Receipt Metadata (Top Right)
  doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text(`RECEIPT #: ${reg.registration_number}`, 400, 45, { align: 'right' });
  doc.font('Helvetica').text(`DATE: ${new Date(reg.created_at).toLocaleDateString()}`, 400, 60, { align: 'right' });
  doc.text(`STATUS: PAID`, 400, 75, { align: 'right' });

  // Event Details
  doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold').text('EVENT INFORMATION', 50, 150);
  doc.moveTo(50, 170).lineTo(562, 170).strokeColor('#e5e7eb').lineWidth(1).stroke();
  
  doc.fontSize(11).font('Helvetica-Bold').text(reg.events?.title, 50, 185);
  doc.fontSize(10).font('Helvetica').text(`Date: ${new Date(reg.events?.event_date).toLocaleDateString()}`, 50, 205);
  doc.text(`Venue: ${reg.events?.venue_name || 'Virtual'}, ${reg.events?.city || 'KL'}`, 50, 220);

  // Billing Details
  doc.fontSize(14).font('Helvetica-Bold').text('BILLING TO', 50, 260);
  doc.moveTo(50, 280).lineTo(562, 280).stroke();
  
  const bill = reg.billing_details?.[0] || {};
  doc.fontSize(10).font('Helvetica-Bold').text(`${bill.first_name || ''} ${bill.last_name || ''}`, 50, 295);
  doc.font('Helvetica').text(`Email: ${bill.email || ''}`, 50, 315);
  doc.text(`Phone: ${bill.phone || ''}`, 50, 330);

  // Participants & Category Table
  doc.fontSize(14).font('Helvetica-Bold').text('PARTICIPANTS & CATEGORIES', 50, 370);
  doc.moveTo(50, 390).lineTo(562, 390).stroke();
  
  let y = 405;
  doc.fontSize(9).font('Helvetica-Bold').text('NAME', 50, y);
  doc.text('BIB NAME', 200, y);
  doc.text('GENDER', 350, y);
  doc.text('COUNTRY', 450, y);
  
  doc.moveTo(50, y + 15).lineTo(562, y + 15).stroke();
  y += 25;
  
  doc.font('Helvetica');
  (reg.participants || []).forEach((p: any) => {
    doc.text(p.full_name, 50, y);
    doc.text(p.bib_name || '-', 200, y);
    doc.text(p.gender || '-', 350, y);
    doc.text(p.country || 'Malaysia', 450, y);
    y += 20;
  });

  // Price Calculation Summary
  y += 10;
  doc.moveTo(50, y).lineTo(562, y).stroke();
  y += 15;
  
  doc.fontSize(10).font('Helvetica').text('Subtotal:', 380, y);
  doc.font('Helvetica-Bold').text(`RM${Number(reg.total_amount).toFixed(2)}`, 480, y, { align: 'right' });
  y += 20;

  doc.font('Helvetica').text('Discount Applied:', 380, y);
  doc.font('Helvetica-Bold').text(`-RM${Number(reg.discount_amount).toFixed(2)}`, 480, y, { align: 'right' });
  y += 20;

  doc.font('Helvetica-Bold').text('Total Paid (MYR):', 380, y);
  doc.fontSize(12).fillColor('#000000').text(`RM${Number(reg.net_amount).toFixed(2)}`, 480, y, { align: 'right' });

  doc.end();

  return new Promise<NextResponse>((resolve) => {
    doc.on('end', () => {
      const pdfBytes = Buffer.concat(chunks);
      resolve(
        new NextResponse(pdfBytes, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=receipt-${reg.registration_number}.pdf`,
          },
        })
      );
    });
  });
}
