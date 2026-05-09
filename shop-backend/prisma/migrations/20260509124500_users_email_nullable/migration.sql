-- Registration: email optional (match Prisma schema String?)
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
