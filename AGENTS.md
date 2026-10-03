# MediTill engineering contract

This file is mandatory guidance for any AI coding agent working in this repository.

## Fixed stack
- Node.js + Express.js
- PostgreSQL
- `pg` driver
- Handlebars server-rendered views
- Bootstrap + vanilla JavaScript
- CommonJS modules

## Non-negotiable database rule
**RAW SQL ONLY.** Do not add Prisma, Sequelize, TypeORM, Drizzle, Knex, an ORM, or a query builder.
Use parameterized PostgreSQL queries (`$1`, `$2`, ...), database constraints, indexes, CTEs, transactions, and row locking where appropriate.

## JavaScript style
Use plain functions, plain objects, arrays, maps, sets, modules, and `async/await`.
Do not introduce classes unless the repository architecture is intentionally revised by the owner. Do not introduce TypeScript.

## Module architecture
Every business module follows:

`route -> controller -> service -> repository -> raw SQL -> PostgreSQL`

- Routes: URL + middleware + controller only.
- Controllers: HTTP parsing and response only.
- Services: business rules and transaction orchestration.
- Repositories: SQL and persistence only.
- Never put SQL in controllers.
- Never put HTTP response logic in repositories.

## Pharmacy domain rules
MediTill is pharmacy-first. The primary chain is:

`medicine -> batch -> branch -> stock movement -> purchase/sale/return/transfer/adjustment`

- Stock is never stored directly on `medicines`.
- Batch stock is branch-specific.
- Every stock change must have a `stock_movements` record.
- Sales allocate stock FEFO (first-expiry-first-out).
- Expired, quarantined, damaged, recalled, and depleted batches cannot be sold.
- Sale/purchase inventory operations must be database transactions.
- Concurrent sale allocation must lock batch rows using `FOR UPDATE`.
- Historical sale cost comes from `sale_item_batches.unit_cost`, never today's cost.
- Barcode scanning is a first-class workflow.
- Multi-branch scope and permissions are core, not later patches.

## Scope control
Do not implement HR, payroll, full accounting, hospital records, insurance, ecommerce, offline sales sync, or AI unless explicitly requested. The core schema is designed so those can be added later.
