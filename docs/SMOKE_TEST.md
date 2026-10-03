# MediTill Core Smoke Test

Run this before UI redesign work. The goal is to prove the vertical slice:

medicine -> purchase -> batch -> stock -> register -> POS sale -> FEFO -> stock deduction -> report.

## Test data

Use one clean medicine:

- Name: Panadol 500mg
- Generic name: Paracetamol
- Strength: 500 mg
- Barcode: 123456789
- Selling price: 1000
- Reorder level: 10

Supplier:

- Name: Test Pharma Supplier

Purchase:

- Supplier: Test Pharma Supplier
- Medicine: Panadol 500mg
- Quantity: 100
- Unit cost: 600
- Selling price: 1000
- Batch: PN001
- Expiry: 2028-12-31
- Discount: 0
- Tax: 0

Register:

- Register 1
- Opening cash: 50000

Sale:

- Scan/type barcode: 123456789
- Quantity: 2
- Payment method: CASH
- Amount tendered: 5000
- Expected total: 2000
- Expected change: 3000

## Browser steps

### 1. Create the medicine

Go to Medicines -> Add medicine.

Expected:
- medicine saves
- list contains Panadol 500mg
- barcode 123456789 is visible/searchable

Server verification:

```bash
npm run smoke:core -- 123456789
```

At this stage it should say the medicine exists but no stock has been received.

### 2. Create supplier

Go to Suppliers and create Test Pharma Supplier.

### 3. Receive stock

Go to Purchases -> Receive stock and enter the purchase values above.

Expected:
- purchase number similar to PUR-000001
- success message
- Inventory shows 100 saleable units
- stock value should be TZS 60,000
- next expiry should be 2028-12-31

Run:

```bash
npm run smoke:core -- 123456789
```

Expected ledger:
- PURCHASE +100
- quantity_available = 100
- ledger_quantity = 100
- reconciliation PASS

### 4. Open register

Go to Registers.

Open Register 1 with TZS 50,000.

Expected:
- session status OPEN
- opening register movement = 50,000

### 5. Complete POS sale

Go to POS.

Type or scan:

```text
123456789
```

and press Enter.

Expected:
- Panadol is added to cart automatically
- set quantity to 2
- total = TZS 2,000
- CASH amount = 5,000
- complete sale
- change = TZS 3,000
- sale number similar to SALE-000001

### 6. Verify inventory

Inventory should now show:

```text
Panadol 500mg
Saleable stock: 98
Stock value: TZS 58,800
```

Run:

```bash
npm run smoke:core -- 123456789
```

Expected:
- PURCHASE +100
- SALE -2
- quantity_available = 98
- ledger_quantity = 98
- reconciliation PASS
- sale allocation references batch PN001

### 7. Verify report

Go to Reports -> Sales.

Expected for the test sale:

- Revenue: TZS 2,000
- Cost: TZS 1,200
- Gross profit: TZS 800
- Transactions: 1

If other test sales exist for the selected date, totals will include them.

### 8. Close register

Return to Registers.

With only this test transaction:

- opening cash = 50,000
- net cash sale = 2,000
- expected physical cash = 52,000

Enter actual cash 52,000.

Expected:
- expected = 52,000
- actual = 52,000
- difference = 0

## PM2 diagnostics

During the test you can watch:

```bash
/home/true/trueodds/node_modules/pm2/bin/pm2 logs meditill
```

Successful operations now log concise events:

- [PURCHASE] Received
- [REGISTER] Opened
- [SALE] Completed
- [REGISTER] Closed

No passwords are logged.
