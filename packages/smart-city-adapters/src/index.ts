export type {
  ISensorProvider,
  ParkingBaySensorStatus,
  ZoneOccupancyBay,
  ZoneOccupancyResult,
} from './sensor-provider.js';
export type { IEvMeterProvider } from './ev-meter-provider.js';
export type { IWaterMeterProvider, WaterMeterLookupResult } from './water-meter-provider.js';
export {
  StubModbusSensorProvider,
  type StubSensorScenario,
} from './stub-modbus-sensor.provider.js';
export { StubEvMeterProvider } from './stub-ev-meter.provider.js';
export { StubWaterMeterProvider } from './stub-water-meter.provider.js';
