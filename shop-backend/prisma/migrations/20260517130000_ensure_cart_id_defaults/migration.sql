-- Belt-and-suspenders: guarantee carts / cart_items get DB-generated ids.
-- Fixes "null value in column id" when Prisma omits id on INSERT (e.g. old app build).
-- Uses literal '...'::regclass only (no column-ref ambiguity in DEFAULT).

CREATE OR REPLACE FUNCTION next_prefixed_id(prefix text, seq_name regclass)
RETURNS text
LANGUAGE SQL
VOLATILE
AS $fn$
  SELECT prefix || nextval(seq_name)::text;
$fn$;

CREATE SEQUENCE IF NOT EXISTS carts_id_seq;
CREATE SEQUENCE IF NOT EXISTS cart_items_id_seq;

ALTER TABLE "carts" ALTER COLUMN "id" SET DEFAULT next_prefixed_id('cart', 'carts_id_seq'::regclass);
ALTER TABLE "cart_items" ALTER COLUMN "id" SET DEFAULT next_prefixed_id('ci', 'cart_items_id_seq'::regclass);
