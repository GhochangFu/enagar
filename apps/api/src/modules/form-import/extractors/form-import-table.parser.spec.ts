import {
  FormImportTableError,
  isFormImportTableHeaderRow,
  isPartialFormImportTableHeader,
  parseFormImportProposalFromTableRows,
} from './form-import-table.parser';

describe('form-import-table.parser (EN-47)', () => {
  const baseOptions = {
    sourceKind: 'excel' as const,
    sourceFilename: 'template.xlsx',
    serviceCode: 'birth-certificate',
    confidence: 0.95,
    candidatePrefix: 'excel',
    sourceHintPrefix: 'row',
  };

  it('detects valid table headers', () => {
    expect(isFormImportTableHeaderRow(['field_id', 'label_en', 'type'])).toBe(true);
    expect(isFormImportTableHeaderRow(['Field_ID', 'Label_EN', 'Type'])).toBe(true);
  });

  it('detects partial table headers missing label_en', () => {
    expect(isPartialFormImportTableHeader(['field_id', 'type'])).toBe(true);
    expect(isFormImportTableHeaderRow(['field_id', 'type'])).toBe(false);
  });

  it('parses structured rows into a proposal', () => {
    const proposal = parseFormImportProposalFromTableRows(
      [
        ['field_id', 'label_en', 'type'],
        ['applicant_name', 'Applicant name', 'text'],
        ['date_of_birth', 'Date of birth', 'date'],
      ],
      baseOptions,
    );

    expect(proposal.fields).toHaveLength(2);
    expect(proposal.fields[0]?.field_id).toBe('applicant_name');
    expect(proposal.overall_confidence).toBe(0.95);
  });

  it('throws when label_en column is missing from header', () => {
    expect(() =>
      parseFormImportProposalFromTableRows(
        [
          ['field_id', 'type'],
          ['only_id', 'text'],
        ],
        baseOptions,
      ),
    ).toThrow(FormImportTableError);
    expect(() =>
      parseFormImportProposalFromTableRows(
        [
          ['field_id', 'type'],
          ['only_id', 'text'],
        ],
        baseOptions,
      ),
    ).toThrow(/label_en/);
  });

  it('throws when no field rows remain after header', () => {
    expect(() =>
      parseFormImportProposalFromTableRows([['field_id', 'label_en', 'type']], baseOptions),
    ).toThrow(FormImportTableError);
  });
});
