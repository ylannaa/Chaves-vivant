CREATE TABLE "key_movements" (
	"id" text PRIMARY KEY,
	"unit_id" text NOT NULL,
	"movement" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Reinicia as quantidades existentes uma única vez, conforme solicitado.
UPDATE "key_quantities" SET "quantity" = 0;
