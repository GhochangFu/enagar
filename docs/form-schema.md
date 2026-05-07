# Form Schema v1

## Purpose

`@enagar/forms` defines the single form contract used by:

- Citizen PWA rendering.
- React Native/mobile rendering.
- API-side submission validation before an application is persisted.
- Tenant Admin form-builder output in Phase 6.

The schema is deliberately smaller than raw JSON-Schema. It is a municipal form
DSL that can be exported to JSON-Schema for server validation while preserving
rendering metadata for web and RN.

## Versioning

Every form schema carries:

- `schema_version`: currently `1`.
- `service_code`: immutable service identifier, for example `birth-cert`.
- `version`: monotonically increasing integer stored in
  `service_form_versions.version`.

When a citizen starts or submits an application, the API stores the exact
`service_form_versions` row used by that application. Later edits create a new
version and must not change the validation/rendering of in-flight applications.

## Top-Level Shape

```ts
interface EnagarFormSchema {
  schema_version: 1;
  service_code: string;
  version: number;
  title: { en: string; bn: string; hi: string };
  description?: { en: string; bn: string; hi: string };
  fields: EnagarFormField[];
}
```

## Supported Fields

| Type          | Purpose                        | Value shape            |
| ------------- | ------------------------------ | ---------------------- |
| `text`        | Short text input               | string                 |
| `textarea`    | Long text input                | string                 |
| `number`      | Numeric input                  | number                 |
| `date`        | ISO date, `YYYY-MM-DD`         | string                 |
| `radio`       | One option from a small set    | string                 |
| `select`      | One option from a dropdown     | string                 |
| `multiselect` | Multiple options               | string array           |
| `file`        | Upload metadata placeholder    | object or object array |
| `section`     | Visual grouping / instructions | no submitted value     |

Every non-section field has a stable `id`. IDs are lowercase, URL-safe, and
unique inside the schema.

## Common Field Properties

```ts
interface BaseField {
  id: string;
  type: FieldType;
  label: { en: string; bn: string; hi: string };
  help_text?: { en: string; bn: string; hi: string };
  required?: boolean;
  show_if?: {
    field: string;
    equals?: string | number | boolean;
    includes?: string;
    not_empty?: boolean;
  };
}
```

## Validation Rules

Text fields may define:

- `min_length`
- `max_length`
- `pattern`

Number fields may define:

- `min`
- `max`

Choice fields define `options`, each with:

- `value`
- localized `label`

File fields define:

- `accept`: allowed MIME types.
- `max_size_mb`: maximum 10 MB in v1.
- `multiple`: whether more than one file is accepted.

Conditional fields are validated only when visible. Hidden fields are ignored for
required checks and submission validation.

## Render Plan

`@enagar/forms` converts a schema into a platform-neutral render plan:

```ts
interface FormRenderNode {
  id: string;
  field_type: FieldType;
  widget: WidgetKind;
  label: string;
  help_text?: string;
  required: boolean;
  visible: boolean;
}
```

The web and RN renderers consume the same nodes. Widgets are stable contract
values such as `text-input`, `number-input`, `date-input`, `choice-list`,
`multi-choice-list`, `file-picker`, and `section`.

## JSON-Schema Export

For API validation, `@enagar/forms` exports a JSON-Schema draft-compatible object
with:

- `type: "object"`
- `properties` for non-section fields
- `required` for required fields
- enum constraints for choice fields
- numeric and string constraints where present

Conditional visibility remains an eNagar extension. API submission validation
uses `@enagar/forms` directly so hidden required fields are not rejected.

## Security Rules

- Form schemas are data, not executable code.
- Regex patterns are accepted but must be bounded and reviewed; no dynamic JS
  expressions are allowed.
- File fields describe metadata only. Actual upload, MIME sniffing, virus scan,
  and MinIO storage land in Sprint 2.4.
- Service-specific UI components are not allowed in PWA/RN. If a service needs a
  special field, the field type belongs in `@enagar/forms`.

## Sprint 2.2 Fixtures

The initial fixture schemas cover:

- Birth Certificate.
- Trade Licence.
- Property Tax.
- Community Hall Booking.
- RTI.

These fixtures prove renderer parity and submission validation before Sprint 2.5
builds the citizen application UI.
