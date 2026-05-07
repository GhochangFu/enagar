# @enagar/forms

JSON-Schema-driven form runtime. One schema definition powers:

1. The **citizen-pwa** form (RJSF + custom widgets)
2. The **mobile** RN form (custom renderer that consumes the same schema)
3. **Server-side validation** (Ajv) before the API persists the application

This is the keystone of the plug-and-play promise: a Tenant Admin uploads a JSON-Schema in `@enagar/admin-tenant`, and citizens immediately see the new form on web + mobile.

## Status

Sprint 2.2 implementation is in place:

- Typed eNagar form-schema primitives.
- Schema validation for field shape, duplicate IDs, unsupported field types, and conditional references.
- Submission validation for visible fields.
- JSON-Schema export for API-side validation.
- Platform-neutral render plans for PWA and React Native parity.
- Priority service fixtures for Birth Certificate, Trade Licence, Property Tax, Community Hall Booking, and RTI.
