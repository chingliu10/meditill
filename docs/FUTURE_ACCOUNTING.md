# Future Accounting

Accounting is intentionally not in V1.

Recommended posting flow:
sale/purchase/expense committed -> accounting posting service -> journal entry -> balanced journal lines.

Example cash sale 100,000 with cost 60,000:
DR Cash 100,000 / CR Sales Revenue 100,000
DR COGS 60,000 / CR Inventory 60,000

Use append-only journals, reversals for corrections, fiscal period locks, and source_type/source_id links back to operational documents.
