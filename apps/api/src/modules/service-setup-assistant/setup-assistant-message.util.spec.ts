import {
  FORM_TOOL_RETRY_USER_MESSAGE,
  looksLikeFormFieldEditRequest,
} from './setup-assistant-message.util';

describe('setup-assistant-message.util', () => {
  it('detects add-field follow-up requests', () => {
    expect(looksLikeFormFieldEditRequest('Add Contact email after Contact phone')).toBe(true);
    expect(looksLikeFormFieldEditRequest('also add contact email')).toBe(true);
    expect(looksLikeFormFieldEditRequest('What is a form field?')).toBe(false);
  });

  it('provides a tool retry instruction', () => {
    expect(FORM_TOOL_RETRY_USER_MESSAGE).toContain('proposeFormFields');
  });
});
