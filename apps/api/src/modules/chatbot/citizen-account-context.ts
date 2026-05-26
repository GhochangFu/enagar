/** Statuses treated as still open for citizen-facing counts. */
export const OPEN_GRIEVANCE_STATUSES = ['submitted', 'under_review', 'in_progress'] as const;

export type CitizenAccountSummaries = {
  citizenId: string | null;
  summary: string;
  applications: string;
  grievances: string;
  payments: string;
};

export function formatGrievanceAccountSummary(params: {
  linked: boolean;
  total: number;
  open: number;
  recent: ReadonlyArray<{
    grievanceNo: string;
    status: string;
    category: string;
    createdAt: Date;
  }>;
}): string {
  if (!params.linked) {
    return 'Not available — citizen profile not linked for this municipality.';
  }
  if (params.total === 0) {
    return 'Total grievances filed under this municipality: 0. The citizen has not submitted any grievances here.';
  }

  const closedOrResolved = params.total - params.open;
  const lines = [
    `Total grievances filed under this municipality: ${params.total}.`,
    `Open (submitted, under review, in progress): ${params.open}.`,
    `Resolved or closed: ${closedOrResolved}.`,
  ];

  if (params.recent.length > 0) {
    lines.push('Recent grievances (newest first):');
    for (const row of params.recent) {
      const filed = row.createdAt.toISOString().slice(0, 10);
      lines.push(
        `- ${row.grievanceNo}: status ${row.status}, category ${row.category}, filed ${filed}`,
      );
    }
  }

  return lines.join('\n');
}

export function formatApplicationAccountSummary(params: {
  linked: boolean;
  total: number;
  recentLines: readonly string[];
}): string {
  if (!params.linked) {
    return 'Not available — citizen profile not linked for this municipality.';
  }
  if (params.total === 0) {
    return 'Total active applications on file: 0.';
  }

  const lines = [
    `Total active applications on file (excluding cancelled/rejected): ${params.total}.`,
  ];
  if (params.recentLines.length > 0) {
    lines.push('Recent applications:');
    lines.push(...params.recentLines);
  }
  return lines.join('\n');
}

export function formatPaymentAccountSummary(params: {
  total: number;
  settled: number;
  recent: ReadonlyArray<{
    status: string;
    amountPaise: number;
    createdAt: Date;
    docketNo: string | null;
    serviceCode: string | null;
  }>;
}): string {
  if (params.total === 0) {
    return 'Total payment attempts under this municipality: 0.';
  }

  const lines = [
    `Total payment attempts under this municipality: ${params.total}.`,
    `Settled payments: ${params.settled}.`,
  ];

  if (params.recent.length > 0) {
    lines.push('Recent payment attempts (newest first):');
    for (const row of params.recent) {
      const filed = row.createdAt.toISOString().slice(0, 10);
      const amount = (row.amountPaise / 100).toFixed(2);
      const service =
        row.serviceCode && row.docketNo
          ? `${row.serviceCode} (docket ${row.docketNo})`
          : (row.serviceCode ?? 'linked application');
      lines.push(`- ${filed}: status ${row.status}, INR ${amount}, ${service}`);
    }
  }

  return lines.join('\n');
}

/** Compact block appended in KB-only mode for signed-in account facts. */
export function formatCitizenAccountBlockForKbOnly(summaries: {
  grievances: string;
  applications: string;
  payments: string;
}): string | null {
  const sections: string[] = [];
  if (!summaries.grievances.startsWith('Not available')) {
    sections.push(`Grievances:\n${summaries.grievances}`);
  }
  if (!summaries.applications.startsWith('Not available')) {
    sections.push(`Applications:\n${summaries.applications}`);
  }
  sections.push(`Payments:\n${summaries.payments}`);
  return sections.join('\n\n');
}
