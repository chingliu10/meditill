-- Pharmacy quantities are unit-dependent.
-- Countable presentation units stay whole-number; measured units may be fractional.
UPDATE units
SET allow_fraction = true
WHERE lower(name) IN (
  'millilitre','milliliter','litre','liter','gram','kilogram',
  'milligram','microgram'
)
OR lower(COALESCE(symbol,'')) IN ('ml','l','g','kg','mg','mcg','ug');
