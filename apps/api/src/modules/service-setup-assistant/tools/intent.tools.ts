import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/database/prisma.service';
import { AdminTenantService } from '../../admin-tenant/admin-tenant.service';

import { ARCHETYPE_VALUES } from './tenant-config.tools';

import type { SetupToolContext, SetupToolDefinition, SetupToolResult } from './tool.types';

const KEYWORD_ARCHETYPE_RULES: Array<{
  pattern: RegExp;
  archetype: (typeof ARCHETYPE_VALUES)[number];
}> = [
  { pattern: /\b(booking|hall|slot|reservation)\b/i, archetype: 'booking' },
  { pattern: /\b(scrutiny|hoarding|advertisement)\b/i, archetype: 'scrutiny' },
  {
    pattern: /\b(municipal ladder|designation ladder|eo\b|cic\b|vc\b|chairperson)\b/i,
    archetype: 'municipal_ladder',
  },
  { pattern: /\b(certificate|birth|death|marriage|noc)\b/i, archetype: 'certificate' },
  { pattern: /\b(linear|simple approval|clerk.?officer)\b/i, archetype: 'linear_approval' },
];

function inferArchetypeFromText(text: string): (typeof ARCHETYPE_VALUES)[number] | null {
  for (const rule of KEYWORD_ARCHETYPE_RULES) {
    if (rule.pattern.test(text)) {
      return rule.archetype;
    }
  }
  return null;
}

function inferArchetypeFromDesigner(
  designer: Awaited<ReturnType<AdminTenantService['getServiceDesigner']>>,
): (typeof ARCHETYPE_VALUES)[number] | null {
  const pattern = designer.workflow_pattern ?? '';
  if (pattern === 'booking') {
    return 'booking';
  }
  if (pattern === 'cert-issuance' || pattern === 'certificate') {
    return 'certificate';
  }
  if (pattern === 'linear') {
    return 'linear_approval';
  }
  if (pattern === 'scrutiny' || pattern === 'hoarding') {
    return 'scrutiny';
  }
  return null;
}

@Injectable()
export class IntentTools {
  constructor(
    private readonly adminTenant: AdminTenantService,
    private readonly prisma: PrismaService,
  ) {}

  definitions(): SetupToolDefinition[] {
    return [
      {
        name: 'detectArchetype',
        description:
          'Classify service archetype (linear_approval, scrutiny, certificate, booking, municipal_ladder) and save to session.',
        execute: (ctx, args) => this.detectArchetype(ctx, args),
      },
      {
        name: 'matchGlobalTemplate',
        description:
          'Check linked global form template and workflow pattern on the service (read-only).',
        execute: (ctx) => this.matchGlobalTemplate(ctx),
      },
      {
        name: 'summarizeRequirements',
        description: 'Write structured requirements brief to session for downstream steps.',
        execute: (ctx, args) => this.summarizeRequirements(ctx, args),
      },
    ];
  }

  private async detectArchetype(
    ctx: SetupToolContext,
    args: Record<string, unknown>,
  ): Promise<SetupToolResult> {
    const serviceId = ctx.serviceId;
    if (!serviceId) {
      throw new BadRequestException('Intent tools require serviceId');
    }

    let archetype: (typeof ARCHETYPE_VALUES)[number] | null = null;
    if (typeof args.archetype === 'string' && args.archetype.trim()) {
      const candidate = args.archetype.trim();
      if (!ARCHETYPE_VALUES.includes(candidate as (typeof ARCHETYPE_VALUES)[number])) {
        throw new BadRequestException(`archetype must be one of: ${ARCHETYPE_VALUES.join(', ')}`);
      }
      archetype = candidate as (typeof ARCHETYPE_VALUES)[number];
    } else if (typeof args.description === 'string') {
      archetype = inferArchetypeFromText(args.description);
    }

    const designer = await this.adminTenant.getServiceDesigner(ctx.principal, serviceId);
    if (!archetype) {
      archetype = inferArchetypeFromDesigner(designer);
    }
    if (!archetype) {
      archetype = 'linear_approval';
    }

    await this.prisma.serviceSetupSession.update({
      where: { id: ctx.session.id },
      data: { archetype },
    });

    return {
      success: true,
      summary: `Detected archetype: ${archetype}`,
      data: { archetype, workflow_pattern: designer.workflow_pattern },
    };
  }

  private async matchGlobalTemplate(ctx: SetupToolContext): Promise<SetupToolResult> {
    const serviceId = ctx.serviceId;
    if (!serviceId) {
      throw new BadRequestException('Intent tools require serviceId');
    }
    const designer = await this.adminTenant.getServiceDesigner(ctx.principal, serviceId);
    const global = designer.global_form_template;
    return {
      success: true,
      summary: global
        ? `Linked global template: ${global.global_code}`
        : 'No global form template linked',
      data: {
        global_form_template: global,
        workflow_pattern: designer.workflow_pattern,
        service_code: designer.service.code,
      },
    };
  }

  private async summarizeRequirements(
    ctx: SetupToolContext,
    args: Record<string, unknown>,
  ): Promise<SetupToolResult> {
    const summary = args.summary ?? args.requirements;
    if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
      throw new BadRequestException('summary must be an object');
    }

    await this.prisma.serviceSetupSession.update({
      where: { id: ctx.session.id },
      data: { requirementsJson: summary as object },
    });

    return {
      success: true,
      summary: 'Saved requirements brief to session',
      data: summary,
    };
  }
}
