import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ValidationError } from "@/lib/api/respond";
import { invalidateTags, CACHE_TAGS } from "@/lib/cache";
import { slugify, ensureUniqueSlug } from "@/lib/utils/slug";
import { parseJsonArray, stringifyJsonArray } from "@/lib/json";
import type {
  bannerSaveSchema,
  homepageBlocksSaveSchema,
  homepageLayoutSaveSchema,
  menuItemSchema,
  menuSaveSchema,
  pageSaveSchema,
  redirectSaveSchema,
  uneSaveSchema,
} from "@/schemas/media-structure";
import type { z } from "zod";

/**
 * Structures éditoriales (§11.2) : pages, menus, bannières, redirections,
 * composeur de page d'accueil (homepage_blocks + homepage_layouts),
 * composeur de la une (featured_slots), publication d'urgence (flash).
 */

// ─── Pages (§11.2 /admin/pages) ────────────────────────────────────────

export async function listPages() {
  return db.page.findMany({
    where: { deleted_at: null },
    orderBy: { title: "asc" },
    select: { id: true, title: true, slug: true, template: true, is_published: true, updated_at: true, locale: true },
  });
}

export async function getPage(id: string) {
  const page = await db.page.findFirst({ where: { id, deleted_at: null } });
  if (!page) throw new ValidationError("Page introuvable.");
  return page;
}

export async function savePage(
  input: z.infer<typeof pageSaveSchema> & { id?: string },
  userId: string
) {
  if (input.id) {
    const current = await db.page.findFirst({ where: { id: input.id, deleted_at: null } });
    if (!current) throw new ValidationError("Page introuvable.");
    const data: Record<string, unknown> = {
      title: input.title,
      is_published: input.is_published,
      updated_by: userId,
    };
    if (input.slug !== undefined && input.slug !== current.slug) {
      const slug = await ensureUniqueSlug(input.slug, async (s) => {
        const found = await db.page.findFirst({ where: { slug: s, locale: current.locale, deleted_at: null, id: { not: current.id } }, select: { id: true } });
        return found !== null;
      });
      data.slug = slug;
      // Garde anti-boucle (renommage A→B→A) : redirection réciproque
      // supprimée avant l'upsert — voir services/taxonomies.ts updateCategory.
      await db.redirect.deleteMany({
        where: { source_path: `/${slug}`, target_path: `/${current.slug}` },
      });
      await db.redirect.upsert({
        where: { source_path: `/${current.slug}` },
        create: { source_path: `/${current.slug}`, target_path: `/${slug}`, status_code: 301, is_auto: true },
        update: { target_path: `/${slug}`, status_code: 301, is_auto: true },
      });
    }
    if (input.body !== undefined) data.body = stringifyJsonArray(input.body);
    if (input.template !== undefined) data.template = input.template;
    if (input.seo !== undefined) data.seo = JSON.stringify(input.seo);
    await db.page.update({ where: { id: input.id }, data });
    await auditLog({ userId, action: "page.update", resourceType: "page", resourceId: input.id, after: { title: input.title } });
    invalidateTags([CACHE_TAGS.translations]);
    return { ok: true, id: input.id };
  }

  const slug = await ensureUniqueSlug(slugify(input.slug ?? input.title), async (s) => {
    const found = await db.page.findFirst({ where: { slug: s, locale: "fr", deleted_at: null }, select: { id: true } });
    return found !== null;
  });
  const page = await db.page.create({
    data: {
      title: input.title,
      slug,
      locale: "fr",
      body: stringifyJsonArray(input.body ?? []),
      template: input.template ?? "default",
      is_published: input.is_published ?? false,
      seo: JSON.stringify(input.seo ?? {}),
      updated_by: userId,
    },
  });
  await auditLog({ userId, action: "page.create", resourceType: "page", resourceId: page.id, after: { title: page.title } });
  return { ok: true, id: page.id };
}

