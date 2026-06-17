import { mergeParkingBayStatus, mergeParkingBayStatuses } from './smart-parking-bay-status.util';

describe('smart-parking-bay-status.util', () => {
  it('keeps DB OCCUPIED when the stub sensor still reports FREE', () => {
    expect(mergeParkingBayStatus('OCCUPIED', 'FREE')).toBe('OCCUPIED');
  });

  it('keeps DB RESERVED when the stub sensor still reports FREE', () => {
    expect(mergeParkingBayStatus('RESERVED', 'FREE')).toBe('RESERVED');
  });

  it('uses sensor OCCUPIED when DB is still FREE', () => {
    expect(mergeParkingBayStatus('FREE', 'OCCUPIED')).toBe('OCCUPIED');
  });

  it('merges a full zone grid with DB workflow winning over stale sensor reads', () => {
    const bays = mergeParkingBayStatuses(
      [
        { bayCode: 'B01', status: 'FREE' },
        { bayCode: 'B04', status: 'OCCUPIED' },
        { bayCode: 'B05', status: 'RESERVED' },
      ],
      [
        { code: 'B01', status: 'OCCUPIED' },
        { code: 'B04', status: 'FREE' },
        { code: 'B05', status: 'FREE' },
      ],
    );

    expect(bays).toEqual([
      { code: 'B01', status: 'OCCUPIED' },
      { code: 'B04', status: 'OCCUPIED' },
      { code: 'B05', status: 'RESERVED' },
    ]);
  });
});
