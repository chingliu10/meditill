ALTER TABLE sale_returns
  ADD COLUMN IF NOT EXISTS refund_method varchar(30),
  ADD COLUMN IF NOT EXISTS refund_reference varchar(180);

DO $$ BEGIN
  ALTER TABLE sale_returns ADD CONSTRAINT chk_sale_returns_refund_method
  CHECK(refund_method IS NULL OR refund_method IN('CASH','MOBILE_MONEY','CARD','BANK'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
