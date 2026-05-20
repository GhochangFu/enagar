import { subtypesVisibleForCategory } from './grievance-catalogue-helpers';

describe('subtypesVisibleForCategory', () => {
  const lampOut = {
    id: '1',
    code: 'lamp-out',
    name: { en: 'Lamp out' },
    sort_order: 0,
    is_active: true,
  };

  it('hides stale subtypes when selection and loaded category differ', () => {
    expect(subtypesVisibleForCategory('drainage', null, [lampOut])).toEqual([]);
    expect(subtypesVisibleForCategory('drainage', 'broken-streetlight', [lampOut])).toEqual([]);
    expect(subtypesVisibleForCategory(null, 'drainage', [lampOut])).toEqual([]);
  });

  it('shows subtypes when loaded for the selected category', () => {
    expect(subtypesVisibleForCategory('drainage', 'drainage', [lampOut])).toEqual([lampOut]);
  });
});
