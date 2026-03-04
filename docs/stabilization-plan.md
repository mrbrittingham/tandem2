# Stabilization Plan (Correctness First)

## Priority 0: Migration source-of-truth cleanup

1. Consolidate migration workflow on `supabase/migrations/*` only.
2. Add explicit contributor guidance to stop adding new SQL under `packages/shared/supabase/migrations/*`.
3. Validation: `supabase migration list` shows expected versions; fresh environment bootstrap succeeds.
4. Risk reduced: silent schema drift and partially applied changes.

## Priority 1: Environment contract hardening

1. Expand `.env.example` to include required Supabase client vars and concise comments.
2. Add startup/runtime checks with actionable error messages for missing auth env.
3. Validation: clean clone + setup reaches login and authenticated APIs without hidden env surprises.
4. Risk reduced: runtime failures that appear as generic API errors.

## Priority 2: Conversation scope parity and fallback retirement

1. Keep `businessId + locationSlug` as canonical scope across widget, chat, and conversations.
2. Instrument and monitor legacy fallback usage in conversations/storage paths.
3. Remove missing-column/legacy fallback once all environments are migrated.
4. Validation: list/detail/history parity for same scope and no cross-location leakage.
5. Risk reduced: inconsistent data retrieval and difficult-to-debug scope behavior.

## Priority 3: Complete analytics correctness baseline

1. Implement average response time derivation from stored assistant/user message deltas.
2. Define and document resolution-rate/status semantics in one shared contract.
3. Validation: deterministic fixtures produce expected dashboard aggregates.
4. Risk reduced: misleading operator metrics.

## Priority 4: Provider surface alignment

1. Either implement Anthropic/Google adapters or remove them from selectable production config.
2. Keep LLM status endpoint and runbook aligned with actual supported providers.
3. Validation: provider-specific smoke tests pass; unsupported providers fail with clear operator message.
4. Risk reduced: configuration choices that fail only at runtime.

## Priority 5: Light-weight verification harness

1. Add minimal route-level integration checks for `chat`, `conversations`, `bootstrap`, and `llm-test`.
2. Keep checks in CI as a pre-merge gate (alongside lint/typecheck).
3. Validation: known critical regressions are caught automatically.
4. Risk reduced: repeated manual break/fix cycles.
