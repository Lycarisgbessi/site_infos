import type { Dictionary } from "./fr";

/**
 * Dictionnaire ZH statique — typé `Dictionary` : TypeScript garantit que
 * toutes les clés du dictionnaire FR sont couvertes.
 */

export const zhDictionary: Dictionary = {
  // ─── 通用 ────────────────────────────────────────────────────────
  "common.close": "关闭",
  "common.loading": "加载中…",

  // ─── 顶部栏 ──────────────────────────────────────────────────────
  "public.topbar.edition": "版",
  "public.topbar.newsletters": "电子报",
  "public.topbar.contact": "联系我们",
  "public.topbar.advertise": "广告",
  "public.topbar.desk": "编辑部",
  "public.topbar.city": "几内亚科纳克里",

  // ─── 页眉 ────────────────────────────────────────────────────────
  "public.header.tagline": "几内亚资讯，直击要点",
  "public.nav.menu": "主导航",

  // ─── 快讯 ────────────────────────────────────────────────────────
  "public.flash.label": "快讯",
  "public.flash.urgent": "紧急",

  // ─── 头条 ────────────────────────────────────────────────────────
  "public.une.title": "头条",
  "public.une.live": "直播中",
  "public.une.liveCta": "关注直播",

  // ─── 文章卡片 ────────────────────────────────────────────────────
  "public.card.breaking": "突发",
  "public.card.video": "视频",
  "public.card.sponsored": "赞助内容",
  "public.card.readTime": "分钟阅读",

  // ─── 相对日期 ────────────────────────────────────────────────────
  "public.time.today": "今天",
  "public.time.yesterday": "昨天",

  // ─── 栏目 ────────────────────────────────────────────────────────
  "public.section.all": "查看全部",
  "public.world.title": "国际",
  "public.opinion.title": "观点",
  "public.opinion.subtitle": "社论、评论与时评专栏",
  "public.dossier.kicker": "专题",
  "public.list.continuous": "滚动新闻",
  "public.list.mostRead": "阅读排行",

  // ─── 浮动音频播放器 ──────────────────────────────────────────────
  "public.audio.listen": "收听",
  "public.audio.play": "播放",
  "public.audio.pause": "暂停",
  "public.audio.close": "关闭播放器",
  "public.audio.nowPlaying": "正在播放",

  // ─── 视频页面 ────────────────────────────────────────────────────
  "public.video.pageTitle": "视频",
  "public.video.pageSubtitle": "来自编辑部和特派记者的报道、专访与纪录片。",
  "public.video.none": "暂无可用视频。",
  "public.video.watch": "观看视频",
  "public.video.related": "更多视频",
  "public.video.share": "分享",
  "public.video.shareOk": "链接已复制！",
  "public.video.shareError": "无法复制链接。",
  "public.video.back": "← 所有视频",
  "public.video.section": "视频报道",
  "public.video.liveTitle": "直播",
  "public.video.play": "播放视频",

  // ─── Podcast / FM ────────────────────────────────────────────────
  "public.podcast.pageTitle": "播客 / 电台",
  "public.podcast.pageSubtitle": "编辑部出品的节目、评论与深度访谈——随时随地，连续收听。",
  "public.podcast.stats": "{seasons} 季 · {episodes} 集",
  "public.podcast.noneTitle": "暂无节目",
  "public.podcast.noneText": "新剧集即将上线——欢迎常来回听。",
  "public.podcast.episode": "集",
  "public.podcast.episodesCount": "{count} 集",
  "public.podcast.noDuration": "时长未知",
  "public.podcast.nowPlaying": "正在播放",

  // ─── 文章 ────────────────────────────────────────────────────────
  "public.article.breadcrumb": "面包屑导航",
  "public.article.unpublished": "未发布",
  "public.article.staffByline": "INFOSPRO 编辑部",
  "public.article.source": "来源",
  "public.article.sources": "来源",
  "public.article.correctionNote": "更正说明：",

  // ─── 电子报 ──────────────────────────────────────────────────────
  "public.newsletter.kicker": "电子报",
  "public.newsletter.morningTitle": "每日要闻",
  "public.newsletter.morningDesc": "每天早上，将几内亚和全球的重要新闻直接发送到您的邮箱。",
  "public.newsletter.placeholder": "您的电子邮箱",
  "public.newsletter.cta": "订阅",
  "public.newsletter.ok": "订阅成功！请查收邮件。",
  "public.newsletter.error": "出现错误，请重试。",
  "public.newsletter.loading": "正在订阅…",

  // ─── 天气 ────────────────────────────────────────────────────────
  "public.weather.title": "天气",
  "public.weather.humidity": "湿度",

  // ─── 广告位 ──────────────────────────────────────────────────────
  "public.ad.label": "广告",
  "public.ad.cta": "了解更多",
  "public.ad.weatherSponsor": "由合作伙伴呈现",
  "public.ad.demoTitle": "此处展示您的广告",
  "public.ad.demoText": "请联系我们的广告部预订此广告位。",
  "public.ad.demoCta": "联系我们",
  "admin.nav.adregie": "广告管理",
  "admin.nav.podcast": "播客 / 电台",

  // ─── 网站横幅 ────────────────────────────────────────────────────
  "public.banner.close": "关闭横幅",

  // ─── 静态页面 ────────────────────────────────────────────────────
  "public.pages.contact.title": "联系我们",
  "public.pages.contact.subtitle": "给我们写信，我们阅读每一封来信。",
  "public.pages.contact.email": "电子邮箱",
  "public.pages.contact.phone": "电话",
  "public.pages.contact.address": "地址",
  "public.pages.contact.addressValue": "几内亚科纳克里",
  "public.pages.contact.formHint": "在线表单即将上线——在此之前，请通过电子邮件与我们联系。",

  "public.pages.advertise.title": "广告合作",
  "public.pages.advertise.subtitle": "在 INFOSPRO.net 的读者面前展示您的信息",
  "public.pages.advertise.pitch":
    "INFOSPRO.net 是一家独立的几内亚数字媒体。我们的广告形式（横幅、原生内容、天气栏目与电子报赞助）可触达几内亚本地及海外侨民的高度互动受众。",
  "public.pages.advertise.formats": "可用广告形式",
  "public.pages.advertise.format1": "展示横幅（通栏、大幅看板、侧边广告位）",
  "public.pages.advertise.format2": "赞助文章与原生内容",
  "public.pages.advertise.format3": "天气栏目与电子报赞助",
  "public.pages.advertise.cta": "联系我们的广告部",

  "public.pages.newsletter.title": "电子报",
  "public.pages.newsletter.subtitle": "新闻要点，直达您的邮箱。",

  "public.pages.notFound": "页面未找到。",
  "public.pages.backHome": "首页",

  // ─── 页脚 ────────────────────────────────────────────────────────
  "public.footer.about":
    "INFOSPRO.net 是一家独立的几内亚数字媒体，报道几内亚及西非的政治、经济、社会与文化新闻。",
  "public.footer.rights": "版权所有。",
  "public.footer.madeIn": "在科纳克里用 ❤ 制作",

  // ─── 语言切换器 ──────────────────────────────────────────────────
  "public.language.label": "语言",
  "public.language.switcher": "切换语言",
  // ─── PWA : installation + notifications ────────────────────────
  "public.pwa.installTitle": "安装 INFOSPRO",
  "public.pwa.installHint": "从主屏幕快速访问。",
  "public.pwa.notificationsHint": "每次新发布都会收到提醒。",
  "public.pwa.notificationsOn": "通知已启用",
  "public.pwa.enableNotifications": "启用通知",
  "public.pwa.install": "安装",
  "public.pwa.close": "关闭",

  // ─── 栏目页面（/rubrique/{slug}）────────────────────────────────
  "public.category.kicker": "栏目",
  "public.category.empty": "该栏目暂无已发布的文章。",
  "public.category.articlesCount": "{count} 篇文章",

  // ─── 专题页面（/dossiers/{slug}）───────────────────────────────
  "public.dossier.empty": "该专题暂无已发布的文章。",
  "public.dossier.articlesCount": "{count} 篇文章",

  // ─── 标签页面（/tags/{slug}）───────────────────────────────────
  "public.tag.kicker": "标签",
  "public.tag.empty": "该标签下暂无已发布的文章。",
  "public.tag.articlesCount": "{count} 篇文章",

  // ─── 分页（文章列表）──────────────────────────────────────────
  "public.pagination.label": "分页",
  "public.pagination.previous": "上一页",
  "public.pagination.next": "下一页",
  "public.pagination.page": "第 {page} 页，共 {total} 页",

  // ─── 导航（主菜单静态项）───────────────────────────────────────
  "public.nav.rubriques": "栏目",
  "public.nav.videos": "视频",
  "public.nav.podcast": "播客",
  "public.nav.dossiers": "专题",

  // ─── /rubriques 索引页 ────────────────────────────────────────────
  "public.rubriques.pageTitle": "栏目",
  "public.rubriques.pageSubtitle": "编辑部全部新闻，按主要栏目与子栏目分类。",
  "public.rubriques.empty": "暂无可见栏目。",
  "public.rubriques.children": "子栏目",
  "public.rubriques.articlesCount": "{count} 篇文章",

  // ─── /tags 索引页 ─────────────────────────────────────────────────
  "public.tags.pageTitle": "关键词",
  "public.tags.pageSubtitle": "编辑部报道的所有主题与关键词，按字母顺序排列。",
  "public.tags.empty": "暂无已用于发布文章的关键词。",
  "public.tags.articlesCount": "{count} 篇文章",

  // ─── /dossiers 索引页 ─────────────────────────────────────────────
  "public.dossiers.pageTitle": "专题报道",
  "public.dossiers.pageSubtitle": "调查、深度解析与纵深报道：重温编辑部的重大专题。",
  "public.dossiers.empty": "暂无进行中的专题。",
  "public.dossiers.featured": "精选",
  "public.dossiers.articlesCount": "{count} 篇文章",

  // ─── /entites 索引页 ──────────────────────────────────────────────
  "public.entites.pageTitle": "人物与机构",
  "public.entites.pageSubtitle": "已发布文章中提及的人物、机构和地点。",
  "public.entites.empty": "暂无文章提及的实体。",
  "public.entites.articlesCount": "{count} 篇文章",
  "public.entites.type.person": "人物",
  "public.entites.type.organization": "机构",
  "public.entites.type.place": "地点",

  // ─── /zones 索引页 ────────────────────────────────────────────────
  "public.zones.pageTitle": "地理区域",
  "public.zones.pageSubtitle": "按大洲、国家、地区和城市浏览新闻。",
  "public.zones.empty": "暂无与发布文章关联的地理区域。",
  "public.zones.articlesCount": "{count} 篇文章",
  "public.zones.type.continent": "大洲",
  "public.zones.type.country": "国家",
  "public.zones.type.region": "地区",
  "public.zones.type.city": "城市",

  // ─── 页脚：探索与页面栏目 ─────────────────────────────────────────
  "public.footer.explore": "探索",
  "public.footer.pages": "页面",

};
