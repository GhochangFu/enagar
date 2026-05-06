import { Test, TestingModule } from '@nestjs/testing';

import { HealthController } from './health.controller';
import { HealthModule } from './health.module';

describe('HealthController', () => {
  let controller: HealthController;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();
    controller = moduleRef.get(HealthController);
  });

  it('hello() returns the phase-0 status payload', () => {
    expect(controller.hello()).toEqual({
      status: 'ok',
      service: 'enagar-api',
      phase: 'phase-0',
    });
  });
});
