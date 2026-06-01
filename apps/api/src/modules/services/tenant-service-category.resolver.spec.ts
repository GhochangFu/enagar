import { seedCategoryCodeFromNavigation } from './tenant-service-category.resolver';
import {
  defaultDepartmentCodeForGlobalCategory,
  toGlobalNavigationCategoryCode,
} from './tenant-service-category.util';

describe('tenant-service-category resolver', () => {
  it('maps seed category codes to citizen nav codes', () => {
    expect(toGlobalNavigationCategoryCode('certificates')).toBe('cert');
    expect(toGlobalNavigationCategoryCode('advertising')).toBe('adv');
  });

  it('maps nav codes back to seed catalogue codes', () => {
    expect(seedCategoryCodeFromNavigation('cert')).toBe('certificates');
    expect(seedCategoryCodeFromNavigation('advertising')).toBe('advertising');
  });

  it('assigns default departments for nav categories', () => {
    expect(defaultDepartmentCodeForGlobalCategory('cert')).toBe('birth-death');
    expect(defaultDepartmentCodeForGlobalCategory('tax')).toBe('assessment');
  });
});
