import PDFDocument from 'pdfkit';

import type { BookingConfirmationPdfModel } from './bookings-pdf.util';

function drawLabelValue(doc: InstanceType<typeof PDFDocument>, label: string, value: string): void {
  const startY = doc.y;
  doc.fontSize(10).fillColor('#444').text(label, 36, startY, { width: 124 });
  doc.fillColor('black').text(value, 164, startY, { width: 395 });
  doc.moveDown(0.35);
}

export async function renderBookingConfirmationPdf(
  model: BookingConfirmationPdfModel,
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 36 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    if (model.logoPng) {
      doc.image(model.logoPng, 36, 36, { height: 48 });
    }
    doc.fontSize(14).text(model.tenantName, { align: 'right' });
    doc.fontSize(10).fillColor('#555').text(model.tenantCode, { align: 'right' });
    doc.fontSize(9).text('eNagarSeba', { align: 'right' });
    doc.fillColor('black');
    doc.moveDown(1.4);

    doc.moveTo(36, doc.y).lineTo(559, doc.y).strokeColor('#cccccc').stroke();
    doc.strokeColor('black');
    doc.moveDown(0.8);

    doc.fontSize(16).text('BOOKING CONFIRMATION');
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`Booking no: ${model.bookingNo}`);
    doc.text(`Status: ${model.statusLabel}`);
    doc.moveDown(0.8);

    drawLabelValue(doc, 'Service', model.serviceLabel);
    if (model.assetLabel) {
      drawLabelValue(doc, 'Asset', model.assetLabel);
    }
    drawLabelValue(doc, 'Date', model.slotDate);
    drawLabelValue(doc, 'Time', model.slotHours);
    if (model.pickupAddress) {
      drawLabelValue(doc, 'Pickup address', model.pickupAddress);
    }
    if (model.contactMobile) {
      drawLabelValue(doc, 'Contact', model.contactMobile);
    }
    if (model.emergency) {
      drawLabelValue(doc, 'Emergency', 'Yes — no rent charged');
    }

    doc.moveDown(0.5);
    doc.moveTo(36, doc.y).lineTo(559, doc.y).strokeColor('#cccccc').stroke();
    doc.strokeColor('black');
    doc.moveDown(0.6);

    drawLabelValue(doc, 'Rent', model.rentFormatted);
    drawLabelValue(doc, 'Security dep.', model.depositFormatted);
    drawLabelValue(doc, 'Total', model.totalFormatted);

    doc.moveDown(0.8);
    doc.moveTo(36, doc.y).lineTo(559, doc.y).strokeColor('#cccccc').stroke();
    doc.strokeColor('black');
    doc.moveDown(0.8);

    doc
      .fontSize(8)
      .fillColor('#888')
      .text(
        `Generated: ${model.generatedAt.toISOString()} · This is a system-generated document.`,
        { align: 'center' },
      );

    doc.end();
  });
}
