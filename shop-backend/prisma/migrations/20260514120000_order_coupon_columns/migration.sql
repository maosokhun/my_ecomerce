-- Order coupon snapshot columns (were in schema but missing from earlier migrations)
ALTER TABLE "orders" ADD COLUMN "couponCode" TEXT;
ALTER TABLE "orders" ADD COLUMN "couponDiscountType" TEXT;
ALTER TABLE "orders" ADD COLUMN "couponDiscountValue" DOUBLE PRECISION;