export async function deletePage(id: string, userId: string) {
  await db.page.update({ where: { id }, data: { deleted_at: new Date() } });
  await auditLog({ userId, action: "page.delete", resourceType: "page", resourceId: id });
  return { ok: true };
}

// ─── Menus (§11.2 /admin/menus, drag & drop) ───────────────────────────

export async function listMenusWithItems() {
  const menus = await db.menu.findMany({ orderBy: { key: "asc" }, include: { items: { orderBy: { position: "asc" } } } });
  return menus;
}

export async function saveMenuTree(menuId: string, input: z.infer<typeof menuSaveSchema>, userId: string) {
  const menu = await db.menu.findUnique({ where: { id: menuId } });
  if (!menu) throw new ValidationError("Menu introuvable.");

  // Valide l'arbre : parent parmi les items fournis, pas de cycle
  const byId = new Map<string, z.infer<typeof menuItemSchema>>();
  for (const item of input.items) {
    if (item.id) byId.set(item.id, item);
  }
  for (const item of input.items) {
    if (item.parent_id) {
      if (!byId.has(item.parent_id)) {
        throw new ValidationError("Parent introuvable dans l'arbre soumis.");
      }
      if (item.parent_id === item.id) {
        throw new ValidationError("Un élément ne peut pas être son propre parent.");
      }
    }
    if (item.target_type === "url" && !item.target_url) {
      throw new ValidationError(`L'élément « ${item.label} » (URL externe) requiert une URL.`);
    }
    if (item.target_type !== "url" && item.target_type !== "home" && !item.target_id) {
      throw new ValidationError(`L'élément « ${item.label} » requiert une cible.`);
    }
  }

  await db.$transaction(async (tx) => {
    // Remplace l'arbre complet (simple et sûr : les menus sont de petite taille)
    await tx.menuItem.deleteMany({ where: { menu_id: menuId } });
    // Crée d'abord sans parent (les ids nouveaux sont générés par la base) :
    // stratégie en 2 passes — top-level puis enfants avec mapping temporaire.
    interface TreeInput extends z.infer<typeof menuItemSchema> {
      temp_key?: string;
    }
    void (0 as unknown as TreeInput | undefined);
    const idMap = new Map<string, string>();

    // Passe 1 : éléments racine
    const roots = input.items.filter((i) => !i.parent_id);
    for (const item of roots) {
      const created = await tx.menuItem.create({
        data: {
          menu_id: menuId,
          label: item.label,
          target_type: item.target_type,
          target_id: item.target_id ?? null,
          target_url: item.target_url ?? null,
          icon: item.icon ?? null,
          open_new_tab: item.open_new_tab ?? false,
          highlight: item.highlight ?? false,
          position: item.position,
          is_visible: item.is_visible ?? true,
          locale: "fr",
        },
      });
      if (item.id) idMap.set(item.id, created.id);
    }
    // Passe 2+ : enfants niveau par niveau
    let pending = input.items.filter((i) => i.parent_id);
    let guard = 0;
    while (pending.length > 0 && guard < 10) {
      const next: typeof pending = [];
      for (const item of pending) {
        const parentResolved = item.parent_id ? idMap.get(item.parent_id) ?? null : null;
        if (!parentResolved) {
          next.push(item);
          continue;
        }
        const created = await tx.menuItem.create({
          data: {
            menu_id: menuId,
            parent_id: parentResolved,
            label: item.label,
            target_type: item.target_type,
            target_id: item.target_id ?? null,
            target_url: item.target_url ?? null,
            icon: item.icon ?? null,
            open_new_tab: item.open_new_tab ?? false,
            highlight: item.highlight ?? false,
            position: item.position,
            is_visible: item.is_visible ?? true,
            locale: "fr",
          },
        });
        if (item.id) idMap.set(item.id, created.id);
      }
      if (next.length === pending.length) {
        throw new ValidationError("Arbre de menu invalide (parent manquant).");
      }
      pending = next;
      guard += 1;
    }
  });

  await auditLog({ userId, action: "menu.update", resourceType: "menu", resourceId: menuId, after: { items: input.items.length } });
  invalidateTags([CACHE_TAGS.menus]);
  return { ok: true };
}

