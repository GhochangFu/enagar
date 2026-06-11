import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateTenantConfigDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000_000) // ₹100,000 cap (soft warning handled in UI)
  lateFeePaise!: number;
}
