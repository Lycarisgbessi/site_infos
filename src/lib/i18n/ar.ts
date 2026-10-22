import type { Dictionary } from "./fr";

/**
 * Dictionnaire AR statique (RTL) — typé `Dictionary` : TypeScript
 * garantit que toutes les clés du dictionnaire FR sont couvertes.
 */

export const arDictionary: Dictionary = {
  // ─── عام ─────────────────────────────────────────────────────────
  "common.close": "إغلاق",
  "common.loading": "جارٍ التحميل…",

  // ─── الشريط العلوي ───────────────────────────────────────────────
  "public.topbar.edition": "النسخة",
  "public.topbar.newsletters": "النشرات البريدية",
  "public.topbar.contact": "اتصل بنا",
  "public.topbar.advertise": "الإعلانات",
  "public.topbar.desk": "غرفة التحرير",
  "public.topbar.city": "كوناكري، غينيا",

  // ─── الترويسة ────────────────────────────────────────────────────
  "public.header.tagline": "أخبار غينيا بلا مواربة",
  "public.nav.menu": "القائمة الرئيسية",

  // ─── موجز إخباري ─────────────────────────────────────────────────
  "public.flash.label": "موجز إخباري",
  "public.flash.urgent": "عاجل",

  // ─── الصفحة الرئيسية ─────────────────────────────────────────────
  "public.une.title": "الرئيسية",
  "public.une.live": "مباشر",
  "public.une.liveCta": "تابع البث المباشر",

  // ─── بطاقات المقالات ─────────────────────────────────────────────
  "public.card.breaking": "عاجل",
  "public.card.video": "فيديو",
  "public.card.sponsored": "برعاية",
  "public.card.readTime": "دقيقة قراءة",

  // ─── تواريخ نسبية ────────────────────────────────────────────────
  "public.time.today": "اليوم",
  "public.time.yesterday": "أمس",

  // ─── الأقسام ─────────────────────────────────────────────────────
  "public.section.all": "عرض الكل",
  "public.world.title": "العالم",
  "public.opinion.title": "آراء",
  "public.opinion.subtitle": "افتتاحيات ومقالات رأي وأعمدة صحفية",
  "public.dossier.kicker": "ملف خاص",
  "public.list.continuous": "آخر المستجدات",
  "public.list.mostRead": "الأكثر قراءة",

  // ─── مشغّل الصوت العائم ──────────────────────────────────────────
  "public.audio.listen": "استمع",
  "public.audio.play": "تشغيل",
  "public.audio.pause": "إيقاف مؤقت",
  "public.audio.close": "إغلاق المشغّل",
  "public.audio.nowPlaying": "قيد التشغيل",

  // ─── صفحات الفيديو ───────────────────────────────────────────────
  "public.video.pageTitle": "فيديوهات",
  "public.video.pageSubtitle": "تقارير وحوارات وأفلام وثائقية من غرفة التحرير ومراسلينا الخاصين.",
  "public.video.none": "لا توجد فيديوهات متاحة حاليًا.",
  "public.video.watch": "شاهد الفيديو",
  "public.video.related": "فيديوهات أخرى",
  "public.video.share": "مشاركة",
  "public.video.shareOk": "تم نسخ الرابط!",
  "public.video.shareError": "تعذّر نسخ الرابط.",
  "public.video.back": "→ جميع الفيديوهات",
  "public.video.section": "تقارير مصوّرة",
  "public.video.liveTitle": "بث مباشر",
  "public.video.play": "تشغيل الفيديو",

  // ─── Podcast / FM ────────────────────────────────────────────────
  "public.podcast.pageTitle": "بودكاست / إف إم",
  "public.podcast.pageSubtitle":
    "برامج وأعمدة وحوارات موسعة من غرفة التحرير — استمع إليها دون انقطاع، أينما كنت.",
  "public.podcast.stats": "{seasons} موسم · {episodes} حلقة",
  "public.podcast.noneTitle": "لا توجد برامج حاليًا",
  "public.podcast.noneText": "حلقات جديدة قادمة قريبًا — عد قريبًا للاستماع إلينا.",
  "public.podcast.episode": "حلقة",
  "public.podcast.episodesCount": "{count} حلقة",
  "public.podcast.noDuration": "مدة غير معروفة",
  "public.podcast.nowPlaying": "قيد التشغيل",

  // ─── المقال ──────────────────────────────────────────────────────
  "public.article.breadcrumb": "مسار التصفح",
  "public.article.unpublished": "غير منشور",
  "public.article.staffByline": "غرفة تحرير INFOSPRO",
  "public.article.source": "المصدر",
  "public.article.sources": "المصادر",
  "public.article.correctionNote": "تنويه تصحيح:",

  // ─── النشرة البريدية ─────────────────────────────────────────────
  "public.newsletter.kicker": "نشرة بريدية",
  "public.newsletter.morningTitle": "أهم أخبار الصباح",
  "public.newsletter.morningDesc":
    "كل صباح، تصلك أهم أخبار غينيا والعالم مباشرة إلى بريدك الإلكتروني.",
  "public.newsletter.placeholder": "بريدك الإلكتروني",
  "public.newsletter.cta": "اشترك",
  "public.newsletter.ok": "تم الاشتراك بنجاح! يرجى التحقق من بريدك الإلكتروني.",
  "public.newsletter.error": "حدث خطأ. يرجى المحاولة مرة أخرى.",
  "public.newsletter.loading": "جارٍ الاشتراك…",

  // ─── الطقس ───────────────────────────────────────────────────────
  "public.weather.title": "الطقس",
  "public.weather.humidity": "الرطوبة",

  // ─── الإعلانات ───────────────────────────────────────────────────
  "public.ad.label": "إعلان",
  "public.ad.cta": "اكتشف المزيد",
  "public.ad.weatherSponsor": "مقدَّم من شريك",
  "public.ad.demoTitle": "مساحتك الإعلانية هنا",
  "public.ad.demoText": "تواصل مع قسم الإعلانات لدينا لحجز هذه المساحة.",
  "public.ad.demoCta": "اتصل بنا",
  "admin.nav.adregie": "إدارة الإعلانات",
  "admin.nav.podcast": "بودكاست / إذاعة",

  // ─── شرائط الموقع ────────────────────────────────────────────────
  "public.banner.close": "إغلاق الشريط",

  // ─── الصفحات الثابتة ─────────────────────────────────────────────
  "public.pages.contact.title": "اتصل بنا",
  "public.pages.contact.subtitle": "راسلنا، نقرأ كل الرسائل.",
  "public.pages.contact.email": "البريد الإلكتروني",
  "public.pages.contact.phone": "الهاتف",
  "public.pages.contact.address": "العنوان",
  "public.pages.contact.addressValue": "كوناكري، غينيا",
  "public.pages.contact.formHint":
    "سيصبح النموذج الإلكتروني متاحًا قريبًا — إلى ذلك الحين، راسلنا عبر البريد الإلكتروني.",

  "public.pages.advertise.title": "الإعلانات",
  "public.pages.advertise.subtitle": "اعرض رسالتك أمام قرّاء INFOSPRO.net",
  "public.pages.advertise.pitch":
    "INFOSPRO.net منصة إخبارية رقمية غينية مستقلة. تصل صيغنا الإعلانية (اللافتات، المحتوى المدعوم، رعاية الطقس والنشرات البريدية) إلى جمهور تفاعلي في غينيا وفي المهجر.",
  "public.pages.advertise.formats": "الصيغ المتاحة",
  "public.pages.advertise.format1": "لافتات إعلانية (لوحة عنوان، لوحة كبيرة، مساحات جانبية)",
  "public.pages.advertise.format2": "مقالات مدعومة ومحتوى أصلي",
  "public.pages.advertise.format3": "رعاية قسم الطقس والنشرات البريدية",
  "public.pages.advertise.cta": "تواصل مع قسم الإعلانات",

  "public.pages.newsletter.title": "النشرة البريدية",
  "public.pages.newsletter.subtitle": "خلاصة الأخبار مباشرة إلى بريدك الإلكتروني.",

  "public.pages.notFound": "الصفحة غير موجودة.",
  "public.pages.backHome": "الصفحة الرئيسية",

  // ─── تذييل الصفحة ────────────────────────────────────────────────
  "public.footer.about":
    "INFOSPRO.net منصة إخبارية رقمية غينية مستقلة تغطي الأحداث السياسية والاقتصادية والاجتماعية والثقافية في غينيا وغرب أفريقيا.",
  "public.footer.rights": "جميع الحقوق محفوظة.",
  "public.footer.madeIn": "صُنع في كوناكري بكل حب ❤",

  // ─── مبدّل اللغة ─────────────────────────────────────────────────
  "public.language.label": "اللغة",
  "public.language.switcher": "تغيير اللغة",
  // ─── PWA : installation + notifications ────────────────────────
  "public.pwa.installTitle": "تثبيت INFOSPRO",
  "public.pwa.installHint": "وصول سريع من شاشتك الرئيسية.",
  "public.pwa.notificationsHint": "تلقَّ تنبيهاً عند كل نشرة جديدة.",
  "public.pwa.notificationsOn": "الإشعارات مفعّلة",
  "public.pwa.enableNotifications": "تفعيل الإشعارات",
  "public.pwa.install": "تثبيت",
  "public.pwa.close": "إغلاق",

  // ─── صفحات الأقسام (/rubrique/{slug}) ───────────────────────────
  "public.category.kicker": "قسم",
  "public.category.empty": "لا توجد مقالات منشورة في هذا القسم حالياً.",
  "public.category.articlesCount": "{count} مقال(ات)",

  // ─── صفحات الملفات الخاصة (/dossiers/{slug}) ────────────────────
  "public.dossier.empty": "لا توجد مقالات منشورة في هذا الملف حالياً.",
  "public.dossier.articlesCount": "{count} مقال(ات)",

  // ─── صفحات الوسوم (/tags/{slug}) ────────────────────────────────
  "public.tag.kicker": "وسم",
  "public.tag.empty": "لا توجد مقالات منشورة بهذا الوسم حالياً.",
  "public.tag.articlesCount": "{count} مقال(ات)",

  // ─── تصفّح الصفحات (قوائم المقالات) ─────────────────────────────
  "public.pagination.label": "تصفّح الصفحات",
  "public.pagination.previous": "السابق",
  "public.pagination.next": "التالي",
  "public.pagination.page": "صفحة {page} من {total}",

  // ─── التنقل (عناصر ثابتة في القائمة الرئيسية) ────────────────────
  "public.nav.rubriques": "الأقسام",
  "public.nav.videos": "فيديو",
  "public.nav.podcast": "بودكاست",
  "public.nav.dossiers": "ملفات",

  // ─── فهرس /rubriques ──────────────────────────────────────────────
  "public.rubriques.pageTitle": "الأقسام",
  "public.rubriques.pageSubtitle":
    "كل أخبار التحرية، مرتبة حسب الأقسام الرئيسية والأقسام الفرعية.",
  "public.rubriques.empty": "لا توجد أقسام ظاهرة حالياً.",
  "public.rubriques.children": "أقسام فرعية",
  "public.rubriques.articlesCount": "{count} مقال(ات)",

  // ─── فهرس /tags ───────────────────────────────────────────────────
  "public.tags.pageTitle": "الكلمات المفتاحية",
  "public.tags.pageSubtitle":
    "كل المواضيع والكلمات المفتاحية التي تغطيها التحرية، بترتيب أبجدي.",
  "public.tags.empty": "لا توجد كلمة مفتاحية مستخدمة في مقال منشور حالياً.",
  "public.tags.articlesCount": "{count} مقال(ات)",

  // ─── فهرس /dossiers ───────────────────────────────────────────────
  "public.dossiers.pageTitle": "الملفات",
  "public.dossiers.pageSubtitle":
    "تحقيقات وتحليلات وتغطيات معمّقة: استعرض أبرز ملفات التحرية.",
  "public.dossiers.empty": "لا يوجد ملف نشط حالياً.",
  "public.dossiers.featured": "مميّز",
  "public.dossiers.articlesCount": "{count} مقال(ات)",

  // ─── فهرس /entites ────────────────────────────────────────────────
  "public.entites.pageTitle": "الكيانات",
  "public.entites.pageSubtitle":
    "أشخاص ومنظمات وأماكن ورد ذكرها في مقالاتنا المنشورة.",
  "public.entites.empty": "لا توجد كيانات مذكورة في مقال منشور حالياً.",
  "public.entites.articlesCount": "{count} مقال(ات)",
  "public.entites.type.person": "شخص",
  "public.entites.type.organization": "منظمة",
  "public.entites.type.place": "مكان",

  // ─── فهرس /zones ──────────────────────────────────────────────────
  "public.zones.pageTitle": "المناطق الجغرافية",
  "public.zones.pageSubtitle": "الأخبار حسب القارة والبلد والمنطقة والمدينة.",
  "public.zones.empty": "لا توجد منطقة جغرافية مرتبطة بمقال منشور حالياً.",
  "public.zones.articlesCount": "{count} مقال(ات)",
  "public.zones.type.continent": "قارة",
  "public.zones.type.country": "بلد",
  "public.zones.type.region": "منطقة",
  "public.zones.type.city": "مدينة",

  // ─── تذييل الصفحة: عمودا استكشاف والصفحات ─────────────────────────
  "public.footer.explore": "استكشف",
  "public.footer.pages": "الصفحات",

};
