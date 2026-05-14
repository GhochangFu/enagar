/**
 * Shared web UI primitives (Tailwind-friendly, theme vars from `@enagar/tenant-theme`).
 * Consumer apps must include `packages/ui/src` in Tailwind `content` so utility classes are generated.
 */
export {
  ChoiceGrid,
  ChoicePill,
  DateField,
  FieldLabel,
  FieldRow,
  fieldControlClass,
  HelpText,
  NumberField,
  SectionHeading,
  SelectField,
  TextAreaField,
  TextField,
} from './form-primitives';
