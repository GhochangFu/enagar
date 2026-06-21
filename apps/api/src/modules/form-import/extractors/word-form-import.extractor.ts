import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';

import {
  FormImportTableError,
  FORM_IMPORT_TABLE_REQUIRED_COLUMNS,
  parseFormImportProposalFromTableRows,
} from './form-import-table.parser';

import type { FormImportUploadedFile } from '../dto/form-import.dto';
import type { FormImportProposal } from '@enagar/forms/form-import';

export const WORD_IMPORT_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
]);

export class WordFormImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WordFormImportError';
  }
}

export function isWordUpload(file: FormImportUploadedFile): boolean {
  const lower = file.originalname.toLowerCase();
  return lower.endsWith('.docx') || WORD_IMPORT_MIME_TYPES.has(file.mimetype.toLowerCase());
}

export async function extractFormImportProposalFromWord(
  file: FormImportUploadedFile,
  serviceCode: string,
): Promise<FormImportProposal> {
  if (!isWordUpload(file)) {
    throw new WordFormImportError('Upload must be a Word document (.docx)');
  }

  try {
    const rows = await parseFirstStructuredTableFromDocx(file.buffer);
    return parseFormImportProposalFromTableRows(rows, {
      sourceKind: 'word',
      sourceFilename: file.originalname,
      serviceCode,
      confidence: 0.9,
      candidatePrefix: 'word',
      sourceHintPrefix: 'table-row',
    });
  } catch (error) {
    if (error instanceof FormImportTableError) {
      throw new WordFormImportError(error.message);
    }
    throw error;
  }
}

export async function parseFirstStructuredTableFromDocx(buffer: Buffer): Promise<string[][]> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) {
    throw new WordFormImportError('Word document is missing word/document.xml');
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    isArray: (name) => ['p', 'r', 't', 'tr', 'tc', 'tbl'].includes(name),
  });
  const parsed = parser.parse(documentXml) as Record<string, unknown>;
  const body = (parsed.document as { body?: Record<string, unknown> } | undefined)?.body;
  if (!body) {
    throw new WordFormImportError('Word document body could not be read');
  }

  const tables = normalizeNodeList(body.tbl).map((tableNode) => parseTableNode(tableNode));
  if (tables.length === 0) {
    throw new WordFormImportError(
      'Word template must contain a table with columns field_id, label_en, and type',
    );
  }

  for (const table of tables) {
    const rows = table.map((row) => row.map((cell) => cell.trim()));
    const header = rows[0]?.map((cell) => cell.trim().toLowerCase()) ?? [];
    const hasRequired = FORM_IMPORT_TABLE_REQUIRED_COLUMNS.every((column) =>
      header.includes(column),
    );
    if (hasRequired && rows.length >= 2) {
      return rows;
    }
  }

  throw new WordFormImportError(
    'Word template must contain a table with columns field_id, label_en, and type',
  );
}

function parseTableNode(tableNode: unknown): string[][] {
  const record = tableNode as Record<string, unknown>;
  const rowNodes = normalizeNodeList(record.tr);
  return rowNodes.map((rowNode) => {
    const row = rowNode as Record<string, unknown>;
    const cellNodes = normalizeNodeList(row.tc);
    return cellNodes.map((cellNode) => extractCellText(cellNode));
  });
}

function extractCellText(cellNode: unknown): string {
  const record = cellNode as Record<string, unknown>;
  const paragraphs = normalizeNodeList(record.p);
  const parts: string[] = [];
  for (const paragraph of paragraphs) {
    parts.push(extractParagraphText(paragraph));
  }
  return parts.join('\n').trim();
}

function extractParagraphText(paragraphNode: unknown): string {
  const record = paragraphNode as Record<string, unknown>;
  const runs = normalizeNodeList(record.r);
  return runs
    .map((runNode) => {
      const run = runNode as Record<string, unknown>;
      const texts = normalizeNodeList(run.t);
      return texts.map((textNode) => nodeText(textNode)).join('');
    })
    .join('');
}

function normalizeNodeList<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function nodeText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (!value || typeof value !== 'object') {
    return '';
  }
  const record = value as Record<string, unknown>;
  if ('#text' in record) {
    return String(record['#text'] ?? '');
  }
  return '';
}
