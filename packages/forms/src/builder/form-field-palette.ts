import { defaultOptions, localeMap } from './form-builder-utils';

import type { EnagarFormField, FormFieldType } from '../index';

export const FIELD_DRAG_MIME = 'application/x-enagar-form-field';

export type FormFieldBuilder = {
  type: FormFieldType;
  title: string;
  description: string;
  build: (sequence: number) => EnagarFormField;
};

export const FORM_FIELD_PALETTE: FormFieldBuilder[] = [
  {
    type: 'section',
    title: 'Section',
    description: 'Group related inputs.',
    build: (sequence) => ({
      id: `section-${sequence}`,
      type: 'section',
      label: localeMap(`Section ${sequence}`),
    }),
  },
  {
    type: 'text',
    title: 'Text',
    description: 'Names, IDs, short answers.',
    build: (sequence) => ({
      id: `text_field_${sequence}`,
      type: 'text',
      label: localeMap(`Text field ${sequence}`),
      required: true,
      max_length: 120,
    }),
  },
  {
    type: 'textarea',
    title: 'Long Text',
    description: 'Addresses and explanations.',
    build: (sequence) => ({
      id: `long_text_${sequence}`,
      type: 'textarea',
      label: localeMap(`Long text ${sequence}`),
      max_length: 500,
    }),
  },
  {
    type: 'number',
    title: 'Number',
    description: 'Amounts, counts, measurements.',
    build: (sequence) => ({
      id: `number_field_${sequence}`,
      type: 'number',
      label: localeMap(`Number field ${sequence}`),
      min: 0,
    }),
  },
  {
    type: 'date',
    title: 'Date',
    description: 'Birth, event, or due dates.',
    build: (sequence) => ({
      id: `date_field_${sequence}`,
      type: 'date',
      label: localeMap(`Date field ${sequence}`),
      required: true,
    }),
  },
  {
    type: 'radio',
    title: 'Single Choice',
    description: 'Compact yes/no-style options.',
    build: (sequence) => ({
      id: `choice_${sequence}`,
      type: 'radio',
      label: localeMap(`Choice ${sequence}`),
      required: true,
      options: defaultOptions(),
    }),
  },
  {
    type: 'select',
    title: 'Dropdown',
    description: 'Single selection from a list.',
    build: (sequence) => ({
      id: `dropdown_${sequence}`,
      type: 'select',
      label: localeMap(`Dropdown ${sequence}`),
      options: defaultOptions(),
    }),
  },
  {
    type: 'multiselect',
    title: 'Multi Select',
    description: 'Multiple selections from a list.',
    build: (sequence) => ({
      id: `multi_select_${sequence}`,
      type: 'multiselect',
      label: localeMap(`Multi select ${sequence}`),
      options: defaultOptions(),
    }),
  },
  {
    type: 'file',
    title: 'File Upload',
    description: 'Document metadata intent.',
    build: (sequence) => ({
      id: `document_${sequence}`,
      type: 'file',
      label: localeMap(`Document ${sequence}`),
      required: true,
      accept: ['application/pdf', 'image/jpeg', 'image/png'],
      max_size_mb: 5,
    }),
  },
];

export function fieldPaletteItem(type: FormFieldType): FormFieldBuilder | undefined {
  return FORM_FIELD_PALETTE.find((item) => item.type === type);
}
