-- SSA-6 (EN-57): per-session LLM token budget tracking

ALTER TABLE "service_setup_sessions"
  ADD COLUMN "token_usage_json" JSONB;
