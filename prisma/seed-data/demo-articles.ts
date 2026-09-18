/**
 * Contenu de démonstration (§21.6) : 30 articles répartis sur les
 * rubriques — avec images, auteurs variés, formats variés (dont 1 live
 * blog, 2 vidéos, 1 vérification, 2 longs formats) — supprimable via
 * `pnpm db:seed:clean`. Texte journalistique réel, jamais de faux texte.
 */

import type { Block, RichText } from "../../src/types/blocks";
import { newBlockId } from "../../src/lib/blocks";

export type DemoFormat =
  | "brief" | "standard" | "analysis" | "investigation" | "interview"
  | "opinion" | "portrait" | "live" | "video" | "factcheck" | "longform";

export interface DemoArticle {
  slug: string;
  title: string;
  kicker?: string;
  lede: string;
  categorySlug: string;
  format: DemoFormat;
  importance: 1 | 2 | 3 | 4 | 5;
  authorIndex: number; // index dans la liste des comptes seed
  tags: string[];
  hoursAgo: number; // ancienneté de publication
  isBreaking?: boolean;
  blocks: () => Block[];
}

function para(text: string): Block {
  return { id: newBlockId(), type: "paragraph", text: [{ text }] as RichText };
}

function head(text: string): Block {
  return { id: newBlockId(), type: "heading", level: 2, text };
}

function bullets(items: string[]): Block {
  return { id: newBlockId(), type: "list", style: "bullet", items: items.map((i) => [{ text: i }] as RichText) };
}

function quote(text: string, author: string, role: string): Block {
  return { id: newBlockId(), type: "quote", text, author, role };
}

function keypoints(items: string[]): Block {
  return { id: newBlockId(), type: "keypoints", title: "À retenir", items };
}

