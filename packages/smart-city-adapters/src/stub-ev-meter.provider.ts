import { IEvMeterProvider } from './ev-meter-provider.js';

function parseIncrement(raw: string | undefined): number {
  if (!raw) {
    return 5.5;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 5.5;
  }
  return parsed;
}

/**
 * Sprint 8.2D deterministic EV meter stub.
 * Each session starts at 0.000 kWh and increments by a fixed amount on stop.
 */
export class StubEvMeterProvider implements IEvMeterProvider {
  private readonly sessions = new Map<string, number>();
  private readonly increment: number;

  constructor(incrementKwh?: number) {
    this.increment =
      typeof incrementKwh === 'number' && Number.isFinite(incrementKwh) && incrementKwh > 0
        ? incrementKwh
        : parseIncrement(process.env.STUB_EV_KWH_INCREMENT);
  }

  async startMeter(sessionId: string): Promise<void> {
    this.sessions.set(sessionId, 0);
  }

  async readMeter(sessionId: string): Promise<number> {
    return this.sessions.get(sessionId) ?? 0;
  }

  async stopMeter(sessionId: string): Promise<number> {
    const next = (this.sessions.get(sessionId) ?? 0) + this.increment;
    const rounded = Number(next.toFixed(3));
    this.sessions.set(sessionId, rounded);
    return rounded;
  }
}
