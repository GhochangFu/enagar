import {
  buildAllSahayakServiceHelpArticles,
  buildSahayakServiceHelpArticles,
} from './sahayak-service-help.seed';

describe('sahayak-service-help.seed', () => {
  it('builds index + grievance + per-service articles for KMC', () => {
    const articles = buildSahayakServiceHelpArticles('KMC');
    const slugs = articles.map((article) => article.slug);
    expect(slugs).toContain('help-services');
    expect(slugs).toContain('help-grievances');
    expect(slugs).toContain('help-services-birth-cert');
    expect(slugs).toContain('help-services-pet-licence');
    expect(articles.every((article) => article.status === 'published')).toBe(true);
    expect(articles.every((article) => article.tags.includes('sahayak'))).toBe(true);
  });

  it('marks HMC community-hall help as published with inactive tag', () => {
    const hall = buildSahayakServiceHelpArticles('HMC').find(
      (article) => article.slug === 'help-services-community-hall',
    );
    expect(hall).toBeDefined();
    expect(hall?.tags).toContain('inactive');
    expect(hall?.body.en).toContain('not currently active');
  });

  it('covers all operational municipalities', () => {
    const articles = buildAllSahayakServiceHelpArticles();
    const tenants = new Set(articles.map((article) => article.tenant_code));
    expect(tenants).toEqual(new Set(['KMC', 'HMC', 'CMC', 'BMC', 'SMC', 'AMC', 'DMC', 'SDDM']));
    expect(articles.length).toBeGreaterThanOrEqual(8 * 7);
  });
});
