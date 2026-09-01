/**
 * The breadcrumb trail for a path.
 *
 * Shared by <Breadcrumbs> and the BreadcrumbList structured data, so the trail
 * a visitor sees and the one Google reads cannot disagree.
 *
 * Reproduces the easy_breadcrumb settings the old site used: segments derived
 * from the URL, the page's own title as the last crumb, nothing rendered when
 * Home is the only crumb.
 */
export interface Crumb {
  href: string;
  label: string;
  isLast: boolean;
}

const humanise = (segment: string) =>
  segment.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

export function crumbsFor(
  pathname: string,
  title?: string,
  labels: Record<string, string> = {},
): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);
  return segments.map((segment, i) => {
    const href = `/${segments.slice(0, i + 1).join('/')}`;
    const isLast = i === segments.length - 1;
    return {
      href,
      label: (isLast ? title : undefined) ?? labels[href] ?? humanise(segment),
      isLast,
    };
  });
}
