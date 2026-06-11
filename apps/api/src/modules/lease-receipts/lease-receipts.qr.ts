import * as QRCode from 'qrcode';

export function buildReceiptVerifyUrl(publicBase: string, verificationToken: string): string {
  return `${publicBase.replace(/\/+$/, '')}/verify/${verificationToken}`;
}

export async function renderQrPng(payload: string, size = 220): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    type: 'png',
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}
