# MediTill

**Pharmacy-first POS, inventory, purchasing, branch stock and cashier management.**

MediTill uses Node.js, Express, PostgreSQL, `pg`, **raw parameterized SQL**, Handlebars, vanilla JavaScript and a custom raw-CSS UI. There is no ORM, no TypeScript and no class-based service/repository architecture.

## V1 capabilities

### Pharmacy master data
- medicines, generic/brand/strength/dosage information
- categories, manufacturers and configurable units
- whole-number vs fractional quantity rules
- multiple barcodes per medicine
- package conversions such as strip/box -> base tablets
- package barcode and package selling price
- optional medicine image path/URL with a built-in default medicine image
- edit and safe deactivate workflow

### Purchasing
- searchable supplier selection
- searchable medicine selection
- batch/lot, manufacturing date and expiry capture
- purchase receiving inside one PostgreSQL transaction
- supplier payment tracking
- cash supplier payments tied to the open register
- purchase returns to supplier
- purchase-return stock movements

### Inventory
- branch + batch inventory
- FEFO-ready batch data
- immutable stock movement ledger
- low-stock/out-of-stock visibility
- expiry and value-at-risk views
- stock adjustments
- physical stock counts
- quarantine, recall, damage and saleable batch states
- branch transfers with explicit in-transit and destination receipt

### POS and sales
- touch/tablet-oriented POS
- barcode-first workflow
- product tiles and default medicine image
- customer lookup
- base-unit and package-barcode sales
- FEFO allocation with `SELECT ... FOR UPDATE`
- cash, mobile money, card and bank payments
- register requirement for sales
- recent sales
- 80mm receipt view/printing
- sales history and detail
- partial/full sale returns
- return-to-stock, quarantine or damaged disposition
- cash refunds tied to the register
- net-of-return sales/profit reporting

### Cash and administration
- open/close/reconcile registers
- expenses, including cash-drawer expense movements
- branches and branch access
- users
- roles and granular permissions
- customers and suppliers
- pharmacy/branch settings
- dashboard and reports

## Architecture

```text
route
  -> middleware
  -> controller
  -> service
  -> repository
  -> raw parameterized SQL
  -> PostgreSQL
```

Important invariants:

- Never store current stock directly on `medicines`.
- Every inventory mutation produces a stock movement.
- Sales, purchases, returns, transfers, counts and adjustments use transactions.
- Sales allocate valid stock FEFO and lock batch rows during allocation.
- Historical batch cost is preserved for profit reporting.
- Inventory is always branch scoped.
- Countable units reject fractions; measured units can allow them.
- Accounting and HR remain separate future bounded modules.

Read `AGENTS.md`, `docs/ARCHITECTURE.md` and `docs/DATABASE.md` before making architectural changes.

## Local setup

```bash
cp .env.example .env
npm install
createdb meditill
npm run db:migrate
SEED_ADMIN_PASSWORD='choose-a-strong-password' npm run db:seed
npm start
```

Seed username: `admin`.

## Existing server deployment

For the current Solidus Logic deployment:

```bash
cd ~/apps/meditill
git pull
npm install
npm run db:migrate
npm run check
/home/true/trueodds/node_modules/pm2/bin/pm2 restart meditill
```

After migrations 005+ are installed, **log out and sign in again once**. Permissions are stored in the user session, and the new V1 permissions must be reloaded.

See `docs/DEPLOYMENT.md` for deployment, backup and rollback instructions.

## Deliberately future work

The pharmacy POS V1 is complete enough for operational testing. These are intentionally separate future phases rather than unfinished core pharmacy flows:

- full Accounting/general ledger module
- HR/payroll/attendance
- offline sales synchronization
- GS1 healthcare DataMatrix parsing
- native mobile applications
- image binary upload/storage service (V1 accepts an image path/URL and always has a default image)
- broader audit logging/viewer
- CSRF/rate-limit hardening and automated integration test suite

See `docs/FUTURE_ACCOUNTING.md` and `docs/FUTURE_HR.md`.
