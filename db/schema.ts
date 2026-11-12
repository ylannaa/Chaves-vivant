import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const keyQuantities = pgTable("key_quantities", {
  unitId: text("unit_id").primaryKey(),
  quantity: integer("quantity").notNull(),
});

export const keyMovements = pgTable("key_movements", {
  id: text("id").primaryKey(),
  unitId: text("unit_id").notNull(),
  movement: jsonb("movement").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
