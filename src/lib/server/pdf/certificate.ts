import PDFDocument from 'pdfkit';

interface CertificateData {
  eventName: string;
  eventDate: string;
  participantName: string;
  bibNumber: string;
  categoryName: string;
  finishTime: string;
  overallRank: number | null;
  genderRank: number | null;
  categoryRank: number | null;
}

export async function generateCertificatePDF(data: CertificateData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ layout: 'landscape', margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    // Dark background
    doc.rect(0, 0, pageWidth, pageHeight).fill('#000');

    // Brand border
    doc.rect(10, 10, pageWidth - 20, pageHeight - 20).lineWidth(3).stroke('#ccff00');
    doc.rect(15, 15, pageWidth - 30, pageHeight - 30).lineWidth(1).stroke('#333');

    // Brand header
    doc.rect(40, 40, pageWidth - 80, 60).fill('#ccff00');
    doc.fillColor('#000').fontSize(22).font('Helvetica-Bold')
      .text('TIME TRACK', 50, 50);
    doc.fontSize(10).font('Helvetica')
      .fillColor('#000').text('CERTIFICATE OF COMPLETION', 50, 76);

    // Certificate body
    const centerX = pageWidth / 2;

    doc.fillColor('#fff').fontSize(12).font('Helvetica')
      .text('THIS CERTIFICATE IS PROUDLY PRESENTED TO', centerX, 140, { align: 'center' });

    doc.fontSize(36).font('Helvetica-Bold')
      .fillColor('#ccff00')
      .text(data.participantName.toUpperCase(), centerX, 170, { align: 'center' });

    doc.moveTo(centerX - 100, 225).lineTo(centerX + 100, 225).stroke('#333');

    doc.fontSize(14).font('Helvetica')
      .fillColor('#fff')
      .text('For successfully completing the', centerX, 240, { align: 'center' });

    doc.fontSize(24).font('Helvetica-Bold')
      .fillColor('#ccff00')
      .text(data.eventName.toUpperCase(), centerX, 268, { align: 'center' });

    doc.moveTo(centerX - 100, 310).lineTo(centerX + 100, 310).stroke('#333');

    // Details
    const detailY = 330;
    const detailLeft = centerX - 150;

    doc.fontSize(11).font('Helvetica');
    const details = [
      ['Bib Number', data.bibNumber],
      ['Category', data.categoryName],
      ['Finish Time', data.finishTime],
      ['Date', data.eventDate],
    ];

    if (data.overallRank) details.push(['Overall Rank', `#${data.overallRank}`]);
    if (data.genderRank) details.push(['Gender Rank', `#${data.genderRank}`]);
    if (data.categoryRank) details.push(['Category Rank', `#${data.categoryRank}`]);

    details.forEach(([label, value], i) => {
      const y = detailY + i * 28;
      doc.fillColor('#666').text(label, detailLeft, y);
      doc.fillColor('#fff').font('Helvetica-Bold').text(value, detailLeft + 120, y);
      doc.font('Helvetica');
    });

    // Footer
    doc.fillColor('#666').fontSize(9)
      .text('Every Second Counts', centerX, pageHeight - 70, { align: 'center' });
    doc.fontSize(8)
      .text('www.timetrack.asia', centerX, pageHeight - 55, { align: 'center' });

    doc.end();
  });
}
