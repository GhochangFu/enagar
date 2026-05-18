import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.16 — Citizen PWA workspace and transactions', () => {
  const page = readRepo('apps/citizen-pwa/app/page.tsx');
  const workspace = readRepo('apps/citizen-pwa/components/citizen-workspace-components.tsx');
  const detailPanel = readRepo('apps/citizen-pwa/components/application-detail-panel.tsx');
  const grievances = readRepo('apps/citizen-pwa/components/grievances-workspace.tsx');
  const sprintPlan = readRepo('docs/runbooks/master-sprint-616-plan.md');
  const sprintExit = readRepo('docs/runbooks/master-sprint-616-exit.md');

  it('adds tenant-branded workspace chrome without changing workspace data flows', () => {
    expect(page).toContain('WorkspaceHeader');
    expect(page).toContain('WorkspaceNavigation');
    expect(page).toContain('WorkspaceServiceCard');
    expect(page).toContain('PaymentAttemptCard');
    expect(workspace).toContain('bg-brand-surface');
    expect(workspace).toContain('border-brand-muted');
    expect(page).toContain('refreshWorkspace');
    expect(page).toContain('goBackToHub');
  });

  it('keeps Services and Apply behavior on existing handlers and form runtime', () => {
    expect(page).toContain('onApply={startApplication}');
    expect(page).toContain('workspaceServiceCodesFilter');
    expect(page).toContain('setWorkspaceServiceCodesFilter(null)');
    expect(page).toContain('DynamicFormFields');
    expect(page).toContain('lookupHolding');
    expect(page).not.toContain('/services/ux-616');
  });

  it('keeps application, payment, and grievance APIs stable while polishing UI', () => {
    expect(detailPanel).toContain('/payments');
    expect(detailPanel).toContain('/receipt');
    expect(page).toContain('simulateStubSettlement');
    expect(page).toContain('ReceiptPreviewPlaceholder');
    expect(grievances).toContain('/grievances');
    expect(grievances).toContain('grievanceStatusTone');
    expect(grievances).toContain('grievancePriorityTone');
    expect(grievances).toContain('ToneChip');
    expect(grievances).not.toContain('/grievances/ux-616');
  });

  it('documents 6.16 scope, no-goals, and current exit state', () => {
    expect(sprintPlan).toContain('Citizen PWA Workspace & Transactions');
    expect(sprintPlan).toContain('No API route, DB, workflow, payment');
    expect(sprintPlan).toContain('360 px viewport');
    expect(sprintExit).toContain('closed');
    expect(sprintExit).toContain('post-smoke UX polish');
    expect(sprintExit).toContain('No API route, database migration');
  });
});
