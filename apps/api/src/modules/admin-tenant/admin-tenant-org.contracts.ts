import { BadRequestException } from '@nestjs/common';

/** Designation codes: kebab-case or snake_case (ULB appendix uses underscores). */
export function assertDesignationCode(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${field} is required`);
  }
  const code = value.trim();
  if (!/^[a-z][a-z0-9_-]*[a-z0-9]$/.test(code) && !/^[a-z][a-z0-9_-]+$/.test(code)) {
    throw new BadRequestException(
      `${field} must start with a letter and use lowercase letters, digits, hyphens, or underscores`,
    );
  }
}

export function assertDesignationScope(
  scope: string,
  departmentId: string | null | undefined,
): void {
  if (scope === 'department' && !departmentId) {
    throw new BadRequestException('department_id is required when scope is department');
  }
  if (scope === 'municipality' && departmentId) {
    throw new BadRequestException('department_id must be null when scope is municipality');
  }
}
