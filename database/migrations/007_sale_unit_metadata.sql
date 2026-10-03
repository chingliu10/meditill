ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS medicine_unit_id bigint REFERENCES medicine_units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sale_unit_name varchar(80),
  ADD COLUMN IF NOT EXISTS sale_unit_quantity numeric(18,4),
  ADD COLUMN IF NOT EXISTS conversion_to_base numeric(18,4),
  ADD COLUMN IF NOT EXISTS sale_unit_price numeric(18,2);

UPDATE sale_items
SET sale_unit_quantity=COALESCE(sale_unit_quantity,quantity),
    conversion_to_base=COALESCE(conversion_to_base,1),
    sale_unit_price=COALESCE(sale_unit_price,unit_price)
WHERE sale_unit_quantity IS NULL OR conversion_to_base IS NULL OR sale_unit_price IS NULL;
