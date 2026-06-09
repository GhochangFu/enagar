import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Citizen-pwa query string for `GET /lease-invoices/lookup?phone=…`.
 *
 * The `phone` value is normalized to digits before persistence matches, so
 * callers may include spaces, dashes, parentheses, or the `+91` country code.
 */
export class LookupLeasesDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  phone!: string;
}
