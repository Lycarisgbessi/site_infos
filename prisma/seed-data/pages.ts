/**
 * Pages statiques (§21.5) — contenu français réel, éditable en back-office.
 * Corps au format blocs (§06.4). Les champs juridiques vides (éditeur,
 * directeur de publication) sont volontairement des emplacements de
 * settings signalés en rouge (§24-8), jamais inventés.
 */

import type { Block } from "../../src/types/blocks";
import { newBlockId } from "../../src/lib/blocks";

export interface PageSeed {
  slug: string;
  title: string;
  template: "default" | "contact" | "about" | "advertising" | "legal";
  seoTitle: string;
  metaDescription: string;
  blocks: () => Block[];
}

function p(text: string): Block {
  return { id: newBlockId(), type: "paragraph", text: [{ text }] };
}

function h2(text: string): Block {
  return { id: newBlockId(), type: "heading", level: 2, text };
}

function list(items: string[]): Block {
  return {
    id: newBlockId(),
    type: "list",
    style: "bullet",
    items: items.map((item) => [{ text: item }]),
  };
}

export const PAGES: PageSeed[] = [
  {
    slug: "a-propos",
    title: "À propos d'INFOSPRO",
    template: "about",
    seoTitle: "À propos d'INFOSPRO — Qui sommes-nous",
    metaDescription:
      "INFOSPRO est un média numérique généraliste produit depuis Conakry : mission, équipe et principes éditoriaux.",
    blocks: () => [
      p("INFOSPRO est un média numérique généraliste, national et international, produit depuis Conakry. Notre rédaction couvre la Guinée — politique, économie, mines, société, sport, culture — ainsi que l'Afrique et le monde, en français."),
      p("Notre mission : informer avec rigueur, indépendance et honnêteté une audience majoritairement mobile, en Guinée comme au sein de la diaspora. Nous appliquons une charte éditoriale stricte, corrigeons nos erreurs publiquement et distinguons toujours l'information, l'analyse et la communication commerciale."),
      h2("Nos principes"),
      list([
        "Indépendance éditoriale : aucune publicité ne détermine nos choix journalistiques.",
        "Exactitude : chaque information est vérifiée et sourcée ; les corrections sont visibles.",
        "Transparence : nos financements publicitaires sont déclarés, les contenus sponsorisés sont explicitement étiquetés.",
        "Protection des sources : notre formulaire d'alerte info permet un envoi anonyme et ne journalise pas les adresses IP.",
      ]),
      h2("L'équipe"),
      p("La rédaction réunit journalistes, chefs de rubrique, correcteurs et photojournalistes. La liste de l'équipe et les contacts directs figurent sur la page de chaque auteur."),
    ],
  },
  {
    slug: "contact",
    title: "Contact",
    template: "contact",
    seoTitle: "Contact — INFOSPRO",
    metaDescription:
      "Contactez la rédaction d'INFOSPRO : alerte info, droit de réponse, publicité, corrections et service lecteurs.",
    blocks: () => [
      p("Pour joindre INFOSPRO, choisissez le service adapté à votre demande. Chaque message reçoit un accusé de réception."),
      h2("Services"),
      list([
        "Rédaction : informations, précisions et suggestions de sujets.",
        "Alerte info : témoignage ou document sensible, avec option d'anonymat total — l'adresse IP n'est pas journalisée et la page n'embarque aucun traceur.",
        "Droit de réponse : toute personne mise en cause peut exercer son droit de réponse selon la procédure dédiée.",
        "Corrections : signalez une erreur dans un article publié.",
        "Publicité : plans tarifaires et formats disponibles sur la page Publicité.",
      ]),
      h2("Coordonnées"),
      p("Les coordonnées complètes (adresses, téléphones, e-mails par service et horaires) sont publiées ici par la rédaction et maintenues à jour depuis le back-office."),
    ],
  },
  {
    slug: "publicite",
    title: "Publicité",
    template: "advertising",
    seoTitle: "Publicité sur INFOSPRO — Formats et contacts",
    metaDescription:
      "19 emplacements publicitaires : habillage, leaderboard, in-read, natif, vidéo pré-roll, sponsoring de rubrique et de newsletter.",
    blocks: () => [
      p("INFOSPRO propose 19 emplacements publicitaires distincts, du leaderboard d'en-tête au sponsoring de newsletter, en passant par l'in-read dans le texte, le natif dans le fil et le pré-roll vidéo."),
      h2("Nos formats"),
      list([
        "Habillage de page (skin) en exclusivité journée.",
        "Leaderboards et billboards (970×250, 728×90, mobile 320×100).",
        "Pavés latéraux 300×250 et 300×600, dont format collant en lecture d'article.",
        "In-read natif responsive après le 3ᵉ et le 7ᵉ paragraphe.",
        "Cartes natives au gabarit éditorial, signalées « Publicité ».",
        "Pré-roll vidéo 6–15 s skippable, sponsoring de rubrique, sponsoring de newsletter.",
      ]),
      h2("Nos engagements"),
      p("Aucun format sonore en lecture automatique, aucun interstitiel avant le premier contenu, aucune publicité dans les articles sponsorisés, poids plafonnés et espaces réservés pour garantir la stabilité de la page. La grille tarifaire est communiquée sur demande par le service régie."),
    ],
  },
  {
    slug: "charte-editoriale",
    title: "Charte éditoriale",
    template: "default",
    seoTitle: "Charte éditoriale — INFOSPRO",
    metaDescription:
      "Indépendance, vérification, sources, corrections, discrimination zéro : les règles déontologiques de la rédaction d'INFOSPRO.",
    blocks: () => [
      p("La présente charte engage chaque membre de la rédaction d'INFOSPRO. Elle définit nos règles d'indépendance, de vérification, de traitement des sources et des corrections."),
      h2("Indépendance"),
      p("La rédaction exerce sa mission sans pression politique, commerciale ou financière. Les contenus sponsorisés sont produits selon des règles distinctes, signalés explicitement et exclus du flux classé éditorial. Aucun annonceur ne reçoit de droit de regard sur les contenus."),
      h2("Vérification et sources"),
      p("Toute information est vérifiée avant publication auprès de sources fiables et croisées lorsque cela est possible. Les sources anonymes sont acceptées uniquement lorsque l'information est d'intérêt public et qu'aucune autre voie n'existe ; leur anonymat est alors protégé, y compris juridiquement, et validé par la hiérarchie de la rédaction."),
      h2("Corrections"),
      p("Une erreur avérée est corrigée rapidement et visiblement : une note de correction encadrée figure en tête de l'article concerné, avec la nature de la faute et la date de correction. La politique de corrections complète est publiée sur une page dédiée."),
      h2("Dignité et non-discrimination"),
      p("La rédaction refuse toute forme de discrimination, de harcèlement ou d'atteinte à la dignité dans ses contenus. Les images de violences sont utilisées avec la plus grande retenue et toujours justifiées par l'intérêt d'informer."),
      h2("Intégrité des journalistes"),
      p("Les journalistes n'acceptent ni cadeau ni avantage susceptibles d'influencer leur travail, ne participent pas à des campagnes publicitaires de sujets qu'ils couvrent, et déclarent tout conflit d'intérêts à leur hiérarchie."),
    ],
  },
  {
    slug: "politique-de-corrections",
    title: "Politique de corrections",
    template: "default",
    seoTitle: "Politique de corrections — INFOSPRO",
    metaDescription:
      "Comment INFOSPRO corrige ses erreurs : détection, délai, signalisation visible et traçabilité des corrections.",
    blocks: () => [
      p("Corriger vite et visiblement est un devoir de la presse de référence. Toute erreur factuelle avérée dans un article publié fait l'objet d'une correction selon les règles ci-dessous."),
      h2("Signalement"),
      p("Toute personne peut signaler une erreur depuis la page de l'article concerné, par le formulaire de contact (onglet « Corrections ») ou par e-mail à la rédaction. Le signalement précise l'article, le passage concerné et, si possible, la source exacte."),
      h2("Traitement"),
      p("La rédaction examine chaque signalement dans un délai de 24 heures ouvrées. Si l'erreur est avérée, la correction est publiée au plus vite ; si elle est contestée, la rédaction explique sa position ou la façon dont le sujet sera complété."),
      h2("Forme de la correction"),
      list([
        "Erreur mineure (typographie, date, chiffre) : correction silencieuse, horodatée dans l'historique interne.",
        "Erreur substantielle (fait, citation, attribution) : note de correction encadrée en tête d'article, décrivant ce qui a été corrigé et quand.",
        "Article gravement erroné : retrait avec note explicative et, le cas échéant, procédure de droit de réponse.",
      ]),
      h2("Traçabilité"),
      p("Chaque correction est journalisée avec son auteur et son horodatage, et l'article indique la date de dernière mise à jour éditoriale en plus de la date de publication."),
    ],
  },
  {
    slug: "droit-de-reponse",
    title: "Droit de réponse",
    template: "legal",
    seoTitle: "Droit de réponse — INFOSPRO",
    metaDescription:
      "Procédure de droit de réponse d'INFOSPRO : délai, forme, publication et modalités d'exercice.",
    blocks: () => [
      p("Toute personne ou organisation mise en cause dans un contenu publié par INFOSPRO peut exercer un droit de réponse selon les modalités suivantes."),
      h2("Exercice"),
      p("La demande est adressée à la rédaction via le formulaire de contact (onglet « Droit de réponse ») ou par e-mail. Elle identifie précisément le contenu concerné et indique le nom, la qualité et les coordonnées du demandeur ou de son mandataire."),
      h2("Traitement et publication"),
      p("La rédaction accuse réception sans délai et publie, lorsque la demande est recevable, une réponse proportionnée dans les meilleurs délais, au plus tard dans les conditions prévues par la réglementation applicable. La réponse est rattachée au contenu mis en cause et signalée visiblement sur celui-ci."),
      h2("Refus et recours"),
      p("En cas de refus motivé (réponse injurieuse, diffamatoire, hors de proportion ou étrangère au contenu), le demandeur est informé des motifs et des voies de recours existantes."),
    ],
  },
  {
    slug: "mentions-legales",
    title: "Mentions légales",
    template: "legal",
    seoTitle: "Mentions légales — INFOSPRO",
    metaDescription:
      "Éditeur, directeur de publication, hébergeur et enregistrement : mentions légales du site INFOSPRO.NET.",
    blocks: () => [
      p("Les informations ci-dessous identifient l'éditeur du site INFOSPRO.NET conformément à la réglementation applicable. Les champs encore vides sont complétés par la publication dès enregistrement définitif."),
      h2("Éditeur"),
      p("Éditeur : renseigné dans les paramètres légaux du site. Directeur de publication : renseigné dans les paramètres légaux du site."),
      h2("Hébergement"),
      p("Le site est hébergé par un fournisseur d'infrastructure cloud dont les coordonnées complètes sont publiées dans les paramètres légaux dès mise en production."),
      h2("Enregistrement"),
      p("Numéro d'enregistrement auprès de l'autorité de régulation : renseigné dans les paramètres légaux du site."),
      h2("Propriété intellectuelle"),
      p("L'ensemble des contenus (textes, photographies, vidéos, graphismes, données) est protégé par le droit d'auteur. Toute reproduction, même partielle, sans autorisation écrite préalable est interdite, sous réserve des exceptions légales et des courtes citations avec lien."),
    ],
  },
  {
    slug: "confidentialite",
    title: "Politique de confidentialité",
    template: "legal",
    seoTitle: "Politique de confidentialité — INFOSPRO",
    metaDescription:
      "Données collectées, finalités, durées de conservation, droits des personnes et contacts : politique de confidentialité d'INFOSPRO.",
    blocks: () => [
      p("INFOSPRO attache une importance essentielle à la protection de vos données personnelles. Cette politique décrit les données que nous traitons, pourquoi, combien de temps, et comment exercer vos droits, conformément au RGPD pour nos lecteurs en Europe et à la législation guinéenne applicable."),
      h2("Données collectées et finalités"),
      list([
        "Newsletter : adresse e-mail et préférences — envoi des lettres d'information, après double opt-in explicite.",
        "Comptes de rédaction : identité professionnelle, coordonnées et historique d'actions — gestion de la publication.",
        "Mesure d'audience : statistiques agrégées et anonymisées (aucun traceur non essentiel avant consentement).",
        "Formulaires : message et coordonnées de contact — traitement de votre demande.",
        "Alerte info : contenu envoyé uniquement ; l'adresse IP n'est pas journalisée et aucun traceur ne fonctionne sur cette page.",
      ]),
      h2("Sécurité et minimisation"),
      p("Les adresses IP ne sont jamais stockées en clair : elles sont hachées avec sel et ne servent qu'à la sécurité (verrouillage de compte, anti-abus). Les accès et actions sensibles de la rédaction sont journalisés pendant 12 mois."),
      h2("Durées de conservation"),
      list([
        "Abonnés newsletter : suppression des inactifs après 12 mois, après campagne de réengagement.",
        "Données d'audience brutes : 25 mois maximum.",
        "Journal d'audit : 12 mois.",
        "Messages de contact : durée du traitement de la demande, puis purge.",
      ]),
      h2("Vos droits"),
      p("Accès, rectification, effacement, limitation, opposition et portabilité : vous pouvez les exercer depuis le formulaire de contact ou auprès du point de contact désigné pour la protection des données. Vous pouvez aussi saisir l'autorité de contrôle compétente."),
    ],
  },
  {
    slug: "cookies",
    title: "Gestion des cookies",
    template: "legal",
    seoTitle: "Cookies — INFOSPRO",
    metaDescription:
      "Cookies essentiels et consentement : granularité par finalité, refus aussi simple que l'acceptation, révocation à tout moment.",
    blocks: () => [
      p("INFOSPRO n'utilise que des cookies et traceurs strictement nécessaires au fonctionnement du site, tant que vous n'avez pas consenti à d'autres finalités."),
      h2("Catégories"),
      list([
        "Essentiels : session de connexion à l'espace rédaction, sécurité, préférences d'affichage (thème, mode données réduites). Aucun consentement requis.",
        "Mesure d'audience : statistiques de fréquentation — soumis à votre consentement.",
        "Publicité : personnalisation et mesure des campagnes — soumis à votre consentement.",
      ]),
      h2("Consentement et révocation"),
      p("Le bandeau de consentement propose un refus aussi simple que l'acceptation et une granularité par finalité. Votre choix, accepté ou refusé, est horodaté et révocable à tout moment depuis cette page ou le lien « Gérer les cookies » du pied de page."),
    ],
  },
  {
    slug: "cgu",
    title: "Conditions générales d'utilisation",
    template: "legal",
    seoTitle: "CGU — INFOSPRO",
    metaDescription:
      "Conditions d'accès et d'utilisation du site INFOSPRO.NET : contenus, comptes de rédaction, responsabilité et droit applicable.",
    blocks: () => [
      p("Les présentes conditions régissent l'accès au site INFOSPRO.NET et son utilisation. En naviguant sur le site, vous les acceptez."),
      h2("Accès et usage"),
      p("Le site est accessible gratuitement, sans restriction géographique. La consultation des contenus n'exige pas de compte ; l'espace rédaction est réservé au personnel autorisé, avec authentification forte et journalisation."),
      h2("Commentaires et contributions"),
      p("Les commentaires sont soumis à modération a priori. Sont supprimés les contenus injurieux, diffamatoires, haineux, illégaux ou hors sujet. Leurs auteurs restent responsables de leurs propos ; une réponse officielle de la rédaction est identifiée visuellement."),
      h2("Propriété intellectuelle"),
      p("Les contenus d'INFOSPRO sont protégés par le droit d'auteur. Toute réutilisation au-delà des exceptions légales et de la pratique de la courte citation avec lien requiert une autorisation écrite."),
      h2("Responsabilité"),
      p("INFOSPRO s'efforce d'assurer l'exactitude et la disponibilité des contenus, sans garantie d'absence d'erreur ou d'interruption. Les liens externes renvoient vers des sources dont nous ne maîtrisons pas le contenu."),
      h2("Droit applicable"),
      p("Les présentes conditions sont soumises au droit guinéen. Tout litige relève des juridictions compétentes de Conakry, sous réserve des droits impératifs offerts aux consommateurs résidant dans l'Union européenne."),
    ],
  },
  {
    slug: "recrutement",
    title: "Recrutement",
    template: "default",
    seoTitle: "Rejoindre la rédaction — Recrutement INFOSPRO",
    metaDescription:
      "Offres d'emploi et de stage à la rédaction d'INFOSPRO : journalistes, chefs de rubrique, photojournalistes, régie et technique.",
    blocks: () => [
      p("INFOSPRO recrute en permanence des talents du journalisme : reporters et reporters d'actualité, chefs de rubrique politique et économie, photojournalistes, correcteurs, ainsi que des profils régie publicitaire et technique web."),
      h2("Candidatures spontanées"),
      p("Adressez votre candidature (lettre, CV, trois références de travaux pour les postes éditoriaux) via le formulaire de contact, onglet « Recrutement ». Chaque candidature reçoit un accusé de réception."),
      h2("Nos engagements"),
      list([
        "Égalité de traitement entre candidats, sans discrimination d'origine, de genre, de religion ou d'opinion.",
        "Rémunération claire et conformité au droit du travail guinéen.",
        "Formation continue : déontologie, vérification d'informations, sécurité des journalistes et protection des sources.",
      ]),
    ],
  },
  {
    slug: "plan-du-site",
    title: "Plan du site",
    template: "default",
    seoTitle: "Plan du site — INFOSPRO",
    metaDescription:
      "Navigation complète d'INFOSPRO.NET : rubriques, services, archives et pages légales.",
    blocks: () => [
      p("Le plan du site complet (rubriques, sous-rubriques, pages et services) est généré automatiquement à partir du référentiel éditorial. Cette page de présentation sera enrichie à la mise en ligne du front-office (PHASE 4) ; un plan HTML complet et un plan XML pour les moteurs de recherche sont prévus au socle SEO."),
    ],
  },
];
