import { createLinearWorkflowDraft } from '@enagar/workflow';

import { applyHoardingScrutinyTemplate } from '../../../apps/admin-tenant/lib/workflow-designer-templates.ts';

const serviceCode = process.argv[2]?.trim() || 'ad-hoarding';
const workflow = applyHoardingScrutinyTemplate(createLinearWorkflowDraft(serviceCode));
workflow.code = `${serviceCode}-workflow-v1`;
process.stdout.write(JSON.stringify(workflow));
