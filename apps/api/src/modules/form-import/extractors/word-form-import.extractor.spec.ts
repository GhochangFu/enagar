import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  WordFormImportError,
  extractFormImportProposalFromWord,
} from './word-form-import.extractor';

const fixtureDir = join(__dirname, '../../../../test/fixtures/form-import');

function readFixture(name: string): Buffer {
  return readFileSync(join(fixtureDir, name));
}

describe('word-form-import.extractor (EN-37)', () => {
  it('parses birth-certificate-template.docx into a valid proposal', async () => {
    const proposal = await extractFormImportProposalFromWord(
      {
        originalname: 'birth-certificate-template.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 1,
        buffer: readFixture('birth-certificate-template.docx'),
      },
      'birth-certificate',
    );

    expect(proposal.source_kind).toBe('word');
    expect(proposal.fields.length).toBeGreaterThanOrEqual(3);
    expect(proposal.fields.some((field) => field.field_id === 'applicant_name')).toBe(true);
    expect(proposal.fields.every((field) => field.confidence === 0.9)).toBe(true);
    expect(proposal.overall_confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('parses trade-licence-template.docx with choice options', async () => {
    const proposal = await extractFormImportProposalFromWord(
      {
        originalname: 'trade-licence-template.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 1,
        buffer: readFixture('trade-licence-template.docx'),
      },
      'trade-licence',
    );

    const tradeType = proposal.fields.find((field) => field.field_id === 'trade_type');
    expect(tradeType?.options?.length).toBeGreaterThan(1);
  });

  it('rejects documents without a structured table', async () => {
    const { Document, Packer, Paragraph, TextRun } = await import('docx');
    const doc = new Document({
      sections: [{ children: [new Paragraph({ children: [new TextRun('No table here')] })] }],
    });
    const buffer = await Packer.toBuffer(doc);

    await expect(
      extractFormImportProposalFromWord(
        {
          originalname: 'empty.docx',
          mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: buffer.length,
          buffer,
        },
        'demo',
      ),
    ).rejects.toThrow(WordFormImportError);
  });
});
