/**
 * Dictionnaire FR statique (§03 lib/i18n/).
 * Complète les traductions chargées depuis la table `translations` :
 * toute nouvelle chaîne du front public y est déclarée (repli si la clé
 * n'est pas encore en base). Langue par défaut : `fr`.
 */

export const frDictionary: Record<string, string> = {
  // ─── Lecteur audio flottant ─────────────────────────────────────
  "public.audio.listen": "Écouter",
  "public.audio.play": "Lecture",
  "public.audio.pause": "Pause",
  "public.audio.close": "Fermer le lecteur",
  "public.audio.nowPlaying": "En écoute",

  // ─── Pages vidéos ───────────────────────────────────────────────
  "public.video.pageTitle": "Vidéos",
  "public.video.pageSubtitle": "Reportages, interviews et documentaires de la rédaction et de nos envoyés spéciaux.",
  "public.video.none": "Aucune vidéo disponible pour le moment.",
  "public.video.watch": "Voir la vidéo",
  "public.video.related": "Autres vidéos",
  "public.video.share": "Partager",
  "public.video.shareOk": "Lien copié !",
  "public.video.shareError": "Impossible de copier le lien.",
  "public.video.back": "← Toutes les vidéos",

  // ─── Pages statiques (contact, publicité, newsletter) ──────────
  "public.pages.contact.title": "Contact",
  "public.pages.contact.subtitle": "Écrivez-nous, nous lisons tous les messages.",
  "public.pages.contact.email": "E-mail",
  "public.pages.contact.phone": "Téléphone",
  "public.pages.contact.address": "Adresse",
  "public.pages.contact.addressValue": "Conakry, Guinée",
  "public.pages.contact.formHint": "Le formulaire en ligne arrive prochainement — en attendant, écrivez-nous par e-mail.",

  "public.pages.advertise.title": "Publicité",
  "public.pages.advertise.subtitle": "Diffusez votre message auprès des lecteurs d'INFOSPRO.net",
  "public.pages.advertise.pitch": "INFOSPRO.net est un média numérique guinéen indépendant. Nos formats publicitaires (bannières, natifs, sponsoring météo et newsletters) touchent une audience engageante en Guinée et dans la diaspora.",
  "public.pages.advertise.formats": "Formats disponibles",
  "public.pages.advertise.format1": "Bannières display (leaderboard, billboard, pavés latéraux)",
  "public.pages.advertise.format2": "Articles sponsorisés et contenus natifs",
  "public.pages.advertise.format3": "Sponsoring de la météo et des newsletters",
  "public.pages.advertise.cta": "Contactez notre régie",

  "public.pages.newsletter.title": "Newsletters",
  "public.pages.newsletter.subtitle": "L'essentiel de l'actualité, directement dans votre boîte mail.",

  "public.pages.notFound": "Page introuvable.",
  "public.pages.backHome": "Accueil",

  // ─── Bandeaux du site ───────────────────────────────────────────
  "public.banner.close": "Fermer le bandeau",
};
