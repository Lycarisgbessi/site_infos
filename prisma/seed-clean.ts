/**
 * seed-clean.ts — supprime le contenu de démonstration (§21.6) :
 * articles, flashs, dossiers, live blog, médias de démonstration, campagne
 * publicitaire de test, abonnés de démonstration.
 * Conserve le référentiel : rôles, comptes, rubriques, zones géo, villes
 * météo, menus, blocs d'accueil, emplacements pub, listes newsletter,
 * réglages, traductions, pages statiques.
 *
 * Exécution : bun run db:seed:clean
 */

import { rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const DEMO_MEDIA_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "media-demo"
);

async function main(): Promise<void> {
  console.log("── Nettoyage du contenu de démonstration (§21.6) ───────────");

  await db.featuredSlot.deleteMany({});
  await db.articleKeyword.deleteMany({});
  await db.seoRanking.deleteMany({});
  await db.keywordMetric.deleteMany({});
  await db.articleRelated.deleteMany({});
  await db.articleLock.deleteMany({});
  await db.reviewComment.deleteMany({});
  await db.articleVersion.deleteMany({});
  await db.articleAuthor.deleteMany({});
  await db.articleTag.deleteMany({});
  await db.articleCategory.deleteMany({});
  await db.articleGeoZone.deleteMany({});
  await db.articleEntity.deleteMany({});
  await db.comment.deleteMany({});
  await db.articleDailyStat.deleteMany({});
  await db.pageView.deleteMany({});
  await db.article.deleteMany({});
  await db.flashNews.deleteMany({});
  await db.liveEntry.deleteMany({});
  await db.liveBlog.deleteMany({});
  await db.dossier.deleteMany({});
  await db.emailCampaign.deleteMany({});
  await db.emailEvent.deleteMany({});
  await db.subscriberList.deleteMany({});
  await db.subscriber.deleteMany({});
  await db.adCreative.deleteMany({});
  await db.adCampaign.deleteMany({});
  await db.advertiser.deleteMany({});
  await db.adDailyStat.deleteMany({});
  await db.adEvent.deleteMany({});
  const demoMedia = await db.media.findMany({
    where: { storage_key: { startsWith: "media-demo/" } },
    select: { id: true },
  });
  await db.media.deleteMany({
    where: { id: { in: demoMedia.map((m) => m.id) } },
  });
  await db.setting.deleteMany({ where: { key: "system.demo_imported_at" } });

  rmSync(DEMO_MEDIA_DIR, { recursive: true, force: true });

  console.log("✓ Articles, flashs, dossiers, live blog, médias de démo,");
  console.log("  campagne de test et abonnés de démonstration supprimés.");
  console.log("✓ Référentiel conservé (rôles, comptes, rubriques, réglages…).");
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error("seed-clean : échec —", error);
    await db.$disconnect();
    process.exit(1);
  });
