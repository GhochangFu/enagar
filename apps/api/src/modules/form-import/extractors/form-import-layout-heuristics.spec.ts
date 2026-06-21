import { inferFieldsFromLayoutLines, splitPdfTextIntoLines } from './form-import-layout-heuristics';

describe('form-import-layout-heuristics', () => {
  it('splits collapsed PDF text into inferable label rows', () => {
    const collapsed =
      'Birth Certificate Application APPLICANT DETAILS Applicant name: ____________________ Date of birth: ____________________ Gender: [ ] Male   [ ] Female   [ ] Other';

    const fields = inferFieldsFromLayoutLines(splitPdfTextIntoLines(collapsed), {
      sourceKind: 'pdf_digital',
      sourceFilename: 'demo.pdf',
      serviceCode: 'birth-certificate',
      candidatePrefix: 'pdf-digital',
      maxConfidence: 0.78,
    });

    expect(fields.length).toBeGreaterThanOrEqual(3);
    expect(fields.some((field) => field.field_id === 'applicant_name')).toBe(true);
  });
});