// ─── Bannières (§11.2) ─────────────────────────────────────────────────

export async function listBanners() {
  return db.siteBanner.findMany({ orderBy: { is_active: "desc" } });
}

export async function saveBanner(input: z.infer<typeof bannerSaveSchema> & { id?: string }, userId: string) {
  const data: Record<string, unknown> = {
    message: input.message,
    link_url: input.link_url ?? null,
    link_label: input.link_label ?? null,
    style: input.style ?? "alert",
    is_dismissible: input.is_dismissible ?? true,
    is_active: input.is_active ?? false,
  };
  if (input.target_paths !== undefined) data.target_paths = stringifyJsonArray(input.target_paths);
  if (input.starts_at !== undefined) data.starts_at = input.starts_at ? new Date(input.starts_at) : null;
  if (input.ends_at !== undefined) data.ends_at = input.ends_at ? new Date(input.ends_at) : null;

  if (input.id) {
    await db.siteBanner.update({ where: { id: input.id }, data });
    await auditLog({ userId, action: "banner.update", resourceType: "site_banner", resourceId: input.id });
    return { ok: true, id: input.id };
  }
  const banner = await db.siteBanner.create({ data: data as never });
  await auditLog({ userId, action: "banner.create", resourceType: "site_banner", resourceId: banner.id });
  return { ok: true, id: banner.id };
}

export async function deleteBanner(id: string, userId: string) {
  await db.siteBanner.delete({ where: { id } });
  await auditLog({ userId, action: "banner.delete", resourceType: "site_banner", resourceId: id });
  return { ok: true };
}

// ─── Redirections (§11.2) ──────────────────────────────────────────────

export async function listRedirects() {
  return db.redirect.findMany({ orderBy: { created_at: "desc" }, take: 500 });
}

export async function saveRedirect(input: z.infer<typeof redirectSaveSchema>, userId: string) {
  const source = input.source_path.split("?")[0];
  if (source === input.target_path) throw new ValidationError("Source et cible doivent différer.");
  const redirect = await db.redirect.upsert({
    where: { source_path: source },
    create: { source_path: source, target_path: input.target_path, status_code: input.status_code ?? 301, is_auto: false },
    update: { target_path: input.target_path, status_code: input.status_code ?? 301, is_auto: false },
  });
  await auditLog({ userId, action: "redirect.upsert", resourceType: "redirect", resourceId: redirect.id, after: input });
  return { ok: true, id: redirect.id };
}

export async function deleteRedirect(id: string, userId: string) {
  await db.redirect.delete({ where: { id } });
  await auditLog({ userId, action: "redirect.delete", resourceType: "redirect", resourceId: id });
  return { ok: true };
}

// ─── Composeur page d'accueil (§11.2 /admin/homepage) ──────────────────

export async function getHomepageBlocks() {
  return db.homepageBlock.findMany({ orderBy: { position: "asc" } });
}

export async function saveHomepageBlocks(
  input: z.infer<typeof homepageBlocksSaveSchema>,
  userId: string
) {
  await db.$transaction(
    input.blocks.map((b) =>
      db.homepageBlock.update({
        where: { id: b.id },
        data: {
          position: input.blocks.indexOf(b),
          ...(b.title !== undefined ? { title: b.title } : {}),
          ...(b.subtitle !== undefined ? { subtitle: b.subtitle } : {}),
          ...(b.variant !== undefined ? { variant: b.variant } : {}),
          ...(b.source_type !== undefined ? { source_type: b.source_type } : {}),
          ...(b.source_id !== undefined ? { source_id: b.source_id } : {}),
          ...(b.manual_article_ids !== undefined ? { manual_article_ids: stringifyJsonArray(b.manual_article_ids) } : {}),
          ...(b.item_count !== undefined ? { item_count: b.item_count } : {}),
          ...(b.settings !== undefined ? { settings: JSON.stringify(b.settings) } : {}),
          ...(b.is_active !== undefined ? { is_active: b.is_active } : {}),
          ...(b.starts_at !== undefined ? { starts_at: b.starts_at ? new Date(b.starts_at) : null } : {}),
          ...(b.ends_at !== undefined ? { ends_at: b.ends_at ? new Date(b.ends_at) : null } : {}),
          updated_by: userId,
        },
      })
    )
  );
  await auditLog({ userId, action: "homepage.blocks_update", resourceType: "homepage", after: { blocks: input.blocks.length } });
  invalidateTags([CACHE_TAGS.homepage]);
  return { ok: true };
}

