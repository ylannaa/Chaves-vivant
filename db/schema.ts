import { integer, pgTable, text } from "drizzle-orm/pg-core";

export const keyQuantities = pgTable("key_quantities", {
  unitId: text("unit_id").primaryKey(),
  quantity: integer("quantity").notNull(),
});
