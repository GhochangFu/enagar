export type ParkingBaySensorStatus = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'OUT_OF_SERVICE';

export type ZoneOccupancyBay = {
  code: string;
  status: ParkingBaySensorStatus;
};

export type ZoneOccupancyResult = {
  bays: ZoneOccupancyBay[];
  polledAt: string;
  scenario: string;
};

export interface ISensorProvider {
  getZoneOccupancy(tenantId: string, zoneCode: string): Promise<ZoneOccupancyResult>;
}
