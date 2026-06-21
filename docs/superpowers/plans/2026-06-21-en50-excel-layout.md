# EN-50 Excel Layout Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Accept layout-style Excel workbooks via heuristics with `extraction_mode: "layout"` on import jobs.

**Architecture:** Try table mode when header row has `field_id`/`label_en`/`type`; else run layout extractor that converts sheet rows to lines and reuses `inferFieldsFromLayoutLines`. Store `extraction_mode` on `FormImportProposal` and surface in job API + UI banner.

**Tech Stack:** xlsx, `@enagar/forms/form-import`, NestJS extractors, FormImportPanel

---

See ADR-0015 and `docs/backlog/EN-50-excel-layout-form-import.md` for acceptance criteria.
