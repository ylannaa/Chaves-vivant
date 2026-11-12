import { getDatabase } from "@netlify/database";
import { desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/netlify-db";
import { keyQuantities, keyMovements } from "../../db/schema.ts";

const db = drizzle({ client: getDatabase() });
export const config = { path: "/api/*" };

export default async function handler(request) {
  const url = new URL(request.url);
  if (url.pathname === "/api/key-movements") {
    try {
      if (request.method === "GET") return Response.json(
        await db.select().from(keyMovements).orderBy(desc(keyMovements.createdAt), desc(keyMovements.id)),
        { headers: { "Cache-Control": "no-store" } },
      );
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      if (request.headers.get("origin") !== url.origin) return new Response("Forbidden", { status: 403 });
      let data;
      try { data = await request.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }
      const { unitId, movement } = data ?? {};
      const statuses = ["box", "staff", "delivered", "missing"];
      if (typeof unitId !== "string" || !/^(energie|harmonie)-([1-9]|[12][0-9]|3[0-4])0[12]$/.test(unitId) ||
          !movement || !statuses.includes(movement.status) || !statuses.includes(movement.previousStatus) ||
          typeof movement.person !== "string" || !movement.person.trim() || movement.person.length > 200 ||
          typeof movement.company !== "string" || !movement.company.trim() || movement.company.length > 200 ||
          typeof movement.note !== "string" || movement.note.length > 2000 ||
          typeof movement.id !== "string" || !/^[a-f0-9-]{36}$/.test(movement.id)) {
        return new Response("Movimentação inválida", { status: 400 });
      }
      const saved = { id: movement.id, status: movement.status, previousStatus: movement.previousStatus,
        person: movement.person.trim(), company: movement.company.trim(), note: movement.note.trim(),
        date: new Date().toISOString() };
      await db.insert(keyMovements).values({ id: saved.id, unitId, movement: saved });
      return Response.json(saved);
    } catch { return Response.json({ error: "Não foi possível acessar os registros." }, { status: 503 }); }
  }
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
