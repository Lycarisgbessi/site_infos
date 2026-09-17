import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const users = await db.user.findMany({
  where: { email: { in: ["admin@infospro.net", "redacteur.en.chef@infospro.net"] } },
  select: { id: true, email: true, two_factor_enabled: true, two_factor_secret: true, status: true },
});
console.log(JSON.stringify(users, null, 2));
const items = await db.menuItem.findMany({ orderBy: [{ menu_id: "asc" }, { position: "asc" }] });
console.log("ITEMS:", JSON.stringify(items));
await db.$disconnect();
