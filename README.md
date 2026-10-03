# MediTill

**Pharmacy-first POS, medicine inventory and branch stock management.**

MediTill uses Node.js + Express + PostgreSQL + **raw SQL** + Handlebars + Bootstrap + vanilla JavaScript. There is no ORM and no TypeScript.

## Why this project exists
Generic POS systems make pharmacy workflows unnecessarily heavy. MediTill separates medicine identity from batches and branch inventory, keeps medicine creation short, makes barcode scanning first-class, tracks expiry/lot data and allocates stock using FEFO.

## Current foundation
- session login
- roles/permissions schema and middleware
- branch-scoped users and inventory
- fast medicine creation
- barcode lookup
- suppliers
- purchase receiving
- medicine batches + expiry
- immutable stock movement ledger
- touch/tablet POS
- register opening/closing APIs
- FEFO sale allocation
- PostgreSQL `FOR UPDATE` stock locking
- cash/mobile/card payment foundation
- historical cost capture by sold batch
- sales/profit report foundation
- stock valuation/expiry APIs
- PWA shell (online POS; offline sales are not implemented)

See `docs/IMPLEMENTATION_TREE.md` for what is complete and what remains.

## Architecture

```text
route -> controller -> service -> repository -> raw parameterized SQL -> PostgreSQL
```

Read `AGENTS.md` before using any coding agent on this repository.

## Setup

```bash
cp .env.example .env
npm install
createdb meditill
npm run db:migrate
SEED_ADMIN_PASSWORD='choose-a-strong-password' npm run db:seed
npm start
```

Open `http://localhost:3000`.

Seed username: `admin`.

If you seed without `SEED_ADMIN_PASSWORD`, the development fallback is `ChangeMe123!`; change it immediately.

## Database principles
- Raw SQL only through `pg`.
- Parameterized queries only.
- PostgreSQL constraints protect important invariants.
- Inventory business operations use database transactions.
- Concurrent sales lock batch rows.
- Never store current stock on `medicines`.
- Every stock change has a movement reason.
- Cost/profit history is preserved at sale-batch allocation time.

## Accounting and HR later
The schema is intentionally modular. Accounting and HR are not part of V1, but can be added without rewriting the pharmacy core. See `docs/FUTURE_ACCOUNTING.md` and `docs/FUTURE_HR.md`.

## Production note
This is a strong application foundation, not yet a finished production pharmacy deployment. Before real-money production use, complete the unchecked security/testing/receipt/returns items in `docs/IMPLEMENTATION_TREE.md`.
