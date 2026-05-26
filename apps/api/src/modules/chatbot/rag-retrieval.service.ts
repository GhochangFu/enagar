import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

import type { RetrievedChunk } from './prompt';

export type RagSearchHit = {
  score: number;
  payload: {
    slug?: string;
    title?: string;
    body?: string;
    text?: string;
    locale?: string;
    source_type?: string;
  };
};

export type RagSearchResponse = {
  tenant_code: string;
  collection: string;
  hits: RagSearchHit[];
};

@Injectable()
export class RagRetrievalService {
  private readonly log = new Logger(RagRetrievalService.name);

  private baseUrl(): string {
    const port = process.env.RAG_INDEXER_PORT ?? '8100';
    return (process.env.RAG_INDEXER_URL ?? `http://127.0.0.1:${port}`).replace(/\/$/, '');
  }

  async search(params: {
    tenantCode: string;
    query: string;
    limit?: number;
  }): Promise<RetrievedChunk[]> {
    const limit = params.limit ?? Number(process.env.CHATBOT_RAG_TOP_K ?? 5);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl()}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_code: params.tenantCode,
          query: params.query,
          limit,
        }),
      });
    } catch (error) {
      this.log.warn(`RAG indexer unreachable: ${String(error)}`);
      throw new ServiceUnavailableException('Knowledge search is temporarily unavailable');
    }

    if (!response.ok) {
      const detail = await response.text();
      this.log.warn(`RAG search failed (${response.status}): ${detail}`);
      throw new ServiceUnavailableException('Knowledge search failed');
    }

    const data = (await response.json()) as RagSearchResponse;
    return (data.hits ?? []).map((hit) => ({
      slug: String(hit.payload?.slug ?? 'unknown'),
      title: String(hit.payload?.title ?? hit.payload?.slug ?? 'Article'),
      body: String(hit.payload?.text ?? hit.payload?.body ?? '').slice(0, 1500),
      score: Number(hit.score ?? 0),
    }));
  }
}
