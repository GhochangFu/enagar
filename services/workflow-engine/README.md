# @enagar/workflow-engine — STUB (Phase 2)

BullMQ worker that runs service & grievance workflows defined via `@enagar/workflow`. Listens on the `workflows` queue, evaluates guards, executes side-effects (notification dispatch, payment release, RTI counter increment, …), and arms SLA timers.

## Status

Phase-0 stub. Implementation: Phase 2.
