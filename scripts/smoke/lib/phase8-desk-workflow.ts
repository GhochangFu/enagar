/**
 * CLI wrapper — prefer importing ./phase8-desk-workflow.mjs from smoke scripts.
 */
import { phase8DeskSmokeWorkflow } from './phase8-desk-workflow.mjs';

const serviceCode = process.argv[2] ?? 'ad-hoarding';
process.stdout.write(JSON.stringify(phase8DeskSmokeWorkflow(serviceCode)));
