# MediTill Architecture

MediTill is pharmacy-first: medicine -> batch -> branch -> stock movement -> purchase/sale/return/transfer/adjustment.

## Stack
Node.js, Express, PostgreSQL, pg, raw SQL, Handlebars, Bootstrap and vanilla JavaScript.

## Request flow
route -> controller -> service -> repository -> parameterized raw SQL -> PostgreSQL

Routes select middleware and controllers. Controllers handle HTTP. Services own business rules and transaction boundaries. Repositories own SQL.

## Non-negotiable rules
- No ORM or query builder.
- No TypeScript.
- No class-based service/repository architecture.
- Never store stock directly on medicines.
- Every inventory change produces a stock movement.
- Purchase receiving, sales, returns, transfers and adjustments are database transactions.
- Concurrent sale allocation uses SELECT ... FOR UPDATE.
- Sales use FEFO: earliest valid expiry first.
- Historical cost is captured in sale_item_batches.
- Branch scope and permissions are core.
- POS is touch/tablet friendly and barcode-first.
- Register sessions control physical cash.

## Future scaling
Accounting and HR are separate bounded modules. They link to operational source documents; they do not pollute pharmacy transaction tables.
