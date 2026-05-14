-- Prisma uses @default(dbgenerated("next_prefixed_id(...)")) for string ids.
-- Initial SQL init created TEXT id columns without DB defaults; Prisma then omits `id` on INSERT → null violation.
-- This migration adds the function, sequences, and DEFAULT expressions (no data rewrite).
-- ALTER runs only for tables that exist (production DBs may lag schema).

CREATE OR REPLACE FUNCTION next_prefixed_id(prefix text, seq_name regclass)
RETURNS text
LANGUAGE SQL
VOLATILE
AS $fn$
  SELECT prefix || nextval(seq_name)::text;
$fn$;

CREATE SEQUENCE IF NOT EXISTS users_id_seq;
CREATE SEQUENCE IF NOT EXISTS leads_id_seq;
CREATE SEQUENCE IF NOT EXISTS newsletter_leads_id_seq;
CREATE SEQUENCE IF NOT EXISTS support_inquiries_id_seq;
CREATE SEQUENCE IF NOT EXISTS addresses_id_seq;
CREATE SEQUENCE IF NOT EXISTS kh_provinces_id_seq;
CREATE SEQUENCE IF NOT EXISTS kh_districts_id_seq;
CREATE SEQUENCE IF NOT EXISTS kh_communes_id_seq;
CREATE SEQUENCE IF NOT EXISTS kh_villages_id_seq;
CREATE SEQUENCE IF NOT EXISTS categories_id_seq;
CREATE SEQUENCE IF NOT EXISTS products_id_seq;
CREATE SEQUENCE IF NOT EXISTS product_variants_id_seq;
CREATE SEQUENCE IF NOT EXISTS carts_id_seq;
CREATE SEQUENCE IF NOT EXISTS cart_items_id_seq;
CREATE SEQUENCE IF NOT EXISTS orders_id_seq;
CREATE SEQUENCE IF NOT EXISTS order_items_id_seq;
CREATE SEQUENCE IF NOT EXISTS reviews_id_seq;
CREATE SEQUENCE IF NOT EXISTS wishlists_id_seq;
CREATE SEQUENCE IF NOT EXISTS coupons_id_seq;
CREATE SEQUENCE IF NOT EXISTS advertisements_id_seq;
CREATE SEQUENCE IF NOT EXISTS seller_profiles_id_seq;

CREATE OR REPLACE FUNCTION __prisma_tmp_set_prefixed_default(p_table text, p_prefix text, p_seq text)
RETURNS void
LANGUAGE plpgsql
AS $helper$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = p_table
  ) THEN
    -- %L::regclass for sequence name: bare %I is parsed as a column on the target table (0A000).
    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN id SET DEFAULT next_prefixed_id(%L, %L::regclass)',
      'public',
      p_table,
      p_prefix,
      p_seq
    );
  END IF;
END;
$helper$;

SELECT __prisma_tmp_set_prefixed_default('users', 'u', 'users_id_seq');
SELECT __prisma_tmp_set_prefixed_default('leads', 'lead', 'leads_id_seq');
SELECT __prisma_tmp_set_prefixed_default('newsletter_leads', 'nl', 'newsletter_leads_id_seq');
SELECT __prisma_tmp_set_prefixed_default('support_inquiries', 'sup', 'support_inquiries_id_seq');
SELECT __prisma_tmp_set_prefixed_default('addresses', 'addr', 'addresses_id_seq');
SELECT __prisma_tmp_set_prefixed_default('kh_provinces', 'prov', 'kh_provinces_id_seq');
SELECT __prisma_tmp_set_prefixed_default('kh_districts', 'dis', 'kh_districts_id_seq');
SELECT __prisma_tmp_set_prefixed_default('kh_communes', 'cum', 'kh_communes_id_seq');
SELECT __prisma_tmp_set_prefixed_default('kh_villages', 'vil', 'kh_villages_id_seq');
SELECT __prisma_tmp_set_prefixed_default('categories', 'cate', 'categories_id_seq');
SELECT __prisma_tmp_set_prefixed_default('products', 'pro', 'products_id_seq');
SELECT __prisma_tmp_set_prefixed_default('product_variants', 'var', 'product_variants_id_seq');
SELECT __prisma_tmp_set_prefixed_default('carts', 'cart', 'carts_id_seq');
SELECT __prisma_tmp_set_prefixed_default('cart_items', 'ci', 'cart_items_id_seq');
SELECT __prisma_tmp_set_prefixed_default('orders', 'ord', 'orders_id_seq');
SELECT __prisma_tmp_set_prefixed_default('order_items', 'oi', 'order_items_id_seq');
SELECT __prisma_tmp_set_prefixed_default('reviews', 'rev', 'reviews_id_seq');
SELECT __prisma_tmp_set_prefixed_default('wishlists', 'wish', 'wishlists_id_seq');
SELECT __prisma_tmp_set_prefixed_default('coupons', 'coup', 'coupons_id_seq');
SELECT __prisma_tmp_set_prefixed_default('advertisements', 'ad', 'advertisements_id_seq');
SELECT __prisma_tmp_set_prefixed_default('seller_profiles', 'seller', 'seller_profiles_id_seq');

DROP FUNCTION __prisma_tmp_set_prefixed_default(text, text, text);
