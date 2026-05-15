import ServiceDesignerClient from './service-designer-client';

export default function ServiceDesignerPage({
  params,
}: {
  params: { serviceId: string };
}): JSX.Element {
  return <ServiceDesignerClient serviceId={params.serviceId} />;
}
