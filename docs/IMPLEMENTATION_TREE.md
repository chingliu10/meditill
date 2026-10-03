# MediTill Implementation Tree

## [x] Foundation
- [x] Node.js / Express
- [x] PostgreSQL / pg / raw SQL
- [x] sessions
- [x] Handlebars
- [x] custom raw-CSS application shell
- [x] responsive desktop/tablet/mobile navigation
- [x] toast notifications
- [x] confirmation modal
- [x] PWA shell, online-first

## [x] Organization and access
- [x] organizations
- [x] branches
- [x] branch switching
- [x] branch creation
- [x] users
- [x] roles
- [x] granular permissions
- [x] per-user branch access
- [x] account enable/disable
- [x] pharmacy and branch settings
- [x] multiple registers per branch

## [x] Medicine master
- [x] medicine create
- [x] medicine edit
- [x] safe deactivate
- [x] categories
- [x] manufacturers
- [x] units
- [x] whole/fractional quantity rule
- [x] generic / brand / strength / dosage form
- [x] SKU
- [x] prescription-required flag
- [x] expiry-tracking flag
- [x] multiple barcodes
- [x] package conversions
- [x] package barcode
- [x] package selling price
- [x] image path/URL
- [x] default medicine artwork

## [x] Procurement
- [x] suppliers
- [x] searchable supplier picker
- [x] searchable medicine picker
- [x] purchase receiving
- [x] batch number
- [x] manufacturing date
- [x] expiry date
- [x] purchase cost
- [x] selling price at receipt
- [x] supplier payment tracking
- [x] cash supplier payment -> register CASH_OUT
- [x] purchase returns
- [x] purchase-return stock movements
- [x] net supplier payable after returns

## [x] Inventory
- [x] branch/batch stock
- [x] stock movement ledger
- [x] stock valuation
- [x] low stock
- [x] out of stock
- [x] expiry risk
- [x] FEFO ordering
- [x] stock adjustment
- [x] physical stock count
- [x] stock-count corrective movements
- [x] quarantine
- [x] recall
- [x] damaged stock
- [x] branch transfer out
- [x] in-transit state
- [x] destination receipt
- [x] transfer-in stock movement

## [x] POS and sales
- [x] tablet/touch layout
- [x] barcode scan -> automatic cart add
- [x] medicine search
- [x] medicine cards
- [x] default product image
- [x] customer search
- [x] register required
- [x] base-unit sales
- [x] package-barcode sales
- [x] package quantity conversion
- [x] FEFO allocation
- [x] SELECT FOR UPDATE concurrency locking
- [x] cash payment
- [x] mobile-money payment
- [x] card payment
- [x] bank payment
- [x] cash change handling
- [x] sales history
- [x] sale detail
- [x] recent transactions
- [x] 80mm receipt
- [x] partial/full sale return
- [x] return to stock
- [x] quarantine returned stock
- [x] damaged returned stock
- [x] cash refund -> register movement
- [x] package-aware return quantities

## [x] Cash operations
- [x] open register
- [x] opening cash
- [x] expected cash
- [x] actual closing cash
- [x] difference/variance
- [x] cash sale
- [x] cash refund
- [x] cash supplier payment
- [x] cash expense
- [x] expenses

## [x] Reporting
- [x] dashboard
- [x] sales report
- [x] gross-profit report using historical batch cost
- [x] return-adjusted revenue and COGS
- [x] inventory valuation
- [x] purchase report
- [x] purchase-return-adjusted totals
- [x] expiry report
- [x] top-selling medicines
- [x] expiry-risk dashboard
- [x] recent sales

## [ ] Future platform hardening / expansion
These are not required for the completed pharmacy V1 business flow.

- [ ] full CSRF middleware
- [ ] application rate limiting
- [ ] automated PostgreSQL integration tests
- [ ] broader entity-level audit coverage and audit viewer
- [ ] binary image upload/storage service
- [ ] GS1 DataMatrix parser
- [ ] offline POS synchronization
- [ ] native mobile apps
- [ ] Accounting / general ledger
- [ ] HR / payroll / attendance
