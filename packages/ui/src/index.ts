/**
 * Shared web UI primitives (Tailwind-friendly, theme vars from `@enagar/tenant-theme`).
 * Consumer apps must include `packages/ui/src` in Tailwind `content` so utility classes are generated.
 */
export { cn } from './cn';
export { Badge, type BadgeProps, type BadgeTone } from './components/Badge';
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './components/Button';
export { Card, type CardProps } from './components/Card';
export { Icon, type IconName, type IconProps } from './components/Icon';
export { PageHeader, type PageHeaderProps } from './components/PageHeader';
export { Skeleton, type SkeletonProps } from './components/Skeleton';
export { Spinner, type SpinnerProps } from './components/Spinner';
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
