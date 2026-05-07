import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';

import { Public } from '../../common/auth/public.decorator';

@ApiTags('infrastructure')
@Public()
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  /**
   * Liveness probe. Returns 200 as long as the event loop is responsive
   * and the process has not exhausted its heap budget. Used by Docker
   * Compose / Kubernetes liveness checks.
   */
  @Get('healthz')
  @HealthCheck()
  liveness(): Promise<HealthCheckResult> {
    return this.health.check([() => this.memory.checkHeap('heap', 512 * 1024 * 1024)]);
  }

  /**
   * Readiness probe. In Phase 0 this is a no-op aside from process
   * memory; Phase 1 will add Postgres/Redis/MinIO/Qdrant indicators.
   */
  @Get('ready')
  @HealthCheck()
  readiness(): Promise<HealthCheckResult> {
    return this.health.check([() => this.memory.checkRSS('rss', 1024 * 1024 * 1024)]);
  }

  /** Plain hello — only useful for the Phase-0 smoke test. */
  @Get('health')
  hello(): { status: 'ok'; service: string; phase: string } {
    return { status: 'ok', service: 'enagar-api', phase: 'phase-0' };
  }
}
