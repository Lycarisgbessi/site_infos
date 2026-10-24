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

  // ─── Páginas de secciones (/rubrique/{slug}) ─────────────────────
  "public.category.kicker": "Sección",
  "public.category.empty": "Todavía no hay artículos publicados en esta sección.",
  "public.category.articlesCount": "{count} artículo(s)",

  // ─── Páginas de dossier (/dossiers/{slug}) ───────────────────────
  "public.dossier.empty": "Todavía no hay artículos publicados en este dossier.",
  "public.dossier.articlesCount": "{count} artículo(s)",

  // ─── Páginas de etiquetas (/tags/{slug}) ─────────────────────────
  "public.tag.kicker": "Etiqueta",
  "public.tag.empty": "Todavía no hay artículos publicados con esta etiqueta.",
  "public.tag.articlesCount": "{count} artículo(s)",

  // ─── Paginación (listas de artículos) ────────────────────────────
  "public.pagination.label": "Paginación",
  "public.pagination.previous": "Anterior",
  "public.pagination.next": "Siguiente",
  "public.pagination.page": "Página {page} de {total}",

  // ─── Navegación (items estáticos del menú principal) ──────────────
  "public.nav.rubriques": "Secciones",
  "public.nav.videos": "Vídeos",
  "public.nav.podcast": "Podcast",
  "public.nav.dossiers": "Especiales",

  // ─── Índice /rubriques ────────────────────────────────────────────
  "public.rubriques.pageTitle": "Secciones",
  "public.rubriques.pageSubtitle":
    "Toda la actualidad de la redacción, organizada por grandes secciones y subsecciones.",
  "public.rubriques.empty": "De momento no hay ninguna sección visible.",
  "public.rubriques.children": "Subsecciones",
  "public.rubriques.articlesCount": "{count} artículo(s)",

  // ─── Índice /tags ─────────────────────────────────────────────────
  "public.tags.pageTitle": "Temas",
  "public.tags.pageSubtitle":
    "Todos los temas y palabras clave tratados por la redacción, por orden alfabético.",
  "public.tags.empty": "De momento ninguna palabra clave usada por un artículo publicado.",
  "public.tags.articlesCount": "{count} artículo(s)",

  // ─── Índice /dossiers ─────────────────────────────────────────────
  "public.dossiers.pageTitle": "Especiales",
  "public.dossiers.pageSubtitle":
    "Investigaciones, análisis y coberturas en profundidad: revive los grandes reportajes de la redacción.",
  "public.dossiers.empty": "De momento no hay ningún especial activo.",
  "public.dossiers.featured": "Destacado",
  "public.dossiers.articlesCount": "{count} artículo(s)",

  // ─── Índice /entites ──────────────────────────────────────────────
  "public.entites.pageTitle": "Entidades",
  "public.entites.pageSubtitle":
    "Personas, organizaciones y lugares citados en nuestros artículos publicados.",
  "public.entites.empty": "De momento ninguna entidad citada en un artículo publicado.",
  "public.entites.articlesCount": "{count} artículo(s)",
  "public.entites.type.person": "Persona",
  "public.entites.type.organization": "Organización",
  "public.entites.type.place": "Lugar",

  // ─── Índice /zones ────────────────────────────────────────────────
  "public.zones.pageTitle": "Zonas geográficas",
  "public.zones.pageSubtitle": "La actualidad por continente, país, región y ciudad.",
  "public.zones.empty": "De momento ninguna zona geográfica vinculada a un artículo publicado.",
  "public.zones.articlesCount": "{count} artículo(s)",
  "public.zones.type.continent": "Continente",
  "public.zones.type.country": "País",
  "public.zones.type.region": "Región",
  "public.zones.type.city": "Ciudad",

  // ─── Pie de página: columnas Explorar y Páginas ───────────────────
  "public.footer.explore": "Explorar",
  "public.footer.pages": "Páginas",

  // ─── Régie pub (glissière) + Interviews ──────────────────────────
  "public.ad.houseTitle": "Su publicidad aquí",
  "public.ad.houseSub": "Carteles, GIF animados, vídeos — vistos por miles de lectores",
  "public.ad.houseCta": "Reservar este espacio",
  "public.interviews.kicker": "Entrevistas",
  "public.interviews.title": "Entrevistas",
  "public.interviews.subtitle": "Nos hablaron — retratos, encuentros y grandes entrevistas, de la más reciente a la más antigua.",
  "public.interviews.watch": "Ver",
  "public.interviews.listen": "Escuchar",
  "public.interviews.read": "Leer",
  "public.interviews.prev": "Entrevista anterior",
  "public.interviews.next": "Entrevista siguiente",

};
