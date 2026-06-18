import { computeEvSessionAmountPaise } from './ev-charging-amount.util';

describe('ev-charging-amount.util', () => {
  it('computes default stub session amount for KMC seed rate', () => {
    expect(computeEvSessionAmountPaise(5.5, 1500)).toBe(8250);
  });

  it('rounds fractional paise to nearest integer', () => {
    expect(computeEvSessionAmountPaise(1.333, 1500)).toBe(2000);
  });

  it('rejects negative kWh', () => {
    expect(() => computeEvSessionAmountPaise(-1, 1500)).toThrow('non-negative');
  });
});
