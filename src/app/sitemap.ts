import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://site-infos-six.vercel.app';

export const revalidate = 86400; // revalidation quotidienne

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'hourly', priority: 1 },
    { url: `${SITE_URL}/video`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/pages/contact`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/pages/publicite`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/pages/newsletters`, changeFrequency: 'weekly', priority: 0.5 },
  ];

  const articles = await db.article.findMany({
    where: { deleted_at: null, status: 'published', published_at: { lte: new Date() } },
    select: { slug: true, updated_at: true },
    orderBy: { published_at: 'desc' },
    take: 5000,
  });

  return [
    ...staticPages,
    ...articles.map((a) => ({
      url: `${SITE_URL}/article/${a.slug}`,
      lastModified: a.updated_at,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];
}
