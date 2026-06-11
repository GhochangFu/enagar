import { renderLeaseReceiptPdf } from './lease-receipts.pdf';
import { renderQrPng } from './lease-receipts.qr';

describe('lease-receipts.pdf', () => {
  it('produces a buffer that starts with the PDF magic bytes', async () => {
    const qr = await renderQrPng('https://x/verify/tok', 120);
    const pdf = await renderLeaseReceiptPdf({
      receiptNumber: 'RCT-0001',
      amountPaise: 100000,
      currency: 'INR',
      lessorName: 'Asha Devi',
      lessorPhone: '+91 9999999999',
      settlementAt: new Date('2026-06-10T10:00:00Z'),
      invoiceNo: 'INV-X-1',
      branding: { ulbName: 'Test ULB', addressLine: '1 MG Road' },
      qrPng: qr,
      verifyUrl: 'https://x/verify/tok',
    });
    expect(pdf.subarray(0, 4).toString('utf8')).toBe('%PDF');
  });
});
