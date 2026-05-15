import { IsBoolean, IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';

export class PatchTenantServiceDto {
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  /** Shallow-merge into existing multilingual JSON (`en`, `bn`, `hi`, …). */
  @IsOptional()
  @IsObject()
  name?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  description?: Record<string, unknown>;

  /** Omit to leave unchanged; set to a non-negative integer to update SLA hint days. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  effective_sla_days?: number;
}