export async function duplicateHomepageBlock(blockId: string, userId: string) {
  const block = await db.homepageBlock.findUnique({ where: { id: blockId } });
  if (!block) throw new ValidationError("Bloc introuvable.");
  const maxPos = await db.homepageBlock.findFirst({ orderBy: { position: "desc" }, select: { position: true } });
  const code = `${block.code}-c${Date.now().toString(36).slice(-4)}`;
  const copy = await db.homepageBlock.create({
    data: {
      code,
      type: block.type,
      variant: block.variant,
      title: block.title,
      subtitle: block.subtitle,
      source_type: block.source_type,
      source_id: block.source_id,
      manual_article_ids: block.manual_article_ids,
      item_count: block.item_count,
      settings: block.settings,
      position: (maxPos?.position ?? -1) + 1,
      is_active: false, // copie inactive par défaut
      locale: block.locale,
      updated_by: userId,
    },
  });
  await auditLog({ userId, action: "homepage.block_duplicate", resourceType: "homepage", resourceId: copy.id, after: { from: block.code } });
  invalidateTags([CACHE_TAGS.homepage]);
  return copy;
}

export async function saveHomepageLayout(input: z.infer<typeof homepageLayoutSaveSchema>, userId: string) {
  if (input.restore) {
    if (!input.layout_id) throw new ValidationError("Configuration à restaurer manquante.");
    const layout = await db.homepageLayout.findUnique({ where: { id: input.layout_id } });
    if (!layout) throw new ValidationError("Configuration introuvable.");
    const blocks = JSON.parse(layout.snapshot) as { id: string; position: number; is_active?: boolean }[];
    for (const b of blocks) {
      try {
        await db.homepageBlock.update({
          where: { id: b.id },
          data: { position: b.position, ...(b.is_active !== undefined ? { is_active: b.is_active } : {}) },
        });
      } catch {
        // bloc supprimé depuis l'instantané : ignoré
      }
    }
    await auditLog({ userId, action: "homepage.layout_restore", resourceType: "homepage", resourceId: layout.id });
    invalidateTags([CACHE_TAGS.homepage]);
    return { ok: true, restored: layout.name };
  }

  const blocks = await db.homepageBlock.findMany({ orderBy: { position: "asc" } });
  const layout = await db.homepageLayout.create({
    data: {
      name: input.name,
      snapshot: stringifyJsonArray(blocks.map((b) => ({ id: b.id, position: b.position, is_active: b.is_active }))),
      created_by: userId,
    },
  });
  await auditLog({ userId, action: "homepage.layout_save", resourceType: "homepage", resourceId: layout.id, after: { name: layout.name } });
  return { ok: true, id: layout.id };
}

export async function listHomepageLayouts() {
  return db.homepageLayout.findMany({ orderBy: { created_at: "desc" }, take: 50, select: { id: true, name: true, created_at: true, is_current: true } });
}

// ─── Composeur de la une (§11.2 /admin/une) ────────────────────────────

export async function getUneState() {
  const [slots, lead] = await Promise.all([
    db.featuredSlot.findMany({
      where: { zone: { in: ["home_lead", "home_secondary"] } },
      orderBy: [{ zone: "asc" }, { position: "asc" }],
      include: {
        article: {
          select: {
            id: true, title: true, slug: true, published_at: true, importance: true,
            category: { select: { name: true, slug: true } },
            coverMedia: { select: { id: true, url: true, alt_text: true } },
          },
        },
        overrideMedia: { select: { id: true, url: true } },
      },
    }),
    null,
  ]);
  return { slots };
}

