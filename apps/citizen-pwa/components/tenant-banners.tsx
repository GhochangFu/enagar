import { pickBannerText, type TenantBanner } from '../lib/tenant-banners';

type Props = {
  banners: TenantBanner[];
  locale: string;
};

const severityClass: Record<string, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-950',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  critical: 'border-red-200 bg-red-50 text-red-950',
};

export function TenantBanners({ banners, locale }: Props): JSX.Element | null {
  if (!banners.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      {banners.map((banner) => (
        <article
          key={banner.code}
          className={`rounded-2xl border px-4 py-3 shadow-sm ${
            severityClass[banner.severity] ?? severityClass.info
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide">{banner.severity} notice</p>
          <h3 className="mt-1 font-semibold">{pickBannerText(banner.title, locale)}</h3>
          <p className="mt-1 text-sm opacity-90">{pickBannerText(banner.body, locale)}</p>
          {banner.link_url ? (
            <a
              href={banner.link_url}
              className="mt-2 inline-block text-sm font-semibold underline"
              target="_blank"
              rel="noreferrer"
            >
              Learn more
            </a>
          ) : null}
        </article>
      ))}
    </div>
  );
}
