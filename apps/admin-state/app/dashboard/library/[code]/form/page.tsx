import { GlobalFormBuilderClient } from './global-form-builder-client';

export default function GlobalFormBuilderPage({
  params,
}: {
  params: { code: string };
}): JSX.Element {
  return <GlobalFormBuilderClient code={params.code} />;
}
