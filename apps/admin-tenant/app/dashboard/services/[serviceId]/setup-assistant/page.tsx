import SetupAssistantClient from './setup-assistant-client';

export default function SetupAssistantPage({
  params,
}: {
  params: { serviceId: string };
}): JSX.Element {
  return <SetupAssistantClient serviceId={params.serviceId} />;
}
