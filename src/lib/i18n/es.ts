import type { Dictionary } from "./fr";

/**
 * Dictionnaire ES statique — typé `Dictionary` : TypeScript garantit que
 * toutes les clés du dictionnaire FR sont couvertes.
 */

export const esDictionary: Dictionary = {
  // ─── Común ───────────────────────────────────────────────────────
  "common.close": "Cerrar",
  "common.loading": "Cargando…",

  // ─── Barra superior ──────────────────────────────────────────────
  "public.topbar.edition": "Edición",
  "public.topbar.newsletters": "Newsletters",
  "public.topbar.contact": "Contacto",
  "public.topbar.advertise": "Publicidad",
  "public.topbar.desk": "Redacción",
  "public.topbar.city": "Conakry, Guinea",

  // ─── Cabecera ────────────────────────────────────────────────────
  "public.header.tagline": "La información de Guinea, sin rodeos",
  "public.nav.menu": "Menú principal",

  // ─── Flash informativo ───────────────────────────────────────────
  "public.flash.label": "Flash informativo",
  "public.flash.urgent": "URGENTE",

  // ─── Portada ─────────────────────────────────────────────────────
  "public.une.title": "Portada",
  "public.une.live": "EN DIRECTO",
  "public.une.liveCta": "Seguir el directo",

  // ─── Tarjetas de artículo ────────────────────────────────────────
  "public.card.breaking": "ÚLTIMA HORA",
  "public.card.video": "VÍDEO",
  "public.card.sponsored": "PATROCINADO",
  "public.card.readTime": "min de lectura",

  // ─── Fechas relativas ────────────────────────────────────────────
  "public.time.today": "Hoy",
  "public.time.yesterday": "Ayer",

  // ─── Secciones ───────────────────────────────────────────────────
  "public.section.all": "Ver todo",
  "public.world.title": "Mundo",
  "public.opinion.title": "Opinión",
  "public.opinion.subtitle": "Editoriales, tribunas y columnas",
  "public.dossier.kicker": "DOSSIER",
  "public.list.continuous": "Últimas noticias",
  "public.list.mostRead": "Los más leídos",

  // ─── Reproductor de audio flotante ───────────────────────────────
  "public.audio.listen": "Escuchar",
  "public.audio.play": "Reproducir",
  "public.audio.pause": "Pausa",
  "public.audio.close": "Cerrar el reproductor",
  "public.audio.nowPlaying": "En reproducción",

  // ─── Páginas de vídeo ────────────────────────────────────────────
  "public.video.pageTitle": "Vídeos",
  "public.video.pageSubtitle":
    "Reportajes, entrevistas y documentales de la redacción y de nuestros enviados especiales.",
  "public.video.none": "No hay vídeos disponibles por el momento.",
  "public.video.watch": "Ver el vídeo",
  "public.video.related": "Más vídeos",
  "public.video.share": "Compartir",
  "public.video.shareOk": "¡Enlace copiado!",
  "public.video.shareError": "No se pudo copiar el enlace.",
  "public.video.back": "← Todos los vídeos",
  "public.video.section": "Reportajes en vídeo",
  "public.video.liveTitle": "En directo",
  "public.video.play": "Reproducir vídeo",

  // ─── Podcast / FM ────────────────────────────────────────────────
  "public.podcast.pageTitle": "Podcast / FM",
  "public.podcast.pageSubtitle":
    "Programas, crónicas y grandes entrevistas de la redacción — para escuchar sin interrupción, dondequiera que esté.",
  "public.podcast.stats": "{seasons} temporada(s) · {episodes} episodio(s)",
  "public.podcast.noneTitle": "Aún no hay programas",
  "public.podcast.noneText": "Nuevos episodios llegarán pronto — vuelva pronto para escucharnos.",
  "public.podcast.episode": "Episodio",
  "public.podcast.episodesCount": "{count} episodio(s)",
  "public.podcast.noDuration": "Duración desconocida",
  "public.podcast.nowPlaying": "En reproducción",

  // ─── Artículo ────────────────────────────────────────────────────
  "public.article.breadcrumb": "Ruta de navegación",
  "public.article.unpublished": "No publicado",
  "public.article.staffByline": "Redacción INFOSPRO",
  "public.article.source": "Fuente",
  "public.article.sources": "Fuentes",
  "public.article.correctionNote": "Nota de corrección:",

  // ─── Newsletter ──────────────────────────────────────────────────
  "public.newsletter.kicker": "NEWSLETTER",
  "public.newsletter.morningTitle": "Lo esencial de la mañana",
  "public.newsletter.morningDesc":
    "Cada mañana, reciba en su correo electrónico las noticias más importantes de Guinea y del mundo.",
  "public.newsletter.placeholder": "Su dirección de correo electrónico",
  "public.newsletter.cta": "Suscribirse",
  "public.newsletter.ok": "¡Suscripción realizada! Revise su bandeja de entrada.",
  "public.newsletter.error": "Se ha producido un error. Inténtelo de nuevo.",
  "public.newsletter.loading": "Suscribiendo…",

  // ─── El tiempo ───────────────────────────────────────────────────
  "public.weather.title": "El tiempo",
  "public.weather.humidity": "Humedad",

  // ─── Publicidad ──────────────────────────────────────────────────
  "public.ad.label": "Publicidad",
  "public.ad.cta": "Descubrir",
  "public.ad.weatherSponsor": "Presentado por un socio",
  "public.ad.demoTitle": "Su publicidad aquí",
  "public.ad.demoText": "Contacte con nuestro equipo comercial para reservar este espacio.",
  "public.ad.demoCta": "Contactarnos",
  "admin.nav.adregie": "Gestión publicitaria",
  "admin.nav.podcast": "Podcast / FM",

  // ─── Banners del sitio ───────────────────────────────────────────
  "public.banner.close": "Cerrar el banner",

  // ─── Páginas estáticas ───────────────────────────────────────────
  "public.pages.contact.title": "Contacto",
  "public.pages.contact.subtitle": "Escríbanos: leemos todos los mensajes.",
  "public.pages.contact.email": "Correo electrónico",
  "public.pages.contact.phone": "Teléfono",
  "public.pages.contact.address": "Dirección",
  "public.pages.contact.addressValue": "Conakry, Guinea",
  "public.pages.contact.formHint":
    "El formulario en línea llegará próximamente; mientras tanto, escríbanos por correo electrónico.",

  "public.pages.advertise.title": "Publicidad",
  "public.pages.advertise.subtitle": "Difunda su mensaje entre los lectores de INFOSPRO.net",
  "public.pages.advertise.pitch":
    "INFOSPRO.net es un medio digital guineano independiente. Nuestros formatos publicitarios (banners, contenidos nativos, patrocinio del tiempo y de las newsletters) llegan a una audiencia comprometida en Guinea y en la diáspora.",
  "public.pages.advertise.formats": "Formatos disponibles",
  "public.pages.advertise.format1": "Banners display (leaderboard, billboard, espacios laterales)",
  "public.pages.advertise.format2": "Artículos patrocinados y contenidos nativos",
  "public.pages.advertise.format3": "Patrocinio del tiempo y de las newsletters",
  "public.pages.advertise.cta": "Contacte con nuestro equipo comercial",

  "public.pages.newsletter.title": "Newsletters",
  "public.pages.newsletter.subtitle": "Lo esencial de la actualidad, directamente en su correo.",

  "public.pages.notFound": "Página no encontrada.",
  "public.pages.backHome": "Inicio",

  // ─── Pie de página ───────────────────────────────────────────────
  "public.footer.about":
    "INFOSPRO.net es un medio digital guineano independiente que cubre la actualidad política, económica, social y cultural de Guinea y de África Occidental.",
  "public.footer.rights": "Todos los derechos reservados.",
  "public.footer.madeIn": "Hecho en Conakry con ❤",

  // ─── Selector de idioma ──────────────────────────────────────────
  "public.language.label": "Idioma",
  "public.language.switcher": "Cambiar de idioma",
  // ─── PWA : installation + notifications ────────────────────────
  "public.pwa.installTitle": "Instalar INFOSPRO",
  "public.pwa.installHint": "Acceso rápido desde tu pantalla de inicio.",
  "public.pwa.notificationsHint": "Recibe una alerta por cada nueva publicación.",
  "public.pwa.notificationsOn": "Notificaciones activadas",
  "public.pwa.enableNotifications": "Activar notificaciones",
  "public.pwa.install": "Instalar",
  "public.pwa.close": "Cerrar",

};
