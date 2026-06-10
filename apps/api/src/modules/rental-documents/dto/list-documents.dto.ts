import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export type ReviewQueueStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

export class ListDocumentsQueryDto {
  @IsOptional()
  @IsEnum(['PENDING_REVIEW', 'APPROVED', 'REJECTED'])
  status?: ReviewQueueStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 25;
}
