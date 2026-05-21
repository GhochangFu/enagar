/** EICAR standard antivirus test file signature. */
export const EICAR_TEST_SIGNATURE =
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

export type ScanVerdict = 'clean' | 'infected' | 'failed';

export function scanObjectBytes(buffer: Buffer, stubMode: string): ScanVerdict {
  const text = buffer.toString('utf8');
  if (text.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE') || text.includes(EICAR_TEST_SIGNATURE)) {
    return 'infected';
  }

  const normalized = stubMode.trim().toLowerCase();
  if (normalized === 'infected') {
    return 'infected';
  }
  if (normalized === 'failed') {
    return 'failed';
  }
  return 'clean';
}