export async function searchCandidates(
  q: string | undefined,
  opts: { limit?: number; category_id?: string } = {}
) {
  return db.article.findMany({
    where: {
      deleted_at: null,
      status: { in: ["published", "updated", "scheduled"] },
      ...(q ? { OR: [{ title: { contains: q } }, { lede: { contains: q } }] } : {}),
      ...(opts.category_id ? { category_id: opts.category_id } : {}),
    },
    orderBy: { published_at: "desc" },
    select: {
      id: true, title: true, slug: true, published_at: true, importance: true,
      category: { select: { name: true, slug: true } },
      coverMedia: { select: { id: true, url: true, alt_text: true } },
    },
    take: opts.limit ?? 20,
  });
}

export async function saveUne(input: z.infer<typeof uneSaveSchema>, userId: string) {
  // Valide les positions par zone (unique zone+position)
  const seen = new Set<string>();
  for (const s of input.slots) {
    const k = `${s.zone}:${s.position}`;
    if (seen.has(k)) throw new ValidationError(`Position ${s.position} dupliquée dans la zone ${s.zone}.`);
    seen.add(k);
  }

  await db.$transaction(async (tx) => {
    await tx.featuredSlot.deleteMany({ where: { zone: { in: ["home_lead", "home_secondary"] } } });
    if (input.slots.length > 0) {
      await tx.featuredSlot.createMany({
        data: input.slots.map((s) => ({
          zone: s.zone,
          article_id: s.article_id,
          position: s.position,
          pinned: s.pinned ?? false,
          starts_at: s.starts_at ? new Date(s.starts_at) : null,
          ends_at: s.ends_at ? new Date(s.ends_at) : null,
          override_title: s.override_title ?? null,
          override_media_id: s.override_media_id ?? null,
          created_by: userId,
        })),
      });
    }
  });

  await auditLog({ userId, action: "une.compose", resourceType: "featured", after: { slots: input.slots.length } });
  invalidateTags([CACHE_TAGS.featured, CACHE_TAGS.homepage]);
  return { ok: true };
}

// ─── Publication d'urgence (§11.2) ─────────────────────────────────────

export async function quickFlash(
  userId: string,
  input: { text: string; priority?: number; link?: string | null; expires_in_hours?: number }
) {
  const hours = input.expires_in_hours ?? 12;
  const flash = await db.flashNews.create({
    data: {
      text: input.text.slice(0, 300),
      external_url: input.link ?? null,
      priority: Math.min(3, Math.max(1, input.priority ?? 2)),
      expires_at: new Date(Date.now() + hours * 3600 * 1000),
      created_by: userId,
    },
  });
  await auditLog({ userId, action: "flash.create", resourceType: "flash", resourceId: flash.id, after: { text: flash.text } });
  invalidateTags([CACHE_TAGS.flash]);
  return flash;
}

export async function listFlashNews() {
  return db.flashNews.findMany({
    where: { deleted_at: null },
    orderBy: { published_at: "desc" },
    take: 100,
    include: { article: { select: { title: true, slug: true } } },
  });
}

export async function expireFlash(id: string, userId: string) {
  await db.flashNews.update({ where: { id }, data: { expires_at: new Date() } });
  await auditLog({ userId, action: "flash.expire", resourceType: "flash", resourceId: id });
  invalidateTags([CACHE_TAGS.flash]);
  return { ok: true };
}

export async function deleteFlash(id: string, userId: string) {
  await db.flashNews.update({ where: { id }, data: { deleted_at: new Date() } });
  await auditLog({ userId, action: "flash.delete", resourceType: "flash", resourceId: id });
  invalidateTags([CACHE_TAGS.flash]);
  return { ok: true };
}

// Re-export parseJsonArray pour cohérence interne du module
export const __jsonHelpers = { parseJsonArray };
