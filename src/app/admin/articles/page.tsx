import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { ARTICLE_FORMATS } from "@/schemas/article";
import { ArticleListClient } from "@/components/admin/article/ArticleListClient";

export const dynamic = "force-dynamic";

/** Liste des articles (§11.2 /admin/articles). */
export default async function AdminArticlesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const categories = await db.category.findMany({
    where: { deleted_at: null },
    orderBy: [{ depth: "asc" }, { name: "asc" }],
    select: { id: true, name: true, depth: true },
  });

  return <ArticleListClient categories={categories} formats={ARTICLE_FORMATS} />;
}
