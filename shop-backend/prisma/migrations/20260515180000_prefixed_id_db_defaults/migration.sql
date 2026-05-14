-- Prisma uses @default(dbgenerated("next_prefixed_id(...)")) for string ids.
-- Initial SQL init created TEXT id columns without DB defaults; Prisma then omits `id` on INSERT → null violation.
-- This migration adds the function, sequences, and DEFAULT expressions (no data rewrite).

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

ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT next_prefixed_id('u', 'users_id_seq'::regclass);
ALTER TABLE "leads" ALTER COLUMN "id" SET DEFAULT next_prefixed_id('lead', 'leads_id_seq'::regclass);
ALTER TABLE "newsletter_leads" ALTER COLUMN "id" SET DEFAULT next_prefixed_id('nl', 'newsletter_leads_id_seq'::regclass);
ALTER TABLE "support_inquiries" ALTER COLUMN "id" SET DEFAULT next_prefixed_id('sup', 'support_inquiries_id_seq'::regclass);
ALTER TABLE "addresses" ALTER COLUMN "id" SET DEFAULT next_prefixed_id('addr', 'addresses_id_seq'::regclass);
ALTER TABLE "kh_provinces" ALTER COLUMN "id" SET DEFAULT next_prefixed_id('prov', 'kh_provinces_id_seq'::regclass);
ALTER TABLE "kh_districts" ALTER COLUMN "id" SET DEFAULT next_prefixed_id('dis', 'kh_districts_id_seq'::regclass);
ALTER TABLE "kh_communes" ALTER COLUMN "id" SET DEFAULT next_prefixed_id('cum', 'kh_communes_id_seq'::regclass);
ALTER TABLE "kh_villages" ALTER COLUMN "id" SET DEFAULT next_prefixed_id('vil', 'kh_villages_id_seq'::regclass);
ALTER TABLE "categories" ALTER COLUMN "id" SET DEFAULT next_prefixed_id('cate', 'categories_id_seq'::regclass);
ALTER TABLE "products" ALTER COLUMN "id" SET DEFAULT next_prefixed_id('pro', 'products_id_seq'::regclass);
ALTER TABLE "product_variants" ALTER COLUMN "id" SET DEFAULT next_prefixed_id('var', 'product_variants_id_seq'::regclass);
ALTER TABLE "carts" ALTER COLUMN "id" SET DEFAULT next_prefixed_id('cart', 'carts_id_seq'::regclass);
ALTER TABLE "cart_items" ALTER COLUMN "id" SET DEFAULT next_prefixed_id('ci', 'cart_items_id_seq'::regclass);
ALTER TABLE "orders" ALTER COLUMN "id" SET DEFAULT next_prefixed_id('ord', 'orders_id_seq'::regclass);
ALTER TABLE "order_items" ALTER COLUMN "id" SET DEFAULT next_prefixed_id('oi', 'order_items_id_seq'::regclass);
ALTER TABLE "reviews" ALTER COLUMN "id" SET DEFAULT next_prefixed_id('rev', 'reviews_id_seq'::regclass);
ALTER TABLE "wishlists" ALTER COLUMN "id" SET DEFAULT next_prefixed_id('wish', 'wishlists_id_seq'::regclass);
ALTER TABLE "coupons" ALTER COLUMN "id" SET DEFAULT next_prefixed_id('coup', 'coupons_id_seq'::regclass);
ALTER TABLE "advertisements" ALTER COLUMN "id" SET DEFAULT next_prefixed_id('ad', 'advertisements_id_seq'::regclass);
ALTER TABLE "seller_profiles" ALTER COLUMN "id" SET DEFAULT next_prefixed_id('seller', 'seller_profiles_id_seq'::regclass);
