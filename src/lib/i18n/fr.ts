/**
 * Dictionnaire FR statique (§03 lib/i18n/).
 * Base des dictionnaires statiques multilingues (fr, en, es, ar, zh) :
 * toute nouvelle chaîne du front public y est déclarée (repli si la clé
 * n'est pas en base). Langue par défaut : `fr`.
 *
 * CONTRAT : les autres dictionnaires (en, es, ar, zh) sont typés
 * `Dictionary` (= typeof frDictionary) — l'exhaustivité des clés est
 * garantie par TypeScript strict.
 */

export const frDictionary = {
  // ─── Commun ──────────────────────────────────────────────────────
  "common.close": "Fermer",
  "common.loading": "Chargement…",

  // ─── Bandeau utilitaire (TopBar) ────────────────────────────────
  "public.topbar.edition": "Édition",
  "public.topbar.newsletters": "Newsletters",
  "public.topbar.contact": "Contact",
  "public.topbar.advertise": "Publicité",
  "public.topbar.desk": "Rédaction",
  "public.topbar.city": "Conakry, Guinée",

  // ─── En-tête ─────────────────────────────────────────────────────
  "public.header.tagline": "L'information de Guinée, sans détour",
  "public.nav.menu": "Menu principal",

  // ─── Flash info ──────────────────────────────────────────────────
  "public.flash.label": "Flash Info",
  "public.flash.urgent": "URGENT",

  // ─── À la une ────────────────────────────────────────────────────
  "public.une.title": "À la une",
  "public.une.live": "EN DIRECT",
  "public.une.liveCta": "Suivre le direct",

  // ─── Cartes article ──────────────────────────────────────────────
  "public.card.breaking": "ALERTE",
  "public.card.video": "VIDÉO",
  "public.card.sponsored": "SPONSORISÉ",
  "public.card.readTime": "min de lecture",

  // ─── Dates relatives ─────────────────────────────────────────────
  "public.time.today": "Aujourd'hui",
  "public.time.yesterday": "Hier",

  // ─── Sections ────────────────────────────────────────────────────
  "public.section.all": "Tout voir",
  "public.world.title": "Monde",
  "public.opinion.title": "Opinions",
  "public.opinion.subtitle": "Éditoriaux, tribunes et chroniques",
  "public.dossier.kicker": "DOSSIER",
  "public.list.continuous": "En continu",
  "public.list.mostRead": "Les plus lus",

  // ─── Lecteur audio flottant ──────────────────────────────────────
  "public.audio.listen": "Écouter",
  "public.audio.play": "Lecture",
  "public.audio.pause": "Pause",
  "public.audio.close": "Fermer le lecteur",
  "public.audio.nowPlaying": "En écoute",


  // ─── PWA : installation + notifications ────────────────────────
  "public.pwa.installTitle": "Installer INFOSPRO",
  "public.pwa.installHint": "Accès rapide depuis votre écran d'accueil.",
  "public.pwa.notificationsHint": "Recevez une alerte à chaque nouvelle publication.",
  "public.pwa.notificationsOn": "Notifications activées",
  "public.pwa.enableNotifications": "Activer les notifications",
  "public.pwa.install": "Installer",
  "public.pwa.close": "Fermer",

  // ─── Pages vidéos ────────────────────────────────────────────────
  "public.video.pageTitle": "Vidéos",
  "public.video.pageSubtitle":
    "Reportages, interviews et documentaires de la rédaction et de nos envoyés spéciaux.",
  "public.video.none": "Aucune vidéo disponible pour le moment.",
  "public.video.watch": "Voir la vidéo",
  "public.video.related": "Autres vidéos",
  "public.video.share": "Partager",
  "public.video.shareOk": "Lien copié !",
  "public.video.shareError": "Impossible de copier le lien.",
  "public.video.back": "← Toutes les vidéos",
  "public.video.section": "Reportages vidéo",
  "public.video.liveTitle": "En direct",
  "public.video.play": "Lire la vidéo",

  // ─── Podcast / FM ────────────────────────────────────────────────
  "public.podcast.pageTitle": "Podcast / FM",
  "public.podcast.pageSubtitle":
    "Émissions, chroniques et grands entretiens de la rédaction — à écouter en continu, où que vous soyez.",
  "public.podcast.stats": "{seasons} saison(s) · {episodes} épisode(s)",
  "public.podcast.noneTitle": "Aucune émission pour le moment",
  "public.podcast.noneText": "De nouveaux épisodes arrivent bientôt — revenez vite nous écouter.",
  "public.podcast.episode": "Épisode",
  "public.podcast.episodesCount": "{count} épisode(s)",
  "public.podcast.noDuration": "Durée inconnue",
  "public.podcast.nowPlaying": "En cours de lecture",

  // ─── Article ─────────────────────────────────────────────────────
  "public.article.breadcrumb": "Fil d'Ariane",
  "public.article.unpublished": "Non publié",
  "public.article.staffByline": "Rédaction INFOSPRO",
  "public.article.source": "Source",
  "public.article.sources": "Sources",
  "public.article.correctionNote": "Note de correction :",

  // ─── Newsletter ──────────────────────────────────────────────────
  "public.newsletter.kicker": "NEWSLETTER",
  "public.newsletter.morningTitle": "L'essentiel du matin",
  "public.newsletter.morningDesc":
    "Chaque matin, recevez les informations importantes de Guinée et du monde directement dans votre boîte mail.",
  "public.newsletter.placeholder": "Votre adresse e-mail",
  "public.newsletter.cta": "S'inscrire",
  "public.newsletter.ok": "Inscription réussie ! Vérifiez votre boîte mail.",
  "public.newsletter.error": "Une erreur est survenue. Veuillez réessayer.",
  "public.newsletter.loading": "Inscription en cours…",

  // ─── Météo ───────────────────────────────────────────────────────
  "public.weather.title": "Météo",
  "public.weather.humidity": "Humidité",

  // ─── Régie publicitaire ──────────────────────────────────────────
  "public.ad.label": "Publicité",
  "public.ad.cta": "Découvrir",
  "public.ad.weatherSponsor": "Présenté par un partenaire",
  "public.ad.demoTitle": "Votre publicité ici",
  "public.ad.demoText": "Contactez notre régie pour réserver cet emplacement.",
  "public.ad.demoCta": "Nous contacter",
  "admin.nav.adregie": "Régie publicitaire",
  "admin.nav.podcast": "Podcast / FM",

  // ─── Bandeaux du site ────────────────────────────────────────────
  "public.banner.close": "Fermer le bandeau",

  // ─── Pages statiques (contact, publicité, newsletter) ────────────
  "public.pages.contact.title": "Contact",
  "public.pages.contact.subtitle": "Écrivez-nous, nous lisons tous les messages.",
  "public.pages.contact.email": "E-mail",
  "public.pages.contact.phone": "Téléphone",
  "public.pages.contact.address": "Adresse",
  "public.pages.contact.addressValue": "Conakry, Guinée",
  "public.pages.contact.formHint":
    "Le formulaire en ligne arrive prochainement — en attendant, écrivez-nous par e-mail.",

  "public.pages.advertise.title": "Publicité",
  "public.pages.advertise.subtitle": "Diffusez votre message auprès des lecteurs d'INFOSPRO.net",
  "public.pages.advertise.pitch":
    "INFOSPRO.net est un média numérique guinéen indépendant. Nos formats publicitaires (bannières, natifs, sponsoring météo et newsletters) touchent une audience engageante en Guinée et dans la diaspora.",
  "public.pages.advertise.formats": "Formats disponibles",
  "public.pages.advertise.format1": "Bannières display (leaderboard, billboard, pavés latéraux)",
  "public.pages.advertise.format2": "Articles sponsorisés et contenus natifs",
  "public.pages.advertise.format3": "Sponsoring de la météo et des newsletters",
  "public.pages.advertise.cta": "Contactez notre régie",

  "public.pages.newsletter.title": "Newsletters",
  "public.pages.newsletter.subtitle": "L'essentiel de l'actualité, directement dans votre boîte mail.",

  "public.pages.notFound": "Page introuvable.",
  "public.pages.backHome": "Accueil",

  // ─── Pied de page ────────────────────────────────────────────────
  "public.footer.about":
    "INFOSPRO.net est un média numérique guinéen indépendant couvrant l'actualité politique, économique, sociale et culturelle de la Guinée et de l'Afrique de l'Ouest.",
  "public.footer.rights": "Tous droits réservés.",
  "public.footer.madeIn": "Fait à Conakry avec ❤",

  // ─── Sélecteur de langue ─────────────────────────────────────────
  "public.language.label": "Langue",
  "public.language.switcher": "Changer de langue",

  // ─── Pages rubriques (/rubrique/{slug}) ───────────────────────────
  "public.category.kicker": "Rubrique",
  "public.category.empty": "Aucun article publié dans cette rubrique pour le moment.",
  "public.category.articlesCount": "{count} article(s) publié(s)",

  // ─── Pages dossiers (/dossiers/{slug}) ────────────────────────────
  "public.dossier.empty": "Aucun article publié dans ce dossier pour le moment.",
  "public.dossier.articlesCount": "{count} article(s) publié(s)",

  // ─── Pages tags (/tags/{slug}) ────────────────────────────────────
  "public.tag.kicker": "Mot-clé",
  "public.tag.empty": "Aucun article publié avec ce mot-clé pour le moment.",
  "public.tag.articlesCount": "{count} article(s) publié(s)",

  // ─── Pagination (listes d'articles) ───────────────────────────────
  "public.pagination.label": "Pagination",
  "public.pagination.previous": "Précédent",
  "public.pagination.next": "Suivant",
  "public.pagination.page": "Page {page} sur {total}",

  // ─── Navigation (items statiques du menu principal) ───────────────
  "public.nav.rubriques": "Rubriques",
  "public.nav.videos": "Vidéos",
  "public.nav.podcast": "Podcast",
  "public.nav.dossiers": "Dossiers",

  // ─── Index /rubriques ─────────────────────────────────────────────
  "public.rubriques.pageTitle": "Rubriques",
  "public.rubriques.pageSubtitle":
    "Toute l'actualité de la rédaction, classée par grandes rubriques et sous-rubriques.",
  "public.rubriques.empty": "Aucune rubrique visible pour le moment.",
  "public.rubriques.children": "Sous-rubriques",
  "public.rubriques.articlesCount": "{count} article(s)",

  // ─── Index /tags ──────────────────────────────────────────────────
  "public.tags.pageTitle": "Mots-clés",
  "public.tags.pageSubtitle":
    "Tous les sujets et mots-clés suivis par la rédaction, par ordre alphabétique.",
  "public.tags.empty": "Aucun mot-clé utilisé par un article publié pour le moment.",
  "public.tags.articlesCount": "{count} article(s)",

  // ─── Index /dossiers ──────────────────────────────────────────────
  "public.dossiers.pageTitle": "Dossiers",
  "public.dossiers.pageSubtitle":
    "Enquêtes, décryptages et couvertures de fond : revivez les grands dossiers de la rédaction.",
  "public.dossiers.empty": "Aucun dossier actif pour le moment.",
  "public.dossiers.featured": "À la une",
  "public.dossiers.articlesCount": "{count} article(s)",

  // ─── Index /entites ───────────────────────────────────────────────
  "public.entites.pageTitle": "Entités",
  "public.entites.pageSubtitle":
    "Personnalités, organisations et lieux cités dans nos articles publiés.",
  "public.entites.empty": "Aucune entité citée par un article publié pour le moment.",
  "public.entites.articlesCount": "{count} article(s)",
  "public.entites.type.person": "Personnalité",
  "public.entites.type.organization": "Organisation",
  "public.entites.type.place": "Lieu",

  // ─── Index /zones ─────────────────────────────────────────────────
  "public.zones.pageTitle": "Zones géographiques",
  "public.zones.pageSubtitle": "L'actualité par continent, pays, région et ville.",
  "public.zones.empty": "Aucune zone géographique rattachée à un article publié pour le moment.",
  "public.zones.articlesCount": "{count} article(s)",
  "public.zones.type.continent": "Continent",
  "public.zones.type.country": "Pays",
  "public.zones.type.region": "Région",
  "public.zones.type.city": "Ville",

  // ─── Pied de page : colonnes Explorer et Pages ────────────────────
  "public.footer.explore": "Explorer",
  "public.footer.pages": "Pages",
  // ─── Régie pub (glissière) + Interviews ──────────────────────────
  "public.ad.houseTitle": "Votre publicité ici",
  "public.ad.houseSub": "Affiches, GIF animés, vidéos — vue par des milliers de lecteurs",
  "public.ad.houseCta": "Réserver cet espace",
  "public.ad.house2Title": "Des milliers de lecteurs chaque jour",
  "public.ad.house2Sub": "Communiquez là où la Guinée s'informe",
  "public.ad.house2Cta": "Nous contacter",
  "public.ad.house3Title": "Affiches animées · GIF · Vidéo",
  "public.ad.house3Sub": "Votre campagne en ligne en quelques heures",
  "public.ad.house3Cta": "Lancer ma campagne",
  "public.interviews.kicker": "Interviews",
  "public.interviews.title": "Interviews",
  "public.interviews.subtitle": "Ils nous ont parlé — portraits, rencontres et grands entretiens, du plus récent au plus ancien.",
  "public.interviews.watch": "Voir",
  "public.interviews.listen": "Écouter",
  "public.interviews.read": "Lire",
  "public.interviews.prev": "Interview précédente",
  "public.interviews.next": "Interview suivante",

} as const satisfies Record<string, string>;

/** Contrat d'exhaustivité : chaque dictionnaire doit couvrir TOUTES les clés FR. */
export type Dictionary = {
  -readonly [K in keyof typeof frDictionary]: string;
};
