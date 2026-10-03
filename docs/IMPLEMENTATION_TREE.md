# Implementation Tree

[x] Foundation
  [x] Node/Express
  [x] PostgreSQL pg/raw SQL
  [x] sessions
  [x] Handlebars layout
  [x] PWA shell

[x] Core schema
  [x] organizations/branches
  [x] users/roles/permissions
  [x] medicines/barcodes/units
  [x] suppliers/customers
  [x] purchases/batches/stock movements
  [x] registers/sessions/movements
  [x] sales/items/batch allocations/payments
  [x] returns/adjustments/transfers/counts schemas

[x] Core vertical slices
  [x] login/logout
  [x] branch scope
  [x] fast medicine creation
  [x] barcode lookup
  [x] purchase receiving
  [x] FEFO POS sale with FOR UPDATE
  [x] register open/close
  [x] sales/profit/stock report foundation

[ ] P1
  [ ] medicine edit/deactivate UX
  [ ] multiple barcode UX
  [ ] packaging conversion UX
  [ ] purchase payments/returns
  [ ] sale returns/refunds
  [ ] physical stock count
  [ ] branch transfers
  [ ] quarantine/recall
  [ ] expenses
  [ ] audit viewer
  [ ] thermal receipt

[ ] Production hardening
  [ ] CSRF
  [ ] rate limiting
  [ ] PostgreSQL integration tests
  [ ] backup/restore runbook
  [ ] HTTPS deployment
  [ ] real barcode scanner/printer validation
