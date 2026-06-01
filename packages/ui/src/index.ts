/**
 * Shared web UI primitives (Tailwind-friendly, theme vars from `@enagar/tenant-theme`).
 * Consumer apps must include `packages/ui/src` in Tailwind `content` so utility classes are generated.
 */
export { cn } from './cn';
export { AlertBanner, type AlertBannerProps, type AlertBannerTone } from './components/AlertBanner';
export { Badge, type BadgeProps, type BadgeTone } from './components/Badge';
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './components/Button';
export { Card, type CardProps } from './components/Card';
export {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableElement,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  type DataTableProps,
} from './components/DataTable';
export { Icon, type IconName, type IconProps } from './components/Icon';
export { KpiCard, type KpiCardAccent, type KpiCardProps } from './components/KpiCard';
export { PageHeader, type PageHeaderProps } from './components/PageHeader';
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedOption,
} from './components/SegmentedControl';
export { ToastProvider, useToast } from './components/Toast';
export {
  OperatorAppFooter,
  OperatorBrandMark,
  OperatorSidebarBrand,
  OperatorTopHeader,
} from './components/OperatorChrome';
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
