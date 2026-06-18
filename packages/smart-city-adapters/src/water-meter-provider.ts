export interface WaterMeterLookupResult {
  meterId: string;
  balancePaise: number;
  lastReadingLitres: number | null;
  lastReadingAt: string | null;
}

export interface IWaterMeterProvider {
  lookup(meterId: string): Promise<WaterMeterLookupResult | null>;
  applyRecharge(meterId: string, amountPaise: number): Promise<WaterMeterLookupResult>;
}
