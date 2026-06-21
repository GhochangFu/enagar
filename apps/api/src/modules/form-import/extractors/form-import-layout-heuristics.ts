import type { FormFieldType } from '@enagar/forms';
import type { FormImportFieldCandidate } from '@enagar/forms/form-import';

const fieldIdPattern = /^[a-z][a-z0-9_]*(?:-[a-z0-9_]+)*$/;

export function slugifyFieldId(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  if (slug && fieldIdPattern.test(slug)) {
    return slug;
  }
  const fallback = slug.replace(/^[^a-z]+/, '') || 'field';
  return fieldIdPattern.test(fallback) ? fallback : `field_${fallback}`.replace(/__+/g, '_');
}

export function inferFieldsFromLayoutLines(
  lines: string[],
  options: {
    sourceKind: 'pdf_digital' | 'pdf_ocr';
    sourceFilename: string;
    serviceCode: string;
    candidatePrefix: string;
    maxConfidence: number;
  },
): FormImportFieldCandidate[] {
  const fields: FormImportFieldCandidate[] = [];
  const seenIds = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? '';
    if (!line) {
      continue;
    }

    const inferred = inferLineCandidate(line, index);
    if (!inferred) {
      continue;
    }

    let fieldId = slugifyFieldId(inferred.label);
    if (seenIds.has(fieldId)) {
      fieldId = `${fieldId}_${index + 1}`;
    }
    seenIds.add(fieldId);

    fields.push({
      candidate_id: `${options.candidatePrefix}-${index + 1}`,
      field_id: fieldId,
      type: inferred.type,
      label: { en: inferred.label },
      required: inferred.required,
      confidence: Math.min(inferred.confidence, options.maxConfidence),
      disposition: 'accepted',
      source_hint: `line:${index + 1}`,
      ...(inferred.options ? { options: inferred.options } : {}),
    });
  }

  return fields;
}

function inferLineCandidate(
  line: string,
  index: number,
): {
  label: string;
  type: FormFieldType;
  confidence: number;
  required?: boolean;
  options?: FormImportFieldCandidate['options'];
} | null {
  const section = inferSectionHeading(line);
  if (section) {
    return { label: section, type: 'section', confidence: 0.68 };
  }

  const checkbox = inferCheckboxLine(line);
  if (checkbox) {
    return checkbox;
  }

  const labelMatch = line.match(/^(.{2,120}?)(?::|\?)\s*[_\-.…●○]*\s*$/);
  if (labelMatch?.[1]) {
    const label = cleanLabel(labelMatch[1]);
    return {
      label,
      type: inferTypeFromLabel(label),
      confidence: label.toLowerCase().includes('date') ? 0.75 : 0.7,
      required: /required|\*/i.test(line),
    };
  }

  const inlineLabel = line.match(/^(.{2,80}?):\s+\S/);
  if (inlineLabel?.[1]) {
    const label = cleanLabel(inlineLabel[1]);
    return {
      label,
      type: inferTypeFromLabel(label),
      confidence: 0.68,
    };
  }

  if (index === 0 && line.length <= 80 && !line.includes(':')) {
    return null;
  }

  return null;
}

function inferSectionHeading(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.length < 4 || trimmed.length > 64) {
    return null;
  }
  if (trimmed.endsWith(':')) {
    return null;
  }
  const alphaRatio =
    trimmed.replace(/[^A-Za-z]/g, '').length / Math.max(trimmed.replace(/\s/g, '').length, 1);
  if (alphaRatio < 0.7) {
    return null;
  }
  if (trimmed === trimmed.toUpperCase() && trimmed.split(/\s+/).length <= 6) {
    return cleanLabel(trimmed);
  }
  if (/^(section|part)\s+\d+/i.test(trimmed)) {
    return cleanLabel(trimmed);
  }
  return null;
}

function inferCheckboxLine(line: string): {
  label: string;
  type: FormFieldType;
  confidence: number;
  options: FormImportFieldCandidate['options'];
} | null {
  if (!/[[\]☐☑]/.test(line)) {
    return null;
  }
  const labelPart = line.split(/[☐☑[]/)[0]?.trim().replace(/:$/, '') ?? 'Choice';
  const options = [...line.matchAll(/(?:☐|☑|\[\s?\])\s*([^[\]☐☑]+)/g)]
    .map((match, optionIndex) => {
      const text = match[1]?.trim() ?? `Option ${optionIndex + 1}`;
      return {
        value: slugifyFieldId(text),
        label: { en: text },
      };
    })
    .filter((option) => option.label.en.length > 0);

  if (options.length < 2) {
    return null;
  }

  return {
    label: cleanLabel(labelPart || 'Choice'),
    type: 'radio',
    confidence: 0.8,
    options,
  };
}

function inferTypeFromLabel(label: string): FormFieldType {
  const lower = label.toLowerCase();
  if (/(date of birth|\bdob\b|date)/.test(lower)) {
    return 'date';
  }
  if (/(turnover|amount|inr|number|#)/.test(lower)) {
    return 'number';
  }
  if (/(document|attach|upload|file|proof)/.test(lower)) {
    return 'file';
  }
  if (/(address|remarks|description|details)/.test(lower)) {
    return 'textarea';
  }
  return 'text';
}

function cleanLabel(raw: string): string {
  return raw.replace(/\*+$/, '').replace(/:$/, '').trim();
}

export function splitPdfTextIntoLines(text: string): string[] {
  return text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}
