import { StateFormAssistantClient } from './state-form-assistant-client';

export default function StateFormSetupAssistantPage({
  params,
}: {
  params: { code: string };
}): JSX.Element {
  return <StateFormAssistantClient code={params.code} />;
}
