/**
 * Seed INFOSPRO.NET (§21, §20 Phase 1 tâche 9).
 *
 * Référentiel : rôles (§08.2), comptes, rubriques (§21.1), zones géo
 * (§21.2), villes météo (§21.3), menus (§21.4), zoning accueil (§09.1),
 * 19 emplacements pub (§13.1), listes newsletter (§14.1), réglages
 * (§11.2), textes d'interface (translations), pages statiques (§21.5).
 * Démonstration (§21.6, supprimable via db:seed:clean) : 30 articles,
 * 10 flashs, 3 dossiers, 1 live blog, 1 campagne pub test (5 emplacements),
 * 50 abonnés, couvertures SVG générées dans public/media-demo/.
 *
 * Exécution : bun run db:seed
 * Les mots de passe temporaires sont affichés UNE SEULE FOIS.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { hashPassword, secureToken } from "../src/lib/auth/password";
import { deriveBodyMetadata } from "../src/lib/blocks";
import { stringifyJsonArray, stringifyJsonObject } from "../src/lib/json";
import { ROLE_SEEDS, rolePermissionMatrix } from "./seed-data/roles";
import { CATEGORIES } from "./seed-data/categories";
import { GEO_ZONES, WEATHER_CITIES } from "./seed-data/geo";
import { MENUS, HOMEPAGE_BLOCKS } from "./seed-data/menus";
import { AD_SLOTS, NEWSLETTER_LISTS } from "./seed-data/ads-newsletters";
import { SETTINGS, TRANSLATIONS } from "./seed-data/settings";
import { PAGES } from "./seed-data/pages";
import { DEMO_ARTICLES } from "./seed-data/demo-articles";

const db = new PrismaClient();

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEMO_MEDIA_DIR = join(ROOT, "public", "media-demo");

// ─── Comptes (§08.3 : mot de passe provisoire, changement à la première
// utilisation recommandé ; 2FA activée à la première connexion) ─────────

interface AccountSeed {
  email: string;
  displayName: string;
  slug: string;
  jobTitle: string;
  roleKey: string;
  bio: string;
  expertise: string[];
}

const ACCOUNTS: AccountSeed[] = [
  {
    email: "admin@infospro.net",
    displayName: "Administrateur INFOSPRO",
    slug: "admin-infospro",
    jobTitle: "Administration du site",
    roleKey: "admin",
    bio: "Compte d'administration du back-office INFOSPRO.",
    expertise: ["gestion", "administration"],
  },
  {
    email: "redacteur.en.chef@infospro.net",
    displayName: "Fatoumata Camara",
    slug: "fatoumata-camara",
    jobTitle: "Rédactrice en chef",
    roleKey: "chief_editor",
    bio: "Quinze ans de presse en Guinée et dans la sous-région. Anime la conférence de rédaction et coordonne la une.",
    expertise: ["politique", "gouvernance", "sous-région"],
  },
  {
    email: "journaliste@infospro.net",
    displayName: "Ibrahima Sory Diallo",
    slug: "ibrahima-sory-diallo",
    jobTitle: "Journaliste — Économie & Mines",
    roleKey: "journalist",
    bio: "Spécialiste des filières bauxite et anacarde, basé entre Conakry et Boké.",
    expertise: ["mines", "économie", "agriculture"],
  },
  {
    email: "regie@infospro.net",
    displayName: "Mariama Bah",
    slug: "mariama-bah",
    jobTitle: "Responsable régie publicitaire",
    roleKey: "ad_manager",
    bio: "Régie et partenariats commerciaux d'INFOSPRO.",
    expertise: ["régie", "marketing"],
  },
];

// ─── Couvertures SVG générées (médias réels, fichiers réels) ───────────

const COVER_PALETTES: { bg: string; accent: string; label: string }[] = [
  { bg: "#14110F", accent: "#C8102E", label: "Conakry" },
  { bg: "#C8102E", accent: "#FFFFFF", label: "Guinée" },
  { bg: "#F6F5F3", accent: "#14110F", label: "Reportage" },
  { bg: "#8F0B20", accent: "#FFFFFF", label: "Économie" },
  { bg: "#1F1C1A", accent: "#E31B37", label: "Mines" },
  { bg: "#FFFFFF", accent: "#C8102E", label: "Sport" },
  { bg: "#ECEBE8", accent: "#8F0B20", label: "Culture" },
  { bg: "#0E0D0C", accent: "#FF3B57", label: "Afrique" },
];

function coverSvg(index: number, title: string): string {
  const palette = COVER_PALETTES[index % COVER_PALETTES.length];
  const safeTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <rect width="1600" height="900" fill="${palette.bg}"/>
  <rect x="0" y="0" width="1600" height="8" fill="${palette.accent}"/>
  <circle cx="1320" cy="640" r="260" fill="${palette.accent}" opacity="0.16"/>
  <circle cx="1320" cy="640" r="150" fill="${palette.accent}" opacity="0.22"/>
  <text x="96" y="200" font-family="Georgia, serif" font-size="64" font-weight="700" fill="${palette.accent}">INFOSPRO</text>
  <rect x="96" y="236" width="120" height="6" fill="${palette.accent}"/>
  <text x="96" y="760" font-family="Georgia, serif" font-size="46" fill="${palette.bg === "#FFFFFF" || palette.bg === "#F6F5F3" || palette.bg === "#ECEBE8" ? "#14110F" : "#FFFFFF"}">${safeTitle}</text>
  <text x="96" y="812" font-family="Arial, sans-serif" font-size="26" letter-spacing="6" fill="${palette.accent}">${palette.label.toUpperCase()}</text>
</svg>`;
}

const DEMO_COVER_SLOTS = [
  "politique",
  "economie",
  "mines",
  "societe",
  "sport",
  "culture",
  "environnement",
  "tech",
  "international",
  "reportage",
] as const;

/** Real cover photos from Unsplash (free, no API key) keyed by category slug + variant (1-4). */
const UNSPLASH_COVERS: Record<string, string[]> = {
  politique: [
    "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1575320181282-9afab399332c?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1606761568499-6d2451b23c66?w=1600&h=900&fit=crop&q=80",
  ],
  economie: [
    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1579532537598-459ecdaf39cc?w=1600&h=900&fit=crop&q=80",
  ],
  mines: [
    "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1513828583688-c52646db42da?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1518709766631-a6a7f45921c3?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1581093458791-9d42cc87a068?w=1600&h=900&fit=crop&q=80",
  ],
  societe: [
    "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1600&h=900&fit=crop&q=80",
  ],
  sport: [
    "https://images.unsplash.com/photo-1461896836934-bd45ea8a726c?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1600&h=900&fit=crop&q=80",
  ],
  culture: [
    "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1499364615650-ec38552f4f34?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1600&h=900&fit=crop&q=80",
  ],
  environnement: [
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=1600&h=900&fit=crop&q=80",
  ],
  tech: [
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1600&h=900&fit=crop&q=80",
  ],
  international: [
    "https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=1600&h=900&fit=crop&q=80",
  ],
  reportage: [
    "https://images.unsplash.com/photo-1504711434969-e33886168d6c?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=1600&h=900&fit=crop&q=80",
    "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1600&h=900&fit=crop&q=80",
  ],
};

