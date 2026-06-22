import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import type { SetupAssistantScope, SetupSessionDto, SetupAssistantStep } from '@enagar/types';

type CreateSessionInput = {
  tenantId: string;
  serviceId: string;
  staffSubjectId: string;
  scope: SetupAssistantScope;
};

type CreateStateFormSessionInput = {
  tenantId: string;
  globalServiceCode: string;
  staffSubjectId: string;
};

@Injectable()
export class SetupSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(input: CreateSessionInput): Promise<SetupSessionDto> {
    const row = await this.prisma.serviceSetupSession.create({
      data: {
        tenantId: input.tenantId,
        serviceId: input.serviceId,
        staffSubjectId: input.staffSubjectId,
        scope: input.scope,
        currentStep: this.initialStepForScope(input.scope),
        status: 'active',
      },
    });
    return this.toDto(row);
  }

  async createStateFormSession(input: CreateStateFormSessionInput): Promise<SetupSessionDto> {
    const row = await this.prisma.serviceSetupSession.create({
      data: {
        tenantId: input.tenantId,
        globalServiceCode: input.globalServiceCode,
        staffSubjectId: input.staffSubjectId,
        scope: 'form',
        currentStep: 2,
        status: 'active',
      },
    });
    return this.toDto(row);
  }

  async markStepComplete(
    sessionId: string,
    tenantId: string,
    staffSubjectId: string,
    step: SetupAssistantStep,
  ): Promise<SetupSessionDto> {
    const row = await this.assertSessionAccess(sessionId, tenantId, staffSubjectId);
    const raw = row.stepCompletion;
    const stepCompletion =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? { ...(raw as Record<string, boolean>) }
        : {};
    stepCompletion[String(step)] = true;
    const updated = await this.prisma.serviceSetupSession.update({
      where: { id: sessionId },
      data: { stepCompletion },
    });
    return this.toDto(updated);
  }

  async getSession(
    sessionId: string,
    tenantId: string,
    staffSubjectId: string,
  ): Promise<SetupSessionDto> {
    const row = await this.assertSessionAccess(sessionId, tenantId, staffSubjectId);
    return this.toDto(row);
  }

  async setCurrentStep(
    sessionId: string,
    tenantId: string,
    staffSubjectId: string,
    currentStep: number,
  ): Promise<SetupSessionDto> {
    if (!Number.isInteger(currentStep) || currentStep < 1 || currentStep > 5) {
      throw new BadRequestException('current_step must be an integer between 1 and 5');
    }

    const row = await this.assertSessionAccess(sessionId, tenantId, staffSubjectId);
    const allowedSteps = this.allowedStepsForScope(row.scope as SetupAssistantScope);
    if (!allowedSteps.includes(currentStep as SetupAssistantStep)) {
      throw new BadRequestException(
        `current_step ${currentStep} is not allowed for scope "${row.scope}"`,
      );
    }
    const updated = await this.prisma.serviceSetupSession.update({
      where: { id: sessionId },
      data: { currentStep },
    });
    return this.toDto(updated);
  }

  async assertSessionAccess(sessionId: string, tenantId: string, staffSubjectId: string) {
    const row = await this.prisma.serviceSetupSession.findUnique({ where: { id: sessionId } });
    if (!row) {
      throw new NotFoundException('Setup session not found');
    }
    if (row.tenantId !== tenantId) {
      throw new ForbiddenException('Setup session does not belong to this tenant');
    }
    if (row.staffSubjectId !== staffSubjectId) {
      throw new ForbiddenException('Setup session does not belong to this staff user');
    }
    return row;
  }

  private initialStepForScope(scope: SetupAssistantScope): SetupAssistantStep {
    return this.allowedStepsForScope(scope)[0] as SetupAssistantStep;
  }

  private allowedStepsForScope(scope: SetupAssistantScope): SetupAssistantStep[] {
    switch (scope) {
      case 'full':
        return [1, 2, 3, 4, 5];
      case 'form':
        return [2, 5];
      case 'workflow':
        return [3, 5];
      case 'payment':
        return [4, 5];
      case 'review':
        return [5];
      default: {
        const exhaustive: never = scope;
        return exhaustive as never;
      }
    }
  }

  private toDto(row: {
    id: string;
    scope: string;
    currentStep: number;
    archetype: string | null;
    stepCompletion: unknown;
    status: string;
  }): SetupSessionDto {
    const scope = row.scope as SetupAssistantScope;
    const currentStep = row.currentStep as SetupAssistantStep;
    const raw = row.stepCompletion;
    const stepCompletion =
      raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, boolean>) : {};

    return {
      id: row.id,
      scope,
      current_step: currentStep,
      archetype: row.archetype,
      step_completion: stepCompletion,
      status: row.status as SetupSessionDto['status'],
    };
  }
}
