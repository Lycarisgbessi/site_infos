/**
 * Rubriques (§21.1, contractuel) — 12 rubriques racine et leurs
 * sous-rubriques, avec positions stables.
 */

export interface CategorySeed {
  slug: string;
  name: string;
  shortName?: string;
  description: string;
  position: number;
  children: { slug: string; name: string; description: string }[];
}

export const CATEGORIES: CategorySeed[] = [
  {
    slug: "politique", name: "Politique", position: 1,
    description: "Institutions, partis, élections et gouvernance en Guinée.",
    children: [
      { slug: "institutions", name: "Institutions", description: "Présidence, Assemblée nationale, Gouvernement, CENI." },
      { slug: "partis", name: "Partis politiques", description: "Vie des partis, alliances, congrès et motions." },
      { slug: "elections", name: "Élections", description: "Calendriers, campagnes, résultats et contentieux électoraux." },
      { slug: "gouvernance", name: "Gouvernance", description: "Réformes, lutte contre la corruption, action publique." },
    ],
  },
  {
    slug: "economie", name: "Économie", shortName: "Éco", position: 2,
    description: "Mines, énergie, agriculture, finance et entreprises.",
    children: [
      { slug: "mines", name: "Mines", description: "Bauxite, or, diamant, fer : acteurs, contrats et retombées." },
      { slug: "energie", name: "Énergie", description: "Hydroélectricité, réseaux, accès à l'électricité." },
      { slug: "agriculture", name: "Agriculture", description: "Cultures vivrières, exportations, filières agricoles." },
      { slug: "finance", name: "Finance", description: "Banques, microfinance, BCRG, franc guinéen." },
      { slug: "emploi", name: "Emploi", description: "Marché du travail, formation, emploi des jeunes." },
      { slug: "entreprises", name: "Entreprises", description: "Vie des entreprises, investissements, environnement des affaires." },
    ],
  },
  {
    slug: "societe", name: "Société", position: 3,
    description: "Éducation, santé, justice, religion et faits de société.",
    children: [
      { slug: "education", name: "Éducation", description: "Écoles, universités, examens nationaux, réformes." },
      { slug: "sante", name: "Santé", description: "Hôpitaux, épidémies, politiques de santé publique." },
      { slug: "justice", name: "Justice", description: "Tribunaux, procès emblématiques, droits humains." },
      { slug: "religion", name: "Religion", description: "Cultes, fêtes religieuses, fait religieux en Guinée." },
      { slug: "faits-divers", name: "Faits divers", description: "Faits de société, accidents, drames." },
    ],
  },
  {
    slug: "international", name: "International", position: 4,
    description: "L'Afrique et le monde, vus depuis Conakry.",
    children: [
      { slug: "afrique", name: "Afrique", description: "Actualité du continent et de la sous-région." },
      { slug: "europe", name: "Europe", description: "Politique, société et diaspora en Europe." },
      { slug: "ameriques", name: "Amériques", description: "Amérique du Nord et du Sud." },
      { slug: "asie", name: "Asie", description: "Actualité du continent asiatique." },
      { slug: "moyen-orient", name: "Moyen-Orient", description: "Actualité du Moyen-Orient." },
      { slug: "oceanie", name: "Océanie", description: "Actualité de l'Océanie." },
    ],
  },
  {
    slug: "sport", name: "Sport", position: 5,
    description: "Syli National, championnats et sport guinéen.",
    children: [
      { slug: "football", name: "Football", description: "Ligue 1 guinéenne, mercato, compétitions africaines." },
      { slug: "syli-national", name: "Syli National", description: "Équipe nationale de football de Guinée." },
      { slug: "athletisme", name: "Athlétisme", description: "Athlètes guinéens et compétitions continentales." },
      { slug: "autres-sports", name: "Autres sports", description: "Basket, lutte, judo, cyclisme et disciplines émergentes." },
    ],
  },
  {
    slug: "culture", name: "Culture", position: 6,
    description: "Musique, cinéma, lettres et patrimoine guinéens.",
    children: [
      { slug: "musique", name: "Musique", description: "Scène guinéenne, griots, sorties d'albums, concerts." },
      { slug: "cinema", name: "Cinéma", description: "Films, festivals, cinéastes guinéens." },
      { slug: "litterature", name: "Littérature", description: "Écrivains, prix, salon du livre." },
      { slug: "patrimoine", name: "Patrimoine", description: "Histoire, traditions, sites et mémoire." },
      { slug: "mode", name: "Mode", description: "Créateurs, textiles, esthétique guinéenne." },
    ],
  },
  {
    slug: "environnement", name: "Environnement", position: 7,
    description: "Climat, biodiversité et pollution en Guinée.",
    children: [
      { slug: "climat", name: "Climat", description: "Changements climatiques, saison des pluies, adaptation." },
      { slug: "biodiversite", name: "Biodiversité", description: "Parcs, faune, flore, aires protégées." },
      { slug: "pollution", name: "Pollution", description: "Déchets, mines et environnement, qualité de l'air et de l'eau." },
    ],
  },
  {
    slug: "tech", name: "Tech & Innovation", shortName: "Tech", position: 8,
    description: "Numérique, télécoms et startups en Guinée.",
    children: [
      { slug: "numerique", name: "Numérique", description: "Transformation numérique, administration électronique." },
      { slug: "telecoms", name: "Télécoms", description: "Opérateurs, couverture réseau, Internet mobile." },
      { slug: "startups", name: "Startups", description: "Écosystème entrepreneurial et fintechs." },
    ],
  },
  {
    slug: "opinions", name: "Opinions", position: 9,
    description: "Éditoriaux, tribunes et analyses.",
    children: [
      { slug: "editorial", name: "Éditorial", description: "Le point de vue de la rédaction." },
      { slug: "tribunes", name: "Tribunes", description: "Points de vue exprimés sous la responsabilité de leurs auteurs." },
      { slug: "analyses", name: "Analyses", description: "Décryptages et éclairages d'experts." },
      { slug: "chroniques", name: "Chroniques", description: "Chroniques régulières de nos signatures." },
    ],
  },
  {
    slug: "reportages", name: "Reportages", position: 10,
    description: "Grands formats, vidéos et portraits.",
    children: [
      { slug: "videos", name: "Vidéos", description: "Reportages filmés et documentaires." },
      { slug: "grands-formats", name: "Grands formats", description: "Enquêtes narratives et longues pièces." },
      { slug: "portraits", name: "Portraits", description: "Figures de la société guinéenne." },
    ],
  },
  {
    slug: "verification", name: "Vérification", position: 11,
    description: "Fact-checking : vérifier les affirmations qui circulent.",
    children: [],
  },
  {
    slug: "diaspora", name: "Diaspora", position: 12,
    description: "Les Guinéens de l'étranger : vie, réussites, actualités.",
    children: [],
  },
];