function unsplashCoverUrl(categorySlug: string, variant: number): string {
  const urls = UNSPLASH_COVERS[categorySlug] ?? UNSPLASH_COVERS["reportage"]!;
  return urls[(variant - 1) % urls.length];
}

function coverSlug(categorySlug: string, index: number): string {
  const slot = (DEMO_COVER_SLOTS as readonly string[]).includes(categorySlug)
    ? categorySlug
    : "reportage";
  return `cover-${slot}-${(index % 4) + 1}.svg`;
}

// ─── Helpers ───────────────────────────────────────────────────────────

function hoursAgoDate(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

async function main(): Promise<void> {
  console.log("── Seed INFOSPRO — démarrage ───────────────────────────────");

  // 1. Rôles système (§08.2)
  const matrix = rolePermissionMatrix();
  for (const role of ROLE_SEEDS) {
    await db.role.upsert({
      where: { key: role.key },
      create: {
        key: role.key,
        label: role.label,
        description: role.description,
        is_system: role.isSystem,
        permissions: stringifyJsonArray(matrix.get(role.key) ?? []),
      },
      update: {
        label: role.label,
        description: role.description,
        is_system: role.isSystem,
        permissions: stringifyJsonArray(matrix.get(role.key) ?? []),
      },
    });
  }
  const roles = await db.role.findMany();
  console.log(`✓ ${roles.length} rôles système`);

  // 2. Comptes (admin + 3 comptes de test de rôles différents — critère P1)
  const credentials: { email: string; password: string; role: string }[] = [];
  for (const account of ACCOUNTS) {
    const password = "Infospro_2026!";
    const passwordHash = await hashPassword(password);
    const user = await db.user.upsert({
      where: { email: account.email },
      create: {
        email: account.email,
        password_hash: passwordHash,
        display_name: account.displayName,
        slug: account.slug,
        job_title: account.jobTitle,
        bio: account.bio,
        expertise: stringifyJsonArray(account.expertise),
        socials: stringifyJsonArray([]),
        status: "active",
        locale: "fr",
      },
      update: {
        password_hash: passwordHash,
        display_name: account.displayName,
        job_title: account.jobTitle,
        bio: account.bio,
        expertise: stringifyJsonArray(account.expertise),
      },
    });
    const role = roles.find((r) => r.key === account.roleKey);
    if (role) {
      await db.userRole.upsert({
        where: { user_id_role_id: { user_id: user.id, role_id: role.id } },
        create: { user_id: user.id, role_id: role.id },
        update: {},
      });
    }
    if (password) {
      credentials.push({ email: account.email, password: password as string, role: account.roleKey });
    }
  }
  console.log(`✓ ${ACCOUNTS.length} comptes utilisateurs (admin + 3 rôles de test)`);

  // 3. Rubriques (§21.1)
  for (const cat of CATEGORIES) {
    const existingCat = await db.category.findFirst({
      where: { parent_id: null, slug: cat.slug },
    });
    const parent = existingCat
      ? await db.category.update({
          where: { id: existingCat.id },
          data: {
            name: cat.name,
            short_name: cat.shortName ?? null,
            description: cat.description,
            position: cat.position,
          },
        })
      : await db.category.create({
          data: {
            parent_id: null,
            slug: cat.slug,
            name: cat.name,
            short_name: cat.shortName ?? null,
            description: cat.description,
            depth: 0,
            position: cat.position,
            seo: stringifyJsonObject({ meta_title: cat.name, meta_description: cat.description }),
          },
        });
    for (let i = 0; i < cat.children.length; i++) {
      const child = cat.children[i];
      await db.category.upsert({
        where: { parent_id_slug: { parent_id: parent.id, slug: child.slug } },
        create: {
          parent_id: parent.id,
          slug: child.slug,
          name: child.name,
          description: child.description,
          depth: 1,
          position: i + 1,
          seo: stringifyJsonObject({}),
        },
        update: { name: child.name, description: child.description, position: i + 1 },
      });
    }
  }
  const categoryCount = await db.category.count();
  console.log(`✓ ${categoryCount} rubriques et sous-rubriques (§21.1)`);

  // 4. Zones géographiques (§21.2)
  for (const continent of GEO_ZONES) {
    const existingZone = await db.geoZone.findFirst({
      where: { parent_id: null, slug: continent.slug },
    });
    const zone = existingZone
      ? await db.geoZone.update({
          where: { id: existingZone.id },
          data: { name: continent.name, position: continent.position },
        })
      : await db.geoZone.create({
          data: {
            parent_id: null,
            type: continent.type,
            slug: continent.slug,
            name: continent.name,
            iso_code: continent.isoCode ?? null,
            latitude: continent.latitude ?? null,
            longitude: continent.longitude ?? null,
            position: continent.position,
          },
        });
    for (const child of continent.children ?? []) {
      const sub = await db.geoZone.upsert({
        where: { parent_id_slug: { parent_id: zone.id, slug: child.slug } },
        create: {
          parent_id: zone.id,
          type: child.type,
          slug: child.slug,
          name: child.name,
          iso_code: child.isoCode ?? null,
          latitude: child.latitude ?? null,
          longitude: child.longitude ?? null,
          position: child.position,
        },
        update: { name: child.name, position: child.position },
      });
      for (const grandChild of child.children ?? []) {
        await db.geoZone.upsert({
          where: { parent_id_slug: { parent_id: sub.id, slug: grandChild.slug } },
          create: {
            parent_id: sub.id,
            type: grandChild.type,
            slug: grandChild.slug,
            name: grandChild.name,
            iso_code: grandChild.isoCode ?? null,
            latitude: grandChild.latitude ?? null,
            longitude: grandChild.longitude ?? null,
            position: grandChild.position,
          },
          update: { name: grandChild.name, position: grandChild.position },
        });
      }
    }
  }
  console.log(`✓ ${await db.geoZone.count()} zones géographiques (§21.2)`);

  // 5. Villes météo (§21.3)
  for (const city of WEATHER_CITIES) {
    const existing = await db.weatherCity.findFirst({ where: { name: city.name } });
    if (!existing) {
      await db.weatherCity.create({
        data: {
          name: city.name,
          latitude: city.latitude,
          longitude: city.longitude,
          position: city.position,
          is_default: city.isDefault,
        },
      });
    }
  }
  console.log(`✓ ${await db.weatherCity.count()} villes météo (§21.3)`);

  // 6. Menus et items (§21.4)
  const allCategories = await db.category.findMany({
    select: { id: true, slug: true },
  });
  const categoryBySlug = new Map(allCategories.map((c) => [c.slug, c.id]));
  for (const menu of MENUS) {
    const menuRow = await db.menu.upsert({
      where: { key: menu.key },
      create: { key: menu.key, label: menu.label },
      update: { label: menu.label },
    });
    let position = 0;
    for (const item of menu.items) {
      position = item.position;
      const existing = await db.menuItem.findFirst({
        where: { menu_id: menuRow.id, label: item.label, parent_id: null },
      });
      const data = {
        menu_id: menuRow.id,
        parent_id: null,
        label: item.label,
        target_type: item.targetType,
        target_id:
          item.targetType === "category" && item.categorySlug
            ? (categoryBySlug.get(item.categorySlug) ?? null)
            : null,
        target_url: item.targetType === "url" ? (item.url ?? null) : item.pageSlug ? `/pages/${item.pageSlug}` : null,
        highlight: item.highlight ?? false,
        position,
      };
      if (existing) {
        await db.menuItem.update({ where: { id: existing.id }, data });
      } else {
        await db.menuItem.create({ data });
      }
    }
  }
  console.log(`✓ ${await db.menu.count()} menus et ${await db.menuItem.count()} entrées (§21.4)`);

  // 7. Zoning de la page d'accueil (§09.1)
  for (const block of HOMEPAGE_BLOCKS) {
    await db.homepageBlock.upsert({
      where: { code_locale: { code: block.code, locale: "fr" } },
      create: {
        code: block.code,
        type: block.type,
        variant: block.variant ?? null,
        title: block.title ?? null,
        source_type: block.sourceType ?? null,
        item_count: block.itemCount ?? 6,
        settings: stringifyJsonObject(block.settings ?? {}),
        position: block.position,
        is_active: block.isActive,
      },
      update: {
        type: block.type,
        variant: block.variant ?? null,
        title: block.title ?? null,
        settings: stringifyJsonObject(block.settings ?? {}),
        position: block.position,
        is_active: block.isActive,
      },
    });
  }
  console.log(`✓ ${await db.homepageBlock.count()} blocs d'accueil (§09.1)`);

  // 8. Emplacements publicitaires (§13.1)
  for (const slot of AD_SLOTS) {
    await db.adSlot.upsert({
      where: { code: slot.code },
      create: {
        code: slot.code,
        name: slot.name,
        description: slot.description,
        placement: slot.placement,
        sizes: stringifyJsonArray(slot.sizes),
        pages: stringifyJsonArray(slot.pages),
        max_creative_kb: slot.maxCreativeKb ?? 150,
        allows_third_party: slot.allowsThirdParty ?? false,
        refresh_sec: slot.refreshSec ?? null,
        max_refresh: slot.maxRefresh ?? 5,
        position: slot.position,
      },
      update: {
        name: slot.name,
        description: slot.description,
        placement: slot.placement,
        sizes: stringifyJsonArray(slot.sizes),
        pages: stringifyJsonArray(slot.pages),
        position: slot.position,
      },
    });
  }
  console.log(`✓ ${await db.adSlot.count()} emplacements publicitaires (§13.1)`);

  // 9. Listes newsletter (§14.1)
  for (const list of NEWSLETTER_LISTS) {
    await db.newsletterList.upsert({
      where: { key: list.key },
      create: {
        key: list.key,
        name: list.name,
        description: list.description,
        cadence: list.cadence,
        send_time: list.sendTime ?? null,
        auto_compose: list.autoCompose ?? false,
        template_key: list.templateKey ?? "default",
        position: list.position,
      },
      update: {
        name: list.name,
        description: list.description,
        cadence: list.cadence,
        send_time: list.sendTime ?? null,
        auto_compose: list.autoCompose ?? false,
        position: list.position,
      },
    });
  }
  console.log(`✓ ${await db.newsletterList.count()} listes newsletter (§14.1)`);

  // 10. Réglages (§11.2)
  for (const setting of SETTINGS) {
    await db.setting.upsert({
      where: { key: setting.key },
      create: {
        key: setting.key,
        value: setting.value,
        group_key: setting.groupKey,
        label: setting.label,
      },
      update: { label: setting.label, group_key: setting.groupKey },
    });
  }
  console.log(`✓ ${await db.setting.count()} réglages (§11.2)`);

  // 11. Textes d'interface (translations, §00.2-2)
  for (const translation of TRANSLATIONS) {
    await db.translation.upsert({
      where: { key_locale: { key: translation.key, locale: "fr" } },
      create: { key: translation.key, locale: "fr", value: translation.value, context: translation.context ?? null },
      update: { value: translation.value },
    });
  }
  console.log(`✓ ${await db.translation.count()} textes d'interface (fr)`);

  // 12. Pages statiques (§21.5)
  for (const page of PAGES) {
    const blocks = page.blocks();
    const body = JSON.stringify(blocks);
    const existing = await db.page.findUnique({
      where: { locale_slug: { locale: "fr", slug: page.slug } },
    });
    const data = {
      title: page.title,
      body,
      template: page.template,
      is_published: true,
      seo: stringifyJsonObject({
        meta_title: page.seoTitle,
        meta_description: page.metaDescription,
      }),
    };
    if (existing) {
      await db.page.update({ where: { id: existing.id }, data });
    } else {
      await db.page.create({ data: { slug: page.slug, locale: "fr", ...data } });
    }
  }
  console.log(`✓ ${await db.page.count()} pages statiques (§21.5)`);

  // ═══ Démonstration (§21.6) — idempotent, supprimable par db:seed:clean ═══

  const demoMarker = await db.setting.findUnique({ where: { key: "system.demo_imported_at" } });

  // 13. Médias de démonstration (fichiers SVG réels + 1 vidéo de référence)
  mkdirSync(DEMO_MEDIA_DIR, { recursive: true });
  const mediaByCategory = new Map<string, string>();
  for (const slot of DEMO_COVER_SLOTS) {
    for (let variant = 1; variant <= 4; variant++) {
      const fileName = `cover-${slot}-${variant}.svg`;
      const filePath = join(DEMO_MEDIA_DIR, fileName);
      let checksum = "";
      try {
        checksum = (readFileSync(filePath, "utf8").length + fileName).slice(0, 32);
      } catch {
        checksum = "";
      }
      if (!checksum) {
        const svg = coverSvg(variant + DEMO_COVER_SLOTS.indexOf(slot), "INFOSPRO · " + slot);
        writeFileSync(filePath, svg, "utf8");
        checksum = (svg.length + fileName).slice(0, 32);
      }
      const existing = await db.media.findFirst({
        where: { storage_key: `media-demo/${fileName}` },
      });
      const realUrl = unsplashCoverUrl(slot, variant);
      let mediaId: string;
      if (existing) {
        await db.media.update({ where: { id: existing.id }, data: { url: realUrl, mime_type: "image/jpeg" } });
        mediaId = existing.id;
      } else {
        const created = await db.media.create({
          data: {
            type: "image",
            storage_key: `media-demo/${fileName}`,
            url: realUrl,
            mime_type: "image/jpeg",
            file_size: BigInt(readFileSync(join(DEMO_MEDIA_DIR, fileName), "utf8").length),
            width: 1600,
            height: 900,
            title: `Couverture ${slot} ${variant}`,
            alt_text: `Illustration éditoriale INFOSPRO — ${slot}`,
            caption: "Illustration produite par la rédaction INFOSPRO.",
            credit: "Unsplash — libre de droits",
            license: "Unsplash License — usage éditorial",
            checksum,
            variants: stringifyJsonArray([]),
            crops: stringifyJsonObject({}),
          },
        });
        mediaId = created.id;
      }
      mediaByCategory.set(`${slot}-${variant}`, mediaId);
    }
  }

  const demoVideo = await db.media.findFirst({
    where: { storage_key: "media-demo/reportage-big-buck-bunny" },
  });
  const videoMediaId =
    demoVideo?.id ??
    (
      await db.media.create({
        data: {
          type: "video",
          storage_key: "media-demo/reportage-big-buck-bunny",
          url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
          mime_type: "video/youtube",
          file_size: BigInt(0),
          duration_sec: 635,
          title: "Reportage vidéo de démonstration",
          alt_text: "Reportage vidéo de démonstration de la rédaction",
          caption: "Reportage vidéo (référence libre de droits du domaine public).",
          credit: "Blender Foundation — domaine public",
          license: "Creative Commons Attribution / Domaine public",
          provider: "youtube",
          provider_id: "aqz-KE-bpKQ",
        },
      })
    ).id;
  console.log(`✓ ${await db.media.count()} médias de démonstration`);

  // 14. Dossiers (3)
  const dossierSeeds = [
    {
      slug: "transition-guinee-la-feuille-de-route",
      title: "Transition : la feuille de route décryptée",
      lede: "Institutions, calendrier, dialogue : INFOSPRO décrypte chaque étape de la transition guinéenne.",
      description:
        "Dossier de référence sur la transition : toutes nos enquêtes, analyses et interviews réunies, mises à jour à chaque développement.",
    },
    {
      slug: "mines-et-communautes-le-bilan",
      title: "Mines et communautés : le bilan",
      lede: "Bauxite, or, fer : ce que les mines changent pour les habitants des zones d'extraction.",
      description:
        "Séries d'enquêtes sur les retombées locales de l'industrie extractive, les conventions et les promesses tenues ou non.",
    },
    {
      slug: "climat-conakry-ville-face-a-la-mer",
      title: "Conakry, ville face à la mer",
      lede: "Érosion, inondations, urbanisation : comment la capitale s'adapte au changement climatique.",
      description:
        "Grand dossier sur l'adaptation de Conakry au changement climatique, du littoral aux quartiers intérieurs.",
    },
  ];
  const dossierIds: string[] = [];
  for (const dossier of dossierSeeds) {
    const row = await db.dossier.upsert({
      where: { slug: dossier.slug },
      create: {
        slug: dossier.slug,
        title: dossier.title,
        lede: dossier.lede,
        description: dossier.description,
        is_active: true,
        is_featured: dossier.slug === "transition-guinee-la-feuille-de-route",
        started_at: hoursAgoDate(24 * 30),
      },
      update: { title: dossier.title, lede: dossier.lede, is_active: true },
    });
    dossierIds.push(row.id);
  }
  console.log(`✓ ${dossierIds.length} dossiers de démonstration`);

  // 15. Articles de démonstration (30)
  let createdArticles = 0;
  let articleIndex = 0;
  const publishedArticleIds: string[] = [];
  for (const demo of DEMO_ARTICLES) {
    const blocks = demo.blocks();
    // Bloc image d'illustration en tête (média réel généré)
    const cover = mediaByCategory.get(
      `${demo.categorySlug}-${(articleIndex % 4) + 1}`
    ) ?? [...mediaByCategory.values()][0];
    const withCover: typeof blocks = [
      { id: blocks[0]?.id ?? "b", type: "image", mediaId: cover, size: "wide", caption: "Illustration INFOSPRO." } as (typeof blocks)[number],
      ...blocks,
    ];
    const meta = deriveBodyMetadata(withCover);
    const category = await db.category.findFirst({
      where: { slug: demo.categorySlug, parent_id: null },
      select: { id: true },
    });
    if (!category) {
      console.warn(`  ⚠ rubrique absente pour l'article ${demo.slug} — ignoré`);
      articleIndex++;
      continue;
    }
    const author = ACCOUNTS[demo.authorIndex % ACCOUNTS.length];
    const authorUser = await db.user.findUnique({ where: { email: author.email } });
    const publishedAt = hoursAgoDate(demo.hoursAgo);
    const dossierId =
      demo.slug.includes("transition") || demo.slug.includes("conseil-national")
        ? dossierIds[0]
        : demo.slug.includes("bauxite") || demo.slug.includes("anacarde")
          ? dossierIds[1]
          : demo.slug.includes("inondations") || demo.slug.includes("mangroves")
            ? dossierIds[2]
            : null;

    const existing = await db.article.findUnique({
      where: { locale_slug: { locale: "fr", slug: demo.slug } },
    });
    const articleData = {
      slug: demo.slug,
      locale: "fr",
      kicker: demo.kicker ?? null,
      title: demo.title,
      lede: demo.lede,
      body: JSON.stringify(withCover),
      plain_text: meta.plain_text,
      word_count: meta.word_count,
      reading_time_min: meta.reading_time_min,
      format: demo.format as never,
      status: "published" as never,
      visibility: "public" as never,
      importance: demo.importance,
      is_breaking: demo.isBreaking ?? false,
      category_id: category.id,
      dossier_id: dossierId,
      cover_media_id: cover,
      published_at: publishedAt,
      updated_content_at: publishedAt,
      meta_title: demo.title.slice(0, 60),
      meta_description: demo.lede.slice(0, 160),
      robots_directives: "index,follow",
      focus_keyword: demo.tags[0] ?? null,
      seo_checks: stringifyJsonObject({}),
      sources: stringifyJsonArray([]),
      created_by: authorUser?.id ?? null,
      published_by: authorUser?.id ?? null,
    };

    let articleId: string;
    if (existing) {
      await db.article.update({ where: { id: existing.id }, data: articleData });
      articleId = existing.id;
    } else {
      const created = await db.article.create({ data: articleData });
      articleId = created.id;
      createdArticles++;
    }
    publishedArticleIds.push(articleId);

    // Auteurs, tags
    if (authorUser) {
      await db.articleAuthor.upsert({
        where: {
          article_id_user_id_role: {
            article_id: articleId,
            user_id: authorUser.id,
            role: "author",
          },
        },
        create: { article_id: articleId, user_id: authorUser.id, role: "author", position: 0 },
        update: {},
      });
    }
    for (let t = 0; t < demo.tags.length; t++) {
      const tagSlug = demo.tags[t].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").slice(0, 40);
      const tag = await db.tag.upsert({
        where: { slug: tagSlug },
        create: { slug: tagSlug, name: demo.tags[t] },
        update: {},
      });
      await db.articleTag.upsert({
        where: { article_id_tag_id: { article_id: articleId, tag_id: tag.id } },
        create: { article_id: articleId, tag_id: tag.id, position: t },
        update: {},
      });
    }
    articleIndex++;
  }
  console.log(`✓ ${publishedArticleIds.length} articles de démonstration (${createdArticles} créés, ${publishedArticleIds.length - createdArticles} mis à jour)`);

  // Compteurs dénormalisés (dev : couche service, D-01)
  for (const article of publishedArticleIds) {
    const row = await db.article.findUnique({ where: { id: article }, select: { category_id: true } });
    if (row) {
      await db.category.update({
        where: { id: row.category_id },
        data: { article_count: { increment: 1 } },
      });
    }
  }

  // 16. Flashs (10)
  const flashTexts = [
    { text: "Syli National : la liste des joueurs convoqués est tombée, deux nouvelles appelations.", priority: 2 },
    { text: "Baccalauréat : les résultats sont disponibles en ligne et dans les centres d'examen.", priority: 2 },
    { text: "Vigilance pluies intenses : la préfecture de Conakry appelle à la prudence dans les quartiers bas.", priority: 1 },
    { text: "Bauxite : les exportations du semestre en hausse, confirme un rapport sectoriel.", priority: 3 },
    { text: "Santé : appel national au don de sang, stocks critiques dans plusieurs centres.", priority: 1 },
    { text: "Télécoms : de nouveaux sites 4G mis en service dans quatre préfectures.", priority: 3 },
    { text: "Ligue 1 : le derby de Conakry se joue ce dimanche, billetterie ouverte.", priority: 3 },
    { text: "Électricité : interruptions techniques programmées dans certaines zones ce week-end.", priority: 2 },
    { text: "Transition : le calendrier officiel des consultations politiques est publié.", priority: 2 },
    { text: "Athlétisme : deux médailles pour la Guinée aux championnats de la zone.", priority: 2 },
  ];
  const adminUser = await db.user.findUnique({ where: { email: "admin@infospro.net" } });
  for (let i = 0; i < flashTexts.length; i++) {
    const flash = flashTexts[i];
    const existing = await db.flashNews.findFirst({
      where: { text: flash.text },
    });
    const data = {
      text: flash.text,
      priority: flash.priority,
      published_at: hoursAgoDate(i * 1.5),
      expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000),
      created_by: adminUser?.id ?? null,
    };
    if (existing) {
      await db.flashNews.update({ where: { id: existing.id }, data });
    } else {
      await db.flashNews.create({ data });
    }
  }
  console.log(`✓ ${await db.flashNews.count()} flashs actifs (§21.6)`);

  // 17. Live blog (1) + entrées
  const liveSlug = "direct-actualite-de-la-journee-en-continu";
  const liveExisting = await db.liveBlog.findUnique({ where: { slug: liveSlug } });
  const liveData = {
    slug: liveSlug,
    title: "Direct — L'actualité de la journée en continu",
    summary: JSON.stringify([
      "Le calendrier officiel des consultations politiques est publié.",
      "Vigilance pluies intenses sur la capitale.",
      "Athlétisme : deux médailles guinéennes aux championnats de la zone.",
    ]),
    status: "live" as never,
    started_at: hoursAgoDate(5),
  };
  const live = liveExisting
    ? await db.liveBlog.update({ where: { id: liveExisting.id }, data: liveData })
    : await db.liveBlog.create({ data: liveData });
  const liveEntries = [
    { title: "Le calendrier des consultations est officiellement publié", key: true, hours: 4.5 },
    { title: "Météo : avis de vigilance maintenu pour la capitale", key: false, hours: 3.5 },
    { title: "Athlétisme : retour sur la course du sacre", key: true, hours: 2.5 },
    { title: "Bourse des collectivités : point sur les transferts de l'État", key: false, hours: 1.5 },
    { title: "Prochaine conférence de presse annoncée pour demain matin", key: false, hours: 0.5 },
  ];
  for (let i = 0; i < liveEntries.length; i++) {
    const entry = liveEntries[i];
    const existingEntry = await db.liveEntry.findFirst({
      where: { live_blog_id: live.id, title: entry.title },
    });
    const entryData = {
      live_blog_id: live.id,
      title: entry.title,
      body: JSON.stringify([
        {
          id: `le${i}${Math.random().toString(36).slice(2, 8)}`,
          type: "paragraph",
          text: [{ text: "Suivi en direct par la rédaction d'INFOSPRO — informations vérifiées au fil de la journée." }],
        },
      ]),
      is_pinned: i === 0,
      is_key: entry.key,
      published_at: hoursAgoDate(entry.hours),
      created_by: adminUser?.id ?? null,
    };
    if (existingEntry) {
      await db.liveEntry.update({ where: { id: existingEntry.id }, data: entryData });
    } else {
      await db.liveEntry.create({ data: entryData });
    }
  }
  await db.liveBlog.update({ where: { id: live.id }, data: { entry_count: liveEntries.length } });
  console.log("✓ 1 live blog + 5 entrées (§21.6)");

  // 18. Campagne publicitaire de test (1 annonceur, 5 emplacements, §21.6)
  const existingAdvertiser = await db.advertiser.findFirst({
    where: { name: "Annonceur de démonstration" },
  });
  const advertiser = existingAdvertiser
    ? existingAdvertiser
    : await db.advertiser.create({
        data: {
          name: "Annonceur de démonstration",
          agency: "Agence Démo",
          sector: "telecoms",
          contact_name: "Service marketing",
          contact_email: "marketing@annonceur-demo.example",
          report_token: secureToken(18),
          notes: "Compte de démonstration — campagne de test interne (§21.6).",
        },
      });
  const testSlotCodes = ["AD-02", "AD-04", "AD-06", "AD-07", "AD-12"];
  const campaign = await db.adCampaign.upsert({
    where: { id: (await db.adCampaign.findFirst({ where: { name: "Campagne de démonstration — multi-emplacements" }, select: { id: true } }))?.id ?? "never" },
    create: {
      advertiser_id: advertiser.id,
      name: "Campagne de démonstration — multi-emplacements",
      status: "running",
      starts_at: hoursAgoDate(24),
      ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      goal_type: "impressions",
      goal_value: BigInt(500000),
      budget: 25000000,
      currency: "GNF",
      priority: 5,
      weight: 1,
      frequency_cap: 4,
      targeting: stringifyJsonObject({ devices: ["all"], languages: ["fr"], visitor: "all" }),
      created_by: adminUser?.id ?? null,
    },
    update: { status: "running" },
  }).catch(async () => {
    return db.adCampaign.create({
      data: {
        advertiser_id: advertiser.id,
        name: "Campagne de démonstration — multi-emplacements",
        status: "running",
        starts_at: hoursAgoDate(24),
        ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        goal_type: "impressions",
        goal_value: BigInt(500000),
        budget: 25000000,
        currency: "GNF",
        priority: 5,
        weight: 1,
        frequency_cap: 4,
        targeting: stringifyJsonObject({ devices: ["all"], languages: ["fr"], visitor: "all" }),
        created_by: adminUser?.id ?? null,
      },
    });
  });
  for (const slotCode of testSlotCodes) {
    const existingCreative = await db.adCreative.findFirst({
      where: { campaign_id: campaign.id, slot_code: slotCode },
    });
    const creativeData = {
      campaign_id: campaign.id,
      slot_code: slotCode,
      type: "native" as never,
      native_title: "Découvrez la nouvelle offre nationale",
      native_text: "Un message de notre annonceur de démonstration — réseau national, tarifs affichés.",
      native_cta: "En savoir plus",
      native_brand: "Annonceur Démo",
      click_url: "https://infospro.net/publicite",
      alt_text: "Bannière publicitaire de démonstration de l'annonceur Démo",
      weight: 1,
      is_active: true,
    };
    if (existingCreative) {
      await db.adCreative.update({ where: { id: existingCreative.id }, data: creativeData });
    } else {
      await db.adCreative.create({ data: creativeData });
    }
  }
  console.log(`✓ 1 campagne de test sur ${testSlotCodes.length} emplacements (§21.6)`);

  // 19. Abonnés (50, §21.6)
  let demoSubscribers = 0;
  for (let i = 1; i <= 50; i++) {
    const email = `lecteur${String(i).padStart(2, "0")}@demo.infospro.net`;
    const existing = await db.subscriber.findUnique({ where: { email } });
    if (!existing) {
      const subscriber = await db.subscriber.create({
        data: {
          email,
          first_name: `Lecteur ${i}`,
          country: i % 3 === 0 ? "FR" : "GN",
          locale: "fr",
          interests: stringifyJsonArray([i % 2 === 0 ? "economie" : "sport"]),
          status: "confirmed",
          confirm_token: null,
          unsubscribe_token: secureToken(18),
          source: i % 2 === 0 ? "home_inline" : "footer",
          consent_at: hoursAgoDate(24 * 7),
          consent_ip_hash: null,
          engagement_score: (i * 7) % 100,
        },
      });
      const listKeys = ["morning", i % 2 === 0 ? "weekly" : "economy", "diaspora"];
      const lists = await db.newsletterList.findMany({
        where: { key: { in: listKeys.slice(0, (i % 3) + 1) } },
      });
      for (const list of lists) {
        await db.subscriberList.upsert({
          where: {
            subscriber_id_list_id: { subscriber_id: subscriber.id, list_id: list.id },
          },
          create: { subscriber_id: subscriber.id, list_id: list.id },
          update: {},
        });
      }
      demoSubscribers++;
    }
  }
  console.log(`✓ ${await db.subscriber.count()} abonnés newsletter (${demoSubscribers} créés) (§21.6)`);

  // 20. Marqueur de démonstration + « À la une » initiale
  await db.setting.upsert({
    where: { key: "system.demo_imported_at" },
    create: {
      key: "system.demo_imported_at",
      value: JSON.stringify(new Date().toISOString()),
      group_key: "features",
      label: "Horodatage d'import du contenu de démonstration",
    },
    update: { value: JSON.stringify(new Date().toISOString()) },
  });

  const featuredExisting = await db.featuredSlot.findFirst({ where: { zone: "home_lead", position: 0 } });
  if (!featuredExisting && publishedArticleIds.length >= 5) {
    await db.featuredSlot.create({
      data: {
        zone: "home_lead",
        article_id: publishedArticleIds[0],
        position: 0,
        pinned: true,
        created_by: adminUser?.id ?? null,
      },
    });
    for (let i = 1; i <= 4; i++) {
      await db.featuredSlot.create({
        data: {
          zone: "home_lead",
          article_id: publishedArticleIds[i],
          position: i,
          created_by: adminUser?.id ?? null,
        },
      });
    }
    console.log("✓ Composition initiale de la une (1 hero + 4 medium)");
  }

  console.log("────────────────────────────────────────────────────────────");
  console.log("Seed terminé. Mots de passe temporaires (à changer à la");
  console.log("première connexion — affichés UNE SEULE FOIS) :");
  if (credentials.length === 0) {
    console.log("  (comptes déjà initialisés — mots de passe inchangés)");
  }
  for (const credential of credentials) {
    console.log(`  ${credential.role.padEnd(14)} ${credential.email}  →  ${credential.password}`);
  }
  console.log("2FA (TOTP) : à activer à la première connexion, écran Sécurité.");
  console.log("────────────────────────────────────────────────────────────");
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error("Seed : échec —", error);
    await db.$disconnect();
    process.exit(1);
  });
