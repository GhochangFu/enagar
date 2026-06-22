import { validateFormSchema } from '@enagar/forms';
import { validateWorkflowDefinition } from '@enagar/workflow';
import { Injectable } from '@nestjs/common';

import { AdminStateService } from '../admin-state/admin-state.service';
import { AdminTenantService } from '../admin-tenant/admin-tenant.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { SetupReadinessChecklist, SetupReadinessItem } from '@enagar/types';

type ServiceConfigShape = {
  fee_rule: unknown;
  required_documents: unknown;
  revenue_head: { code: string } | null;
  bookable_asset_codes: string[];
};

@Injectable()
export class ReadinessChecklistService {
  constructor(
    private readonly adminTenant: AdminTenantService,
    private readonly adminState: AdminStateService,
  ) {}

  async forService(tenantId: string, serviceId: string): Promise<SetupReadinessChecklist> {
    const principal = {
      subject: 'service-setup-assistant',
      tenantId,
      roles: ['tenant_admin'],
      expiresAt: new Date(Date.now() + 60_000),
    };

    const [designer, config] = await Promise.all([
      this.adminTenant.getServiceDesigner(principal, serviceId),
      this.adminTenant.getServiceConfig(principal, serviceId),
    ]);

    const hasFormDraft = Boolean(designer.form_draft?.form_schema);
    const formDraftValid =
      hasFormDraft && validateFormSchema(designer.form_draft?.form_schema as never).ok;
    const hasWorkflowDraft = Boolean(designer.workflow_draft?.definition);
    const workflowDraftValid =
      hasWorkflowDraft &&
      validateWorkflowDefinition(designer.workflow_draft?.definition as never).ok;
    const formPublished = Boolean(designer.form_published);
    const workflowPublished = Boolean(designer.workflow_published);
    const configComplete = this.isConfigComplete(config);
    const bookingAssetsReady =
      designer.workflow_pattern !== 'booking' || (config.bookable_asset_codes ?? []).length > 0;

    const items: SetupReadinessItem[] = [
      {
        key: 'form_draft_valid',
        label: 'Form draft is valid',
        status: formDraftValid ? 'green' : hasFormDraft ? 'amber' : 'red',
        message: formDraftValid ? undefined : 'Fix or create a valid form draft',
      },
      {
        key: 'form_published',
        label: 'Form is published',
        status: formPublished ? 'green' : 'amber',
        message: formPublished ? undefined : 'Publish form draft from Service Designer',
      },
      {
        key: 'workflow_draft_valid',
        label: 'Workflow draft is valid',
        status: workflowDraftValid ? 'green' : hasWorkflowDraft ? 'amber' : 'red',
        message: workflowDraftValid ? undefined : 'Fix or create a valid workflow draft',
      },
      {
        key: 'workflow_published',
        label: 'Workflow is published',
        status: workflowPublished ? 'green' : 'amber',
        message: workflowPublished ? undefined : 'Publish workflow draft from Service Designer',
      },
      {
        key: 'config_complete',
        label: 'Service configuration is complete',
        status: configComplete ? 'green' : 'amber',
        message: configComplete ? undefined : 'Fee rule, documents, or revenue head is incomplete',
      },
      {
        key: 'booking_assets',
        label: 'Booking assets are mapped (booking services only)',
        status: bookingAssetsReady ? 'green' : 'amber',
        message: bookingAssetsReady ? undefined : 'Map bookable assets in service config',
      },
    ];

    const readyToPublish =
      formDraftValid &&
      workflowDraftValid &&
      configComplete &&
      formPublished &&
      workflowPublished &&
      bookingAssetsReady;

    return {
      items,
      ready_to_publish: readyToPublish,
    };
  }

  async forGlobalTemplate(
    principal: AuthenticatedPrincipal,
    code: string,
  ): Promise<SetupReadinessChecklist> {
    const template = await this.adminState.getGlobalServiceTemplate(principal, code);
    const formValid =
      template.has_usable_form_schema && validateFormSchema(template.form_schema as never).ok;
    const items: SetupReadinessItem[] = [
      {
        key: 'form_draft_valid',
        label: 'Global form template is valid',
        status: formValid ? 'green' : template.form_schema ? 'amber' : 'red',
        message: formValid ? undefined : 'Fix or create a valid global form schema',
      },
      {
        key: 'form_published',
        label: 'Template lifecycle is published',
        status: template.lifecycle_status === 'published' ? 'green' : 'amber',
        message:
          template.lifecycle_status === 'published'
            ? undefined
            : 'Publish template from State library when ready',
      },
    ];
    return {
      items,
      ready_to_publish: formValid && template.lifecycle_status === 'published',
    };
  }

  private isConfigComplete(config: ServiceConfigShape): boolean {
    const hasDocuments =
      Array.isArray(config.required_documents) && config.required_documents.length > 0;
    const feeRule = config.fee_rule;
    const hasFeeRuleObject = feeRule && typeof feeRule === 'object' && !Array.isArray(feeRule);
    if (!hasFeeRuleObject || !hasDocuments) {
      return false;
    }

    const feeType = (feeRule as { type?: string }).type;
    const revenueRequired = feeType !== 'free';
    if (revenueRequired && !config.revenue_head?.code) {
      return false;
    }
    return true;
  }
}
