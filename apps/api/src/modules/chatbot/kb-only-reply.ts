import { formatCitizenAccountBlockForKbOnly } from './citizen-account-context';
import { languageInstruction } from './language';

import type { RetrievedChunk } from './prompt';
import type { ChatbotCitation, ChatbotLanguage } from '@enagar/types';

/** Deterministic KB-only answer (no LLM egress) for consent mode `kb_only`. */
export function formatKbOnlyReply(params: {
  language: ChatbotLanguage;
  chunks: RetrievedChunk[];
  citations: ChatbotCitation[];
  grievanceSummary: string;
  applicationSummary: string;
  paymentSummary: string;
}): string {
  const accountBlock = formatCitizenAccountBlockForKbOnly({
    grievances: params.grievanceSummary,
    applications: params.applicationSummary,
    payments: params.paymentSummary,
  });

  if (params.chunks.length === 0) {
    const noArticle =
      params.language === 'bn'
        ? 'এই প্রশ্নের জন্য কোনো নির্দিষ্ট নিবন্ধ পাওয়া যায়নি। অনুগ্রহ করে হেল্পলাইনে যোগাযোগ করুন।'
        : params.language === 'hi'
          ? 'इस प्रश्न के लिए कोई लेख नहीं मिला। कृपया हेल्पलाइन से संपर्क करें।'
          : 'No matching knowledge-base article was found. Please contact the municipal helpline.';
    if (!accountBlock) {
      return noArticle;
    }
    return [noArticle, '', 'Your account (this municipality):', accountBlock].join('\n');
  }

  const intro =
    params.language === 'bn'
      ? 'নিম্নলিখিত নিবন্ধগুলি আপনার প্রশ্নের সাথে সম্পর্কিত (KB-only মোড — কোনো বাহ্যিক AI ব্যবহার হয়নি):'
      : params.language === 'hi'
        ? 'निम्न लेख आपके प्रश्न से संबंधित हैं (KB-only मोड — कोई बाहरी AI नहीं):'
        : 'These knowledge-base articles match your question (KB-only mode — no external AI):';

  const bullets = params.citations
    .slice(0, 5)
    .map((c, i) => `[${i + 1}] ${c.title} (${c.slug})`)
    .join('\n');

  const excerpt = params.chunks[0]?.body.slice(0, 400).trim();

  const parts = [intro, languageInstruction(params.language), bullets, '', excerpt];
  if (accountBlock) {
    parts.push('', 'Your account (this municipality):', accountBlock);
  }
  return parts.join('\n');
}
