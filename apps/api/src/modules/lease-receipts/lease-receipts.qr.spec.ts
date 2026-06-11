import { buildReceiptVerifyUrl, renderQrPng } from './lease-receipts.qr';

describe('lease-receipts.qr', () => {
  it('builds an absolute verify URL using the public host', () => {
    const u = buildReceiptVerifyUrl('https://enagar.example.gov', 'tok-abc');
    expect(u).toBe('https://enagar.example.gov/verify/tok-abc');
  });

  it('renders a non-empty PNG buffer', async () => {
    const png = await renderQrPng('https://x/verify/tok', 200);
    expect(png.byteLength).toBeGreaterThan(50);
    // PNG magic bytes
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4e);
    expect(png[3]).toBe(0x47);
  });
});
