# Database Design

## Core
organizations, branches, users, roles, permissions, user_roles, role_permissions, user_branches.

## Medicine
categories, manufacturers, units, medicines, medicine_barcodes, medicine_units.

Medicine identity is separate from physical stock. Expiry, lot, cost and quantity belong to batches.

## Procurement / inventory
suppliers, purchases, purchase_items, medicine_batches, stock_movements.

## POS / cash
customers, registers, register_sessions, register_movements, sales, sale_items, sale_item_batches, sale_payments.

## Controls
sale_returns, sale_return_items, stock_adjustments, stock_adjustment_items, stock_transfers, stock_transfer_items, stock_counts, stock_count_items, expenses, audit_logs, settings, document_sequences.

## Future Accounting
Add chart_of_accounts, fiscal_periods, journal_entries, journal_lines, bank_accounts and accounting_settings. Journal entries reference source_type/source_id such as SALE or PURCHASE.

## Future HR
Add employees, departments, positions, employee_branches, shifts, attendance, leave_requests, payroll_periods, payroll_runs and payroll_items. employees.user_id should be nullable.
