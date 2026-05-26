import { RagRetrievalService } from './rag-retrieval.service';

describe('RagRetrievalService', () => {
  it('calls rag-indexer /search with tenant scope', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tenant_code: 'KMC',
        collection: 'kb_kmc',
        hits: [
          {
            score: 0.91,
            payload: {
              slug: 'help-services-birth-cert',
              title: 'Birth certificate',
              body: 'Steps to apply',
            },
          },
        ],
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    const svc = new RagRetrievalService();
    const chunks = await svc.search({ tenantCode: 'KMC', query: 'birth cert' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/search'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"tenant_code":"KMC"'),
      }),
    );
    expect(chunks[0]?.slug).toBe('help-services-birth-cert');
  });
});