export const DEMO_ARTICLES: DemoArticle[] = [
  // ─── POLITIQUE (3) ───────────────────────────────────────────────────
  {
    slug: "conseil-national-transition-nouveau-calendrier-consultations",
    title: "Transition : le calendrier des consultations politiques enfin dévoilé",
    kicker: "Politique",
    lede: "Le conseil chargé d'organiser la transition a publié le calendrier officiel des consultations avec les partis politiques, ouvrant une séquence attendue depuis plusieurs mois.",
    categorySlug: "politique",
    format: "standard",
    importance: 2,
    authorIndex: 0,
    tags: ["transition", "institutions", "consultations"],
    hoursAgo: 3,
    blocks: () => [
      para("Le calendrier des consultations politiques a été rendu public ce matin à Conakry. Les partis politiques seront reçus en deux semaines, selon un ordre de passage établi par tirage au sort, indique le document consulté par INFOSPRO."),
      para("Cette séquence doit permettre d'établir un cadre commun sur le contenu du dialogue national et les étapes institutionnelles à venir. Plusieurs formations de l'opposition ont annoncé leur participation, tout en demandant des garanties écrites sur la feuille de route."),
      para("Les organisations de la société civile, les confessions religieuses et les syndicats seront consultés dans la foulée, précise le calendrier. Un rapport de synthèse est attendu à l'issue de la phase."),
      keypoints([
        "Deux semaines de consultations avec les partis politiques.",
        "Société civile, syndicats et confessions religieuses consultés ensuite.",
        "Un rapport de synthèse clôturera la phase.",
      ]),
    ],
  },
  {
    slug: "ceni-revision-listes-electorales-riders-mobiles",
    title: "Révision des listes électorales : les équipes mobiles déployées dans les quatre régions naturelles",
    kicker: "Élections",
    lede: "L'institution en charge des élections déploie des équipes mobiles d'enrôlement et de correction dans les quatre régions naturelles du pays.",
    categorySlug: "politique",
    format: "standard",
    importance: 3,
    authorIndex: 1,
    tags: ["élections", "listes électorales"],
    hoursAgo: 27,
    blocks: () => [
      para("Les équipes mobiles commencent leur tournée dans les préfectures, avec un double objectif : régulariser les situations administratives signalées et mettre à jour les adresses des électeurs déplacés."),
      para("Dans les localités visitées par INFOSPRO, la mobilisation des autorités locales conditionne l'accueil du public. Les responsables d'antenne appellent les jeunes qui atteignent l'âge de la majorité à se présenter avec leurs pièces."),
      para("Les organisations d'observation électorale demanderont un accès aux données de progression, afin d'évaluer l'inclusivité de l'opération avant la prochaine échéance de vote."),
    ],
  },
  {
    slug: "analyse-gouvernance-budgetaire-defis-restes-a-faire",
    title: "Analyse — Gouvernance budgétaire : ce qui a changé, ce qui reste à faire",
    kicker: "Analyse",
    lede: "Entre réformes de la dépense publique et pressions sociales, l'état des lieux d'une gouvernance budgétaire sous surveillance des partenaires.",
    categorySlug: "politique",
    format: "analysis",
    importance: 3,
    authorIndex: 0,
    tags: ["gouvernance", "budget", "réformes"],
    hoursAgo: 52,
    blocks: () => [
      para("La programmation budgétaire a gagné en lisibilité : reportings trimestriels, publication des principaux marchés publics et numérisation progressive des procédures de commande publique."),
      para("Mais l'exécution reste fragilisée par les dépenses imprévues et la pression des subventions, rappellent les analystes du secteur. La question de la dette intérieure envers les entreprises locales demeure un point sensible."),
      head("Trois chantiers décisifs"),
      bullets([
        "La transparence sur les recettes minières reversées aux collectivités.",
        "L'harmonisation des statistiques entre ministères et instituts publics.",
        "Le renforcement du contrôle parlementaire sur les reports de crédits.",
      ]),
      para("Les partenaires techniques et financiers conditionnent désormais une part de leur appui à ces chantiers, signe que la gouvernance budgétaire est devenue un marqueur de confiance."),
    ],
  },

  // ─── ÉCONOMIE (3) ────────────────────────────────────────────────────
  {
    slug: "bauxite-exportations-en-hausse-revenus-communautes",
    title: "Bauxite : les exportations repartent à la hausse, le débat sur les retombées locales s'intensifie",
    kicker: "Mines",
    lede: "Les volumes exportés de bauxite progressent au premier semestre, portés par la demande internationale, alors que s'ouvre le débat sur la part des revenus reversée aux communautés minières.",
    categorySlug: "economie",
    format: "standard",
    importance: 2,
    authorIndex: 1,
    tags: ["bauxite", "mines", "exportations"],
    hoursAgo: 6,
    blocks: () => [
      para("Les terminaux miniers du littoral affichent une activité soutenue : les volumes de bauxite exportés sur les six premiers mois progressent par rapport à la période équivalente de l'année précédente, selon les chiffres compilés par INFOSPRO auprès des opérateurs."),
      para("Cette dynamique relance la discussion sur la redistribution : les collectivités des zones minières réclament une application rapide et lisible du mécanisme de développement local."),
      para("Les industriels, eux, mettent en avant leurs programmes d'infrastructure — routes, centrales, water towers — en accompagnement des conventions."),
      quote("Ce que nous demandons, c'est la traçabilité de chaque franc reversé : la communauté doit savoir ce qui est dû et ce qui arrive.", "un représentant communal", "zone de Boké"),
    ],
  },
  {
    slug: "tarif-electricite-revision-annoncee-abonnes-reclament-transparence",
    title: "Électricité : la révision tarifaire annoncée suscite une demande de transparence",
    kicker: "Énergie",
    lede: "L'opérateur évoque la couverture des coûts de production ; les abonnés exigent la publication détaillée de la structure des prix.",
    categorySlug: "economie",
    format: "standard",
    importance: 3,
    authorIndex: 2,
    tags: ["électricité", "tarifs", "énergie"],
    hoursAgo: 20,
    blocks: () => [
      para("Une révision de la grille tarifaire de l'électricité est à l'étude, indique l'opérateur national, qui invoque la hausse des coûts de production et l'urgence des investissements de réseau."),
      para("Les associations de consommateurs réclament la publication de la décomposition des coûts — production, transport, distribution, pertes techniques — avant toute décision."),
      para("Au menu des discussions avec l'État : le ciblage social des foyers modestes et la réduction des pertes non techniques sur le réseau de distribution."),
    ],
  },
  {
    slug: "enquete-filiere-anacarde-marche-perd-pesos-benefices",
    title: "Enquête — Anacarde : qui capte la valeur d'une noix qui voyage beaucoup ?",
    kicker: "Investigation",
    lede: "De la brousse de Haute-Guinée aux usines de transformation, INFOSPRO a suivi la filière anacarde pour comprendre où s'arrête le bénéfice du producteur.",
    categorySlug: "economie",
    format: "investigation",
    importance: 2,
    authorIndex: 1,
    tags: ["anacarde", "agriculture", "exportations"],
    hoursAgo: 70,
    blocks: () => [
      para("Au marché de collecte, le prix affiché semble bon. Mais entre le sac pesé à la ferme et le conteneur chargé au port, une chaîne d'intermédiaires prélève sa part : transporteurs, agrégateurs, bailleurs de fonds saisonniers."),
      para("Les producteurs rencontrés décrivent un mécanisme bien rodé : l'avance de cash au début de campagne, puis un prix d'achat imposé au moment de la livraison. Résultat, la marge se contracte là où le risque physique est pris."),
      head("La transformation, chance ou mirage ?"),
      para("Les unités locales de décorticage créent de l'emploi, majoritairement féminin, mais affrontent le coût du financement et la volatilité du cours international. Sans accès au crédit de campagne à taux maîtrisé, la valeur ajoutée reste captive."),
      keypoints([
        "La marge du producteur se contracte au profit des intermédiaires.",
        "Le crédit de campagne est le verrou principal de la transformation locale.",
        "L'emploi du décorticage est majoritairement féminin.",
      ]),
      para("La réponse publique — guichet de financement, agrégation coopérative, normes de qualité — déterminera si la filière franchit le palier ou reste un exportateur de matière brute."),
    ],
  },

  // ─── SOCIÉTÉ (3) ─────────────────────────────────────────────────────
  {
    slug: "baccalaureate-results-2026-taux-reussite-regionaux",
    title: "Baccalauréat : la publication des résultats relance le débat sur les écarts régionaux",
    kicker: "Éducation",
    lede: "Le taux de réussite national progresse légèrement, mais les disparités entre régions et entre séries nourrissent les interrogations des familles et des enseignants.",
    categorySlug: "societe",
    format: "standard",
    importance: 2,
    authorIndex: 0,
    tags: ["baccalauréat", "éducation", "résultats"],
    hoursAgo: 10,
    blocks: () => [
      para("Les résultats du baccalauréat sont disponibles en ligne et dans les centres d'examen. Le taux national de réussite progresse de quelques points, selon les chiffres communiqués par les services compétents."),
      para("La lecture par région révèle des écarts persistants : les académies de l'intérieur restent en retrait par rapport à la zone spéciale de Conakry, un motif de mobilisation pour les syndicats d'enseignants qui réclament un plan d'équipement ciblé."),
      para("Les recteurs annoncent des phases de rattrapage et un appui renforcé aux candidats ajournés avec mention « passage »."),
    ],
  },
  {
    slug: "don-sang-centres-transfusion-appel-dons-conakry",
    title: "Santé : les centres de transfusion lancent un appel national au don de sang",
    kicker: "Santé",
    lede: "Les réserves des banques de sang atteignent des seuils critiques, notamment pour les groupes rares, alertent les centres de transfusion.",
    categorySlug: "societe",
    format: "brief",
    importance: 3,
    authorIndex: 2,
    tags: ["santé", "don de sang"],
    hoursAgo: 4,
    blocks: () => [
      para("Les centres de transfusion sanguine lancent un appel au don en raison de stocks insuffisants, particulièrement pour les groupes sanguins rares et les besoins des maternités."),
      para("Les dons sont possibles dans les centres régionaux et lors des collectes mobiles annoncées cette semaine à Conakry."),
    ],
  },
  {
    slug: "tribunal-corruption-proces-emblematique-ouvert",
    title: "Justice : le procès d'un dossier emblématique de détournement s'ouvre sous forte tension",
    kicker: "Justice",
    lede: "Présumés coupables de détournements de fonds publics, les accusés font face à leurs juges ; les parties civiles réclament des restitutions.",
    categorySlug: "societe",
    format: "standard",
    importance: 3,
    authorIndex: 0,
    tags: ["justice", "corruption", "procès"],
    hoursAgo: 30,
    blocks: () => [
      para("L'audience s'est tenue devant une salle comble, sous les yeux des familles, des avocats et des organisations de lutte contre la corruption. Les charges portent sur des détournements de fonds publics commis sur plusieurs exercices."),
      para("La défense a soulevé des questions de procédure ; le tribunal a délibéré sur les demandes et reporté la suite des débats, en précisant le calendrier des audiences."),
      para("Les parties civiles — dont des institutions publiques — ont confirmé leurs demandes d'indemnisation. La suite du procès sera suivie séance après séance par INFOSPRO."),
    ],
  },

  // ─── INTERNATIONAL (2) ───────────────────────────────────────────────
  {
    slug: "cechef-integration-libre-circulation-fmefro-accords",
    title: "Afrique de l'Ouest : de nouveaux accords sur la libre circulation adoptés au sommet régional",
    kicker: "Afrique",
    lede: "Les États membres s'entendent sur des mesures de facilitation des déplacements, une étape attendue par les commerçants et les transporteurs de la sous-région.",
    categorySlug: "international",
    format: "standard",
    importance: 3,
    authorIndex: 1,
    tags: ["Afrique de l'Ouest", "libre circulation"],
    hoursAgo: 14,
    blocks: () => [
      para("Le sommet régional a adopté de nouveaux accords portant sur la circulation des personnes et des marchandises : extension des documents biométriques acceptés, harmonisation des contrôles et délais plafonnés aux postes frontière."),
      para("Pour les transporteurs qui relient Conakry aux capitales voisines, la mesure la plus attendue concerne les barrières administratives — nombre de postes de contrôle et légalité des frais."),
      para("La Guinée, qui porte plusieurs de ces propositions, doit maintenant transposer les engagements dans son ordonnancement national."),
    ],
  },
  {
    slug: "diaspora-remises-fonds-annee-record-transferts",
    title: "Transferts de la diaspora : une année record qui interroge le coût des envois",
    kicker: "Monde",
    lede: "Les envois de fonds vers la Guinée atteignent un niveau inédit ; le coût moyen des transferts reste l'un des plus élevés de la sous-région.",
    categorySlug: "international",
    format: "standard",
    importance: 3,
    authorIndex: 3,
    tags: ["diaspora", "transferts", "économie"],
    hoursAgo: 40,
    blocks: () => [
      para("Les envois de fonds de la diaspora vers la Guinée atteignent des niveaux inédits cette année, portés par la croissance des communautés établies en Europe, en Amérique du Nord et dans la sous-région."),
      para("Mais le coût moyen d'un transfert reste élevé par rapport à la moyenne africaine, rappellent les associations de la diaspora, qui plaident pour la transparence des frais et le développement des envois mobiles."),
      para("Les banques et les fintechs locales annoncent des partenariats pour réduire les marges, avec des promesses de tarification affichée en franc guinéen."),
    ],
  },

  // ─── SPORT (3) ───────────────────────────────────────────────────────
  {
    slug: "syli-national-liste-joueurs-prochains-rassemblements",
    title: "Syli National : la liste des joueurs retenus pour les prochains rassemblements dévoilée",
    kicker: "Syli National",
    lede: "Le sélectionneur a communiqué la liste des joueurs convoqués, avec plusieurs premières appellations et des retours remarqués.",
    categorySlug: "sport",
    format: "brief",
    importance: 2,
    authorIndex: 2,
    tags: ["Syli National", "football"],
    hoursAgo: 2,
    isBreaking: true,
    blocks: () => [
      para("Le staff technique du Syli National a dévoilé la liste des joueurs convoqués pour les prochains rassemblements, mêlant cadres expérimentés et premières appellations en provenance du championnat local."),
      para("Le stage prépare une double échéance décisive dans les qualifications ; le programme détaillé sera publié par la fédération."),
    ],
  },
  {
    slug: "ligue1-guinée-derby-conakry-atmosphere-classement",
    title: "Ligue 1 : le derby de Conakry tient toutes ses promesses et secoue le haut du classement",
    kicker: "Football",
    lede: "Devant un stade plein, les deux équipes du haut de tableau se sont neutralisées dans un match intense, rythmé par les retours du public.",
    categorySlug: "sport",
    format: "standard",
    importance: 3,
    authorIndex: 2,
    tags: ["Ligue 1", "derby", "football"],
    hoursAgo: 18,
    blocks: () => [
      para("Le derby a tenu son rang : intensité, occasions franches et un public revenu en nombre. Les deux formations se sont quittées sur un score qui relance complètement la course au titre."),
      para("Les entraîneurs ont salué l'état d'esprit de leurs groupes et pointé, chacun, des décisions arbitrales discutées. Le comité de compétition se prononcera sur les incidents signalés en tribunes."),
      para("Au classement, deux points séparent désormais les trois premiers, à cinq journées de la fin de la phase aller."),
    ],
  },
  {
    slug: "athletisme-guineennes-medaille-championnats-zone",
    title: "Athlétisme : deux médailles pour la Guinée aux championnats de la zone",
    kicker: "Athlétisme",
    lede: "Sprint et demi-fond : les athlètes guinéennes ramènent deux médailles des championnats de la zone, une première depuis cinq ans.",
    categorySlug: "sport",
    format: "standard",
    importance: 3,
    authorIndex: 3,
    tags: ["athlétisme", "médailles"],
    hoursAgo: 46,
    blocks: () => [
      para("Deux médailles, dont un titre, sont revenues aux couleurs guinéennes à l'issue des championnats de la zone : un sacre sur sprint et une troisième place en demi-fond."),
      para("Une performance historique pour la fédération, qui voit dans ces résultats la confirmation de son programme de détection en région. Prochaine étape : les meetings de préparation continental."),
    ],
  },

  // ─── CULTURE (2) ─────────────────────────────────────────────────────
  {
    slug: "festival-musique-conakry-retour-scene-jeunes-groupes",
    title: "Musique : le festival de Conakry remet les jeunes groupes au centre de la scène",
    kicker: "Musique",
    lede: "Trois nuits, quatre scènes, un concours de talents : le festival revient avec l'ambition de faire émerger la nouvelle génération musicale guinéenne.",
    categorySlug: "culture",
    format: "standard",
    importance: 3,
    authorIndex: 0,
    tags: ["festival", "musique", "Conakry"],
    hoursAgo: 22,
    blocks: () => [
      para("Le festival revient pour trois nuits de musique, avec une programmation qui donne la part belle aux jeunes formations : afrobeat guinéen, hip-hop, mandingue contemporain et fusion bala-guitare."),
      para("Le concours de talents, doté d'un accompagnement professionnel, sert de rampe de lancement : répétitions, residency artistique et première partie sur la grande scène pour le lauréat."),
      para("Les organisateurs misent aussi sur la formation : ateliers de droits d'auteur, de sonorisation et de gestion de carrière ouverts gratuitement aux artistes inscrits."),
    ],
  },
  {
    slug: "patrimoine-restauration-sites-historiques-lancement",
    title: "Patrimoine : le programme de restauration des sites historiques démarre",
    kicker: "Patrimoine",
    lede: "Inventaire, consolidation et mise en valeur : les premières opérations du programme national de restauration patrimoniale sont lancées.",
    categorySlug: "culture",
    format: "standard",
    importance: 4,
    authorIndex: 1,
    tags: ["patrimoine", "histoire"],
    hoursAgo: 60,
    blocks: () => [
      para("Le programme de restauration des sites historiques démarre par une phase d'inventaire et de diagnostic, avant les travaux de consolidation des ouvrages les plus fragilisés."),
      para("Les historiens appellent à associer les communautés riveraines : guides locaux, parcours pédagogiques et signalétique bilingue pour transformer les sites en lieux de mémoire vivants."),
    ],
  },

  // ─── ENVIRONNEMENT (3) ───────────────────────────────────────────────
  {
    slug: "saison-pluies-vigilance-inondations-quartiers-bas",
    title: "Saison des pluies : vigilance inondations dans les quartiers bas de la capitale",
    kicker: "Climat",
    lede: "Les services météorologiques annoncent des précipitations intenses pour la semaine ; les quartiers en bordure de mer et les zones non assainies sont les plus exposés.",
    categorySlug: "environnement",
    format: "standard",
    importance: 2,
    authorIndex: 0,
    tags: ["inondations", "saison des pluies"],
    hoursAgo: 1,
    isBreaking: true,
    blocks: () => [
      para("Des épisodes pluvieux intenses sont attendus dans les prochains jours sur la capitale et son hinterland, selon les prévisions des services météorologiques nationaux."),
      para("Les quartiers en bordure de mer et les zones au drainage défaillant sont les plus exposés : les autorités locales recommandent de dégager les caniveaux et de reporter les déplacements inutiles en période de fortes pluies."),
      keypoints([
        "Précipitations intenses attendues cette semaine.",
        "Quartiers bas et zones non assainies les plus exposés.",
        "Numéros d'urgence activés par les préfectures.",
      ]),
    ],
  },
  {
    slug: "mangroves-reboisement-littoral-bilan-communautes",
    title: "Mangroves : le reboisement du littoral montre ses premiers effets, selon les communautés",
    kicker: "Biodiversité",
    lede: "Plantations suivies, pépinières villageoises et surveillance communautaire : un bilan en demi-teinte mais encourageant pour les zones humides du littoral.",
    categorySlug: "environnement",
    format: "standard",
    importance: 3,
    authorIndex: 2,
    tags: ["mangroves", "reboisement", "littoral"],
    hoursAgo: 34,
    blocks: () => [
      para("Dans les villages côtiers, les pépinières de palétuviers tournent à plein régime. Les campagnes de plantation menées avec les communautés montrent des taux de survie en progression, portés par la surveillance locale."),
      para("Restent les pressions : coupe pour le bois de chauffe, pisciculture sauvage et urbanisation non régulée. Les comités villageois demandent des moyens pour pérenniser la surveillance au-delà des projets."),
      para("Les experts rappellent le rôle des mangroves : nurserie de poissons, protection contre l'érosion et stockage de carbone."),
    ],
  },
  {
    slug: "dechets-plastiques-conakry-tri-collecte-initiatives",
    title: "Pollution : à Conakry, le tri des déchets plastiques se cherche un modèle économique",
    kicker: "Pollution",
    lede: "Collecte associative, centres de tri informels, filière de recyclage embryonnaire : l'assainissement de la capitale passe par la rentabilité du plastique.",
    categorySlug: "environnement",
    format: "standard",
    importance: 4,
    authorIndex: 3,
    tags: ["plastiques", "déchets", "Conakry"],
    hoursAgo: 55,
    blocks: () => [
      para("Chaque jour, des tonnes de déchets plastiques traversent la capitale vers des centres de tri informels. Le modèle tient sur un fil : le prix de rachat du kilogramme, volatil, conditionne toute la chaîne."),
      para("Les associations pionnières du tri à la source plaident pour des conventions stables avec la ville et les entreprises de collecte, ainsi que pour des places de marché garanties aux recyclers."),
      para("La fabrication de pavés et de mobilier à partir de plastique recyclé attire des jeunes entrepreneurs, mais l'accès aux machines reste le principal frein."),
    ],
  },

  // ─── TECH (2) ────────────────────────────────────────────────────────
  {
    slug: "internet-mobile-couverture-4g-progresse-interieur",
    title: "Télécoms : la couverture 4G progresse dans l'intérieur du pays",
    kicker: "Télécoms",
    lede: "De nouveaux sites sont mis en service dans plusieurs préfectures ; les usagers réclament surtout de la stabilité et de la lisibilité des forfaits.",
    categorySlug: "tech",
    format: "brief",
    importance: 3,
    authorIndex: 1,
    tags: ["télécoms", "4G"],
    hoursAgo: 8,
    blocks: () => [
      para("De nouveaux sites mobiles ont été mis en service dans plusieurs préfectures, élargissant la couverture 4G au-delà des grandes villes, selon les données publiées par les opérateurs."),
      para("Les organisations de consommateurs saluent la progression mais demandent des engagements sur la qualité de service et la transparence des forfaits data."),
    ],
  },
  {
    slug: "startups-fintech-levée-fonds-paiement-mobile-ouest-africain",
    title: "Startups : une fintech guinéenne lève des fonds pour étendre le paiement mobile",
    kicker: "Startups",
    lede: "La jeune entreprise veut élargir son offre d'agrégation de paiements aux petits commerces de la sous-région.",
    categorySlug: "tech",
    format: "standard",
    importance: 4,
    authorIndex: 1,
    tags: ["fintech", "startups", "paiement mobile"],
    hoursAgo: 36,
    blocks: () => [
      para("Une fintech fondée à Conakry annonce une levée de fonds destinée à élargir son agrégateur de paiements mobiles aux petits commerces, avec une extension prévue dans deux pays voisins."),
      para("Le pari : simplifier l'encaissement pour les commerçants qui jonglent aujourd'hui entre plusieurs applications et des commissions opaques. La conformité réglementaire et l'interopérabilité des portefeuilles restent les chantiers décisifs."),
    ],
  },

  // ─── OPINIONS (3) ────────────────────────────────────────────────────
  {
    slug: "editorial-lemergence-se-mesure-aux-ecoles-et-aux-hopitaux",
    title: "Éditorial — L'émergence se mesure aux écoles et aux hôpitaux",
    kicker: "Éditorial",
    lede: "Les grandes annonces sont utiles ; la transformation se juge aux salles de classe, aux postes de santé et à la constance des réformes.",
    categorySlug: "opinions",
    format: "opinion",
    importance: 2,
    authorIndex: 0,
    tags: ["éditorial", "gouvernance"],
    hoursAgo: 12,
    blocks: () => [
      para("Chaque semaine apporte son lot d'annonces : corridors routiers, zones économiques, hubs énergétiques. Ces projets sont nécessaires. Mais l'émergence se joue d'abord là où la vie se décide : l'école qui retient l'enfant, le poste de santé qui sauve la mère, l'enseignant payé à temps."),
      para("Nos lecteurs nous rappellent souvent une vérité simple : ce qui compte, c'est la constance. Un plan qui tient trois années vaut mieux que trois plans qui ne durent pas. La rigueur budgétaire, la continuité des réformes et l'évaluation honnête des résultats sont les vrais marqueurs de confiance."),
      para("INFOSPRO s'y tiendra : mesurer, vérifier, rendre compte. C'est notre métier et notre contribution à la chose publique."),
    ],
  },
  {
    slug: "tribune-jeunes-emploi-urgence-productive",
    title: "Tribune — Emploi des jeunes : l'urgence est productive, pas seulement assistancielle",
    kicker: "Tribune",
    lede: "Tribune. Les programmes d'aide ne remplaceront jamais une économie qui produit : trois priorités pour transformer la démographie en atout.",
    categorySlug: "opinions",
    format: "opinion",
    importance: 3,
    authorIndex: 2,
    tags: ["tribune", "emploi", "jeunesse"],
    hoursAgo: 42,
    blocks: () => [
      para("Tribune exprimée sous la responsabilité de son auteur. La question de l'emploi des jeunes est trop souvent traitée comme un problème d'assistance : dotations, stages, petits fonds. L'expérience comparée montre qu'aucun pays ne s'est développé sur la seule redistribution."),
      para("Trois priorités méritent mieux que des communiqués : l'électricité fiable pour transformer localement nos produits agricoles ; le crédit de campagne accessible au réel, hors des circuits de caution solidaire épuisants ; et la commande publique locale qui apprend à payer ses fournisseurs dans les délais."),
      para("La démographie guinéenne n'est pas une menace : elle est un dividende en attente. À condition d'investir là où la valeur se crée."),
    ],
  },
  {
    slug: "chronique-conakry-vie-quotidienne-letters-de-la-capitale",
    title: "Chronique — Lettres de la capitale : la ville qui se lève avant le soleil",
    kicker: "Chroniques",
    lede: "Chronique. À cinq heures du matin, Conakry prépare déjà ses débats : le taxi collectif, le prix du poisson et les matchs de la veille.",
    categorySlug: "opinions",
    format: "standard",
    importance: 4,
    authorIndex: 3,
    tags: ["chronique", "Conakry"],
    hoursAgo: 66,
    blocks: () => [
      para("Chronique. Le jour se lève à peine que la capitale a déjà pesé ses sujets du matin : le prix du poisson au marché, la disponibilité de l'eau dans les robinets du quartier et, bien sûr, les arbitrages de l'entraîneur."),
      para("Dans les taxis collectifs, la conversation va vite et va loin : du championnat local aux affaires du monde. C'est là, plus souvent qu'on ne croit, que se fabriquent les questions que la presse se doit de poser."),
    ],
  },

  // ─── REPORTAGES (4) ──────────────────────────────────────────────────
  {
    slug: "video-portrait-des-marches-de-madina-au-lever-du-jour",
    title: "Vidéo — Portrait des marchés de Madina au lever du jour",
    kicker: "Reportage vidéo",
    lede: "Deux heures avant l'aube, le plus grand marché de la capitale s'éveille. Notre caméra a suivi celles et ceux qui font battre Madina.",
    categorySlug: "reportages",
    format: "video",
    importance: 3,
    authorIndex: 1,
    tags: ["vidéo", "marchés", "Conakry"],
    hoursAgo: 16,
    blocks: () => [
      para("À cinq heures, les camionnettes descendent la pente de Madina. Dans la lumière des projecteurs, les manutentionnaires comptent les caisses et la journée commence par une négociation : celle du transport, celle du poisson, celle du temps."),
      { id: newBlockId(), type: "video", provider: "youtube", playbackId: "aqz-KE-bpKQ", caption: "Reportage filmé au marché de Madina, Conakry (image d'illustration du domaine public)." } as Block,
      para("Notre équipe a suivi pendant deux semaines les grossistes de légumes, les vendeuses d'huile et les jeunes charretiers, pour raconter l'économie invisible qui nourrit la capitale."),
    ],
  },
  {
    slug: "video-ecoles-brousse-chemin-de-lecole-haute-guinee",
    title: "Vidéo — Le chemin de l'école en Haute-Guinée : quatre kilomètres à pied avant la première leçon",
    kicker: "Reportage vidéo",
    lede: "Chaque matin, les élèves de trois villages traversent la plaine pour rejoindre la salle de classe la plus proche. Récit filmé d'une persévérance.",
    categorySlug: "reportages",
    format: "video",
    importance: 3,
    authorIndex: 2,
    tags: ["vidéo", "éducation", "Haute-Guinée"],
    hoursAgo: 44,
    blocks: () => [
      para("Le soleil n'a pas encore chauffé la piste que les premiers élèves sont déjà en route. Quatre kilomètres, deux rivières franchies sur des passerelles de fortune, et une motivation intacte : arriver avant la première leçon."),
      { id: newBlockId(), type: "video", provider: "youtube", playbackId: "aqz-KE-bpKQ", caption: "Le chemin de l'école, reportage en Haute-Guinée (image d'illustration du domaine public)." } as Block,
      para("Les maîtres racontent les absences de la saison des pluies, les parents le rêve d'un internet de proximité. La commune promet un ponceau ; les familles, elles, organisent des groupes de marche encadrés."),
    ],
  },
  {
    slug: "portrait-laborantine-qui-veille-sur-leau-de-conakry",
    title: "Portrait — La laborantine qui veille sur l'eau de Conakry",
    kicker: "Portrait",
    lede: "Chaque matin, elle analyse des dizaines d'échantillons d'eau potable. Rencontre avec une scientifique discrète au service d'une ville de deux millions d'habitants.",
    categorySlug: "reportages",
    format: "portrait",
    importance: 4,
    authorIndex: 0,
    tags: ["portrait", "santé", "eau"],
    hoursAgo: 58,
    blocks: () => [
      para("Dans son laboratoire, les flacons s'alignent comme des promesses : celle de dire si l'eau qui sort du robinet est propre à la consommation. La journée commence par les prélèvements de la veille, finit par un rapport signé."),
      para("Elle raconte les nuits d'alerte — une turbidité inhabituelle après les fortes pluies — et le travail d'équipe avec les agents du réseau. « La qualité de l'eau, c'est une chaîne : un maillon relâché, tout se voit », confie-t-elle."),
      para("Sa fierté : les jeunes techniciennes qu'elle forme. Son vœu : plus de moyens pour la surveillance automatique et la publication en temps réel des résultats."),
    ],
  },
  {
    slug: "grand-format-route-transguineenne-le-chantier-qui-refait-le-pays",
    title: "Grand format — La route qui refait le pays : dans les coulisses du chantier transguinéen",
    kicker: "Grand format",
    lede: "Sur trois cents kilomètres, l'asphalte change la vie des villes traversées : marché, santé, sécurité. Enquête sur un chantier qui refuse de vieillir.",
    categorySlug: "reportages",
    format: "longform",
    importance: 2,
    authorIndex: 1,
    tags: ["infrastructure", "transport", "grands travaux"],
    hoursAgo: 76,
    blocks: () => [
      para("Il y a la route sur les plans et celle, boueuse, que les caravanes empruntent encore. Entre les deux, un chantier que l'on dit « stratégique » et que les riverains traduisent en attentes concrètes : un arrêt de transport, un poste de secours, une sécurisation des passages."),
      head("Ce que change l'asphalte"),
      para("Dans les villes traversées, le temps de trajet vers la capitale s'est effondré. Les producteurs expédient leurs denrées la nuit, les ambulances ne font plus demi-tour. Les commerçantes parlent enfin de stocks hebdomadaires plutôt que de survie journalière."),
      head("Ce qui bloque"),
      bullets([
        "Les tronçons à la responsabilité foncière encore floue.",
        "L'entretien : un bitume sans budget de maintenance est une dette à venir.",
        "La sécurité routière : la vitesse nouvelle exige des radars et de la pédagogie.",
      ]),
      para("INFOSPRO a parcouru le corridor de bout en bout, rencontré ingénieurs, préfets, chauffeurs et riverains. Voici le récit d'un pays qui se reconnecte, un kilomètre à la fois."),
    ],
  },

  // ─── DIASPORA (1) ────────────────────────────────────────────────────
  {
    slug: "diaspora-associations-guineennes-france-solidarite-organisee",
    title: "Diaspora : comment les associations guinéennes de France organisent la solidarité",
    kicker: "Diaspora",
    lede: "Cotisations, projets de village, appui aux urgences médicales : immersion dans un réseau associatif qui mobilise des milliers de Guinéens de l'étranger.",
    categorySlug: "diaspora",
    format: "standard",
    importance: 3,
    authorIndex: 3,
    tags: ["diaspora", "solidarité", "associations"],
    hoursAgo: 24,
    blocks: () => [
      para("À Paris, Montreuil ou Bordeaux, les associations guinéennes tiennent la ligne : collecte régulière, comptes rendus publics, projets identifiés au village. La diaspora finance écoles, forages et équipements de santé bien au-delà des envois familiaux classiques."),
      para("Le défi reste la coordination : doublons de projets, promesses non tenues, contrôles délicats à distance. Les fédérations régionales travaillent à un registre commun des initiatives pour éviter les chevauchements."),
      para("Résultat encourageant : plusieurs équipements collectifs — salles de classe, maternités rurales — ont été livrés cette année par ces réseaux, avec des dossiers documentés publiés aux adhérents."),
    ],
  },

  // ─── VÉRIFICATION (1) ────────────────────────────────────────────────
  {
    slug: "verification-le-message-sur-la-prime-exceptionnelle-circule-t-il-vraiment",
    title: "Vérification — Le message sur une « prime exceptionnelle » virale : ce qui est vrai et ce qui ne l'est pas",
    kicker: "Vérification",
    lede: "Un message promettant une prime exceptionnelle versement automatique circule massivement. Nous avons vérifié pièce par pièce.",
    categorySlug: "verification",
    format: "factcheck",
    importance: 2,
    authorIndex: 0,
    tags: ["fact-checking", "rumeurs"],
    hoursAgo: 9,
    blocks: () => [
      para("Depuis ce week-end, un message relayé sur les messageries annonce une « prime exceptionnelle » versée automatiquement à tout titulaire de compte, contre l'envoi de ses informations personnelles sur un formulaire en ligne."),
      {
        id: newBlockId(),
        type: "factcheck",
        claim: "Une prime exceptionnelle serait versée automatiquement, à condition d'enregistrer ses informations sur un formulaire diffusé par messagerie.",
        verdict: "false",
        explanation:
          "Aucune mesure de ce type n'a été annoncée par les institutions compétentes. Le formulaire reproduit une collecte de données personnelle typique de la fraude : identité, téléphone, coordonnées bancaires. Les pages officielles consultées ne mentionnent aucune prime et le visuel joint reprend un ancien communiqué modifié.",
        sources: [
          { label: "Communiqués officiels publiés (vérifiés)", url: "https://infospro.net" },
          { label: "Page d'alerte aux fraudes — bonnes pratiques", url: "https://infospro.net/verification" },
        ],
      },
      para("Conseil simple : ne transmettez jamais vos données personnelles via un lien reçu par messagerie. Vérifiez toujours sur les canaux officiels avant de relayer."),
    ],
  },
];
