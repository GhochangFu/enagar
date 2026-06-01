/**
 * Audits workflow-designer-templates output against validateWorkflowDefinition
 * and common structural checks (orphan stages, verb/stage mismatches).
 *
 * Run: pnpm exec tsx scripts/audit-workflow-templates.ts
 */
import { createLinearWorkflowDraft, validateWorkflowDefinition } from '@enagar/workflow';
import type { WorkflowDefinition } from '@enagar/workflow';

import {
  applyHoardingScrutinyTemplate,
  applyMunicipalLadderTemplate,
  applyPwdWorksTemplate,
  insertBocResolutionBranch,
  insertHoardingScrutinyBlock,
  insertMunicipalSignoffBlock,
  insertPostApprovalExecutionBlock,
  insertPostApprovalPaymentBlock,
  resetDesignationWorkflow,
} from '../apps/admin-tenant/lib/workflow-designer-templates';

const BASE = createLinearWorkflowDraft('audit-service');

type AuditWarning = {
  kind: string;
  stage?: string;
  from?: string;
  verb?: string;
  message: string;
};

const TEMPLATES: Array<{ name: string; fn: (w: WorkflowDefinition) => WorkflowDefinition }> = [
  { name: 'Hoarding scrutiny (full)', fn: applyHoardingScrutinyTemplate },
  { name: 'PWD works (full)', fn: applyPwdWorksTemplate },
  { name: 'Municipal ladder (full)', fn: applyMunicipalLadderTemplate },
  {
    name: 'Hoarding block only (merge)',
    fn: (w) => insertHoardingScrutinyBlock(w, { afterStageCode: 'submitted' }),
  },
  {
    name: 'BOC branch on hoarding block',
    fn: (w) =>
      insertBocResolutionBranch(
        insertHoardingScrutinyBlock(resetDesignationWorkflow(w), { afterStageCode: 'submitted' }),
      ),
  },
  {
    name: 'Municipal signoff block',
    fn: (w) =>
      insertMunicipalSignoffBlock(resetDesignationWorkflow(w), {
        entryStageCode: 'dept-head-review',
        includeReturnChain: true,
      }),
  },
  {
    name: 'Post-approval payment only',
    fn: (w) => insertPostApprovalPaymentBlock(resetDesignationWorkflow(w)),
  },
  {
    name: 'Post-approval payment + execution',
    fn: (w) =>
      insertPostApprovalExecutionBlock(
        insertPostApprovalPaymentBlock(resetDesignationWorkflow(w), { skipTerminal: true }),
      ),
  },
];

function auditWorkflow(name: string, workflow: WorkflowDefinition) {
  const validation = validateWorkflowDefinition(workflow);
  const warnings: AuditWarning[] = [];
  const stageByCode = new Map(workflow.stages.map((s) => [s.code, s]));

  for (const stage of workflow.stages) {
    if (stage.allowed_verbs !== undefined && stage.allowed_verbs.length === 0) {
      warnings.push({
        kind: 'empty_allowed_verbs',
        stage: stage.code,
        message: 'allowed_verbs is [] (fails save validation)',
      });
    }
  }

  const outgoing = new Map<string, typeof workflow.transitions>();
  const incoming = new Map<string, number>();
  for (const t of workflow.transitions) {
    if (!outgoing.has(t.from)) outgoing.set(t.from, []);
    outgoing.get(t.from)!.push(t);
    incoming.set(t.to, (incoming.get(t.to) ?? 0) + 1);
  }

  for (const stage of workflow.stages) {
    if (stage.initial || stage.terminal) continue;
    const out = outgoing.get(stage.code) ?? [];
    const inc = incoming.get(stage.code) ?? 0;
    if (out.length === 0 && inc === 0) {
      warnings.push({
        kind: 'orphan_stage',
        stage: stage.code,
        message: 'no incoming or outgoing transitions',
      });
    } else if (out.length === 0) {
      warnings.push({
        kind: 'dead_end',
        stage: stage.code,
        message: 'no outgoing transitions (non-terminal)',
      });
    }
  }

  for (const stage of workflow.stages) {
    const verbs = stage.allowed_verbs;
    if (!verbs?.length) continue;
    const out = outgoing.get(stage.code) ?? [];
    for (const verb of verbs) {
      const hasTransition = out.some((t) => t.verb === verb);
      if (!hasTransition) {
        warnings.push({
          kind: 'allowed_verb_no_transition',
          stage: stage.code,
          verb,
          message: `stage allows "${verb}" but no outgoing transition uses it`,
        });
      }
    }
  }

  for (const t of workflow.transitions) {
    const from = stageByCode.get(t.from);
    if (!from?.allowed_verbs?.length) continue;
    if (!from.allowed_verbs.includes(t.verb)) {
      warnings.push({
        kind: 'transition_verb_not_allowed',
        from: t.from,
        verb: t.verb,
        message: `transition "${t.from}" → "${t.to}" verb "${t.verb}" not in allowed_verbs`,
      });
    }
  }

  for (const stage of workflow.stages) {
    if (!stage.allowed_verbs?.includes('return-for-correction')) continue;
    const out = outgoing.get(stage.code) ?? [];
    if (!out.some((t) => t.verb === 'return-for-correction')) {
      warnings.push({
        kind: 'missing_return_for_correction',
        stage: stage.code,
        message: 'return-for-correction in allowed_verbs but no transition',
      });
    }
  }

  return { name, valid: validation.ok, issues: validation.issues, warnings };
}

let failed = 0;
for (const { name, fn } of TEMPLATES) {
  const r = auditWorkflow(name, fn(structuredClone(BASE)));
  console.log(`\n=== ${r.name} ===`);
  if (!r.valid) {
    failed += 1;
    console.log('VALIDATION FAILED:');
    for (const i of r.issues) console.log(`  ${i.path}: ${i.message}`);
  } else {
    console.log('validateWorkflowDefinition: OK');
  }
  if (r.warnings.length) {
    console.log(`WARNINGS (${r.warnings.length}):`);
    for (const w of r.warnings) {
      const loc = w.stage ?? w.from ?? '';
      const verb = w.verb ? ` / ${w.verb}` : '';
      console.log(`  [${w.kind}] ${loc}${verb}: ${w.message}`);
    }
  } else {
    console.log('Structural warnings: none');
  }
}

process.exit(failed > 0 ? 1 : 0);
