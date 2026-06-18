export interface IEvMeterProvider {
  startMeter(sessionId: string): Promise<void>;
  readMeter(sessionId: string): Promise<number>;
  stopMeter(sessionId: string): Promise<number>;
}
