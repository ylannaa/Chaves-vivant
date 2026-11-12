import { drizzle } from "drizzle-orm/netlify-db";
import { keyQuantities } from "../../db/schema.ts";

const db = drizzle();
export const config = { path: "/api/*" };

export default async function handler(request) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/key-quantities") return new Response("Not found", { status: 404 });
  try {
    if (request.method === "GET") {
      return Response.json(await db.select().from(keyQuantities), { headers: { "Cache-Control": "no-store" } });
    }
    if (request.method !== "PUT") return new Response("Method not allowed", { status: 405 });
    if (request.headers.get("origin") !== url.origin) return new Response("Forbidden", { status: 403 });
    let data;
    try { data = await request.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }
    const { unitId, quantity } = data ?? {};
    if (typeof unitId !== "string" || !/^(energie|harmonie)-([1-9]|[12][0-9]|3[0-4])0[12]$/.test(unitId) ||
        !Number.isInteger(quantity) || quantity < 0 || quantity > 2147483647) {
      return new Response("Quantidade inválida", { status: 400 });
    }
    await db.insert(keyQuantities).values({ unitId, quantity }).onConflictDoUpdate({
      target: keyQuantities.unitId, set: { quantity },
    });
    return Response.json({ unitId, quantity });
  } catch {
    return Response.json({ error: "Não foi possível acessar as quantidades." }, { status: 503 });
  }
}
