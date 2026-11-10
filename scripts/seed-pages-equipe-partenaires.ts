/**
 * Initialise les pages « À propos », « Notre équipe », « Nos partenaires »
 * (contenus éditoriaux par défaut, publiées) + membres d'équipe et
 * partenaires d'exemple. Idempotent : upsert par slug/nom.
 *
 * Usage : npx tsx scripts/seed-pages-equipe-partenaires.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
const p = (text: string) => [{ text }];
const h2 = (text: string) => ({ id: uid("h"), type: "heading" as const, level: 2 as const, text });
const para = (text: string) => ({ id: uid("p"), type: "paragraph" as const, text: p(text) });

async function upsertPage(slug: string, title: string, blocks: unknown[]) {
  const existing = await db.page.findFirst({ where: { slug, deleted_at: null }, select: { id: true } });
  if (existing) {
    console.log(`page ${slug} : existe déjà (id ${existing.id}) — inchangée`);
    return;
  }
  await db.page.create({
    data: {
      slug,
      locale: "fr",
      title,
      body: JSON.stringify(blocks),
      template: "about",
      is_published: true,
      seo: JSON.stringify({ title, description: title }),
    },
  });
  console.log(`page ${slug} : créée et publiée`);
}

async function main() {
  // ── Pages ────────────────────────────────────────────────────────────
  await upsertPage(
    "a-propos",
    "À propos d'INFOSPRO",
    [
      h2("Qui sommes-nous ?"),
      para("INFOSPRO.net est un média numérique guinéen d'information, d'analyse et de décodage. Né de la volonté d'une rédaction exigeante, le site couvre l'actualité politique, économique, sociale, culturelle et sportive de la Guinée, de la sous-région et du monde, avec un souci constant de vérification et de rigueur."),
      para("Notre mission : donner aux Guinéens — sur place comme dans la diaspora — une information fiable, indépendante et accessible, en français, en anglais, en espagnol, en arabe et en chinois."),
      h2("Notre ligne éditoriale"),
      para("Rigueur des faits, transparence des sources, indépendance vis-à-vis des pouvoirs politiques et économiques, respect des personnes et pluralité des points de vue. Chaque information publiée est vérifiée ; les erreurs sont corrigées rapidement et explicitement."),
      h2("Nos formats"),
      para("Articles et grands formats, reportages vidéo, podcasts et émissions audio en FM, interviews, vérification des faits et dossiers de fond : INFOSPRO conjugue tous les formats pour accompagner ses lecteurs partout, sur le web et sur mobile."),
      para("Pour nous écrire, proposer une information ou rejoindre la rédaction, consultez la page Contact."),
    ],
  );

  await upsertPage(
    "notre-equipe",
    "Notre équipe",
    [
      para("Une rédaction pluridisciplinaire, en Guinée et au sein de la diaspora : journalistes, reporters vidéo, réalisateurs audio, data-journalistes et vérificateurs travaillent chaque jour pour vous apporter une information de qualité."),
    ],
  );

  await upsertPage(
    "nos-partenaires",
    "Nos partenaires",
    [
      para("INFOSPRO construit son offre éditoriale aux côtés d'institutions, de médias et d'entreprises qui partagent ses valeurs d'indépendance et de rigueur. Que vous souhaitiez soutenir nos formats ou rejoindre notre écosystème, écrivez-nous via la page Publicité."),
    ],
  );

  // ── Équipe (exemples) ────────────────────────────────────────────────
  const teamCount = await db.teamMember.count();
  if (teamCount === 0) {
    await db.teamMember.createMany({
      data: [
        { name: "Fatoumata Camara", role: "Rédactrice en chef", bio: "Coordonne la rédaction et supervise les grands formats politiques et économiques.", position: 0 },
        { name: "Ibrahima Sory Diallo", role: "Journaliste société", bio: "Couvre les questions sociales, d'éducation et de santé en Guinée.", position: 1 },
        { name: "Mariama Bah", role: "Responsable régie & partenariats", bio: "Accompagne les annonceurs et développe les offres de communication.", position: 2 },
        { name: "Amadou Oury Sylla", role: "Reporter vidéo", bio: "Réalise les reportages et documentaires vidéo diffusés sur INFOSPRO TV.", position: 3 },
      ],
    });
    console.log("équipe : 4 membres d'exemple créés");
  } else {
    console.log(`équipe : ${teamCount} membres existants — inchangés`);
  }

  // ── Partenaires (exemples) ───────────────────────────────────────────
  const partnerCount = await db.partner.count();
  if (partnerCount === 0) {
    await db.partner.createMany({
      data: [
        { name: "Ministère de la Communication", category: "Institutions", position: 0 },
        { name: "RTG Radio Télévision Guinée", category: "Médias", position: 1 },
        { name: "Guinée Press Agency", category: "Médias", position: 2 },
        { name: "Eins of Digit", category: "Entreprises", position: 3 },
      ],
    });
    console.log("partenaires : 4 exemples créés");
  } else {
    console.log(`partenaires : ${partnerCount} existants — inchangés`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
