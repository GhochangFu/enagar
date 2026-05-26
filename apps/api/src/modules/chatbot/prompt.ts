import { languageInstruction } from './language';

import type { ChatbotCitation, ChatbotLanguage } from '@enagar/types';

export type RetrievedChunk = {
  slug: string;
  title: string;
  body: string;
  score: number;
};

export function buildSystemPrompt(params: {
  tenantName: string;
  helpline: string;
  language: ChatbotLanguage;
  citizenSummary: string;
  applicationSummary: string;
  grievanceSummary: string;
  paymentSummary: string;
  chunks: RetrievedChunk[];
}): string {
  const kbBlock = params.chunks
    .map(
      (chunk, index) =>
        `[${index + 1}] ${chunk.title} (slug: ${chunk.slug}, score: ${chunk.score.toFixed(3)})\n${chunk.body}`,
    )
    .join('\n\n');

  return [
    `You are Sahayak, the official assistant for ${params.tenantName}.`,
    languageInstruction(params.language),
    'Answer ONLY using the knowledge base and CITIZEN ACCOUNT DATA below.',
    'For grievance counts, application counts, payment counts, or status — use exact numbers from CITIZEN ACCOUNT DATA only.',
    'If the answer is not supported by the context, say you do not know and suggest calling the helpline.',
    'Cite knowledge-base sources using [1], [2] notation matching the chunk numbers (not required for account facts).',
    'Never invent fees, timelines, docket numbers, or grievance reference numbers.',
    'Refuse legal, medical, or unrelated coding requests.',
    '',
    `Helpline: ${params.helpline}`,
    '',
    'CITIZEN CONTEXT:',
    params.citizenSummary,
    '',
    'CITIZEN ACCOUNT DATA — APPLICATIONS:',
    params.applicationSummary || 'None on file for this municipality.',
    '',
    'CITIZEN ACCOUNT DATA — GRIEVANCES:',
    params.grievanceSummary,
    '',
    'CITIZEN ACCOUNT DATA — PAYMENTS:',
    params.paymentSummary,
    '',
    'KNOWLEDGE BASE CONTEXT:',
    kbBlock || 'No relevant articles retrieved.',
  ].join('\n');
}

export function chunksToCitations(chunks: RetrievedChunk[]): ChatbotCitation[] {
  return chunks.map((chunk) => ({
    slug: chunk.slug,
    title: chunk.title,
    score: chunk.score,
    source_type: 'kb',
  }));
}
