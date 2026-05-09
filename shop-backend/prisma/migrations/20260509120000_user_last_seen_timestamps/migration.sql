-- Admin unread badges: nullable timestamps on users (schema drift fix)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastSeenOrdersAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastSeenUsersAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastSeenLeadsAt" TIMESTAMP(3);
