-- Integration fixture for an empty, migrated, isolated test database.
\set ON_ERROR_STOP on

INSERT INTO organizations(name) VALUES('Report Fixture Test');
INSERT INTO branches(organization_id,name,code)
SELECT 1,'Test Branch ' || g,'TEST' || g FROM generate_series(1,4) g;
INSERT INTO users(organization_id,default_branch_id,name,username,password_hash)
VALUES(1,1,'Test Owner','admin','test-owner-password-hash');
INSERT INTO roles(organization_id,name) VALUES(1,'OWNER');
INSERT INTO user_roles(user_id,role_id) VALUES(1,1);
INSERT INTO user_branches(user_id,branch_id) SELECT 1,id FROM branches;
INSERT INTO permissions(code) VALUES
  ('medicine.view'),('customer.view'),('customer.manage'),('sale.create'),('sale.view'),
  ('sale.refund'),('sale.discount'),('sales.receipt'),('register.open'),('register.close'),
  ('register.cash_in'),('register.cash_out'),('inventory.view'),('reports.sales'),('reports.inventory')
ON CONFLICT DO NOTHING;
INSERT INTO registers(branch_id,name) VALUES(1,'Existing Register');
INSERT INTO register_sessions(register_id,branch_id,user_id,opening_cash)
VALUES(1,1,1,12345);
INSERT INTO register_movements(register_session_id,movement_type,amount,performed_by)
VALUES(1,'OPENING',12345,1);

\ir ../seed-report-demo.sql
\ir ../seed-report-demo.sql

DO $checks$
DECLARE
  br record;
BEGIN
  IF (SELECT count(*) FROM medicines)<>40 OR (SELECT count(*) FROM customers)<>40
    OR (SELECT count(*) FROM suppliers)<>20 THEN
    RAISE EXCEPTION 'Master data counts incorrect';
  END IF;
  IF (SELECT count(*) FROM users WHERE username LIKE 'demo_1_b%')<>8 THEN
    RAISE EXCEPTION 'Expected two demo cashiers per branch';
  END IF;
  IF EXISTS (
    SELECT 1 FROM users WHERE username LIKE 'demo_1_b%' AND password_hash<>'test-owner-password-hash'
  ) THEN RAISE EXCEPTION 'Cashier password hashes were not copied correctly'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM register_sessions WHERE id=1 AND status='OPEN' AND opening_cash=12345
  ) THEN RAISE EXCEPTION 'Existing open session was changed'; END IF;

  FOR br IN SELECT id FROM branches LOOP
    IF (SELECT count(*) FROM purchases WHERE branch_id=br.id)<>40
      OR (SELECT count(*) FROM sales WHERE branch_id=br.id)<>50
      OR (SELECT count(*) FROM expenses WHERE branch_id=br.id)<>30
      OR (SELECT count(*) FROM sale_returns WHERE branch_id=br.id)<>20
      OR (SELECT count(*) FROM purchase_returns WHERE branch_id=br.id)<>20
      OR (SELECT count(*) FROM stock_adjustments WHERE branch_id=br.id)<>20
      OR (SELECT count(*) FROM stock_counts WHERE branch_id=br.id)<>20
      OR (SELECT count(*) FROM stock_transfers WHERE from_branch_id=br.id)<>20
      OR (SELECT count(*) FROM medicine_batches WHERE branch_id=br.id AND status='EXPIRED')<>20
      OR (SELECT count(*) FROM medicine_batches WHERE branch_id=br.id AND status='DEPLETED')<>5
      OR (SELECT count(*) FROM register_sessions WHERE branch_id=br.id AND status='CLOSED')<>50 THEN
      RAISE EXCEPTION 'Branch % record counts incorrect',br.id;
    END IF;
    IF (SELECT count(DISTINCT user_id) FROM sales WHERE branch_id=br.id)<>2 THEN
      RAISE EXCEPTION 'Sales do not cover both branch cashiers';
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM medicine_batches b
    WHERE b.quantity_available<>(SELECT COALESCE(sum(quantity),0) FROM stock_movements WHERE batch_id=b.id)
  ) THEN RAISE EXCEPTION 'Stock ledger mismatch'; END IF;
  IF EXISTS (
    SELECT 1 FROM sales s JOIN sale_items si ON si.sale_id=s.id
    JOIN sale_item_batches sib ON sib.sale_item_id=si.id
    JOIN medicine_batches b ON b.id=sib.batch_id
    WHERE b.branch_id<>s.branch_id OR b.status<>'SALEABLE'
      OR b.expiry_date<s.created_at::date OR b.received_at>s.created_at
      OR sib.unit_cost<>b.unit_cost
  ) THEN RAISE EXCEPTION 'Sale allocation is invalid'; END IF;
  IF EXISTS (
    SELECT 1 FROM sales s JOIN users u ON u.id=s.user_id
    JOIN register_sessions rs ON rs.id=s.register_session_id
    WHERE u.organization_id<>s.organization_id OR rs.user_id<>s.user_id
      OR rs.branch_id<>s.branch_id OR s.created_at<rs.opened_at OR s.created_at>rs.closed_at
      OR NOT EXISTS (SELECT 1 FROM user_branches WHERE user_id=u.id AND branch_id=s.branch_id)
  ) THEN RAISE EXCEPTION 'Sale cashier or register scope is invalid'; END IF;
  IF EXISTS (
    SELECT 1 FROM sales s
    WHERE s.subtotal<>(SELECT sum(line_total) FROM sale_items WHERE sale_id=s.id)
      OR s.total<>s.subtotal-s.discount+s.tax
      OR s.amount_paid<>(SELECT sum(amount) FROM sale_payments WHERE sale_id=s.id)
  ) THEN RAISE EXCEPTION 'Sale totals mismatch'; END IF;
  IF EXISTS (
    SELECT 1 FROM purchases p
    WHERE p.total<>(SELECT sum(line_total) FROM purchase_items WHERE purchase_id=p.id)
      OR (p.payment_status='PAID' AND p.total<>(SELECT sum(amount) FROM purchase_payments WHERE purchase_id=p.id))
      OR (p.payment_status='PARTIAL' AND round(p.total/2,2)<>(SELECT sum(amount) FROM purchase_payments WHERE purchase_id=p.id))
      OR (p.payment_status='UNPAID' AND EXISTS(SELECT 1 FROM purchase_payments WHERE purchase_id=p.id))
  ) THEN RAISE EXCEPTION 'Purchase totals mismatch'; END IF;
  IF EXISTS (
    SELECT 1 FROM sale_returns sr
    WHERE sr.total_refund<>(SELECT sum(refund_amount) FROM sale_return_items WHERE sale_return_id=sr.id)
  ) THEN RAISE EXCEPTION 'Refund totals mismatch'; END IF;
  IF EXISTS (
    SELECT 1 FROM register_sessions rs WHERE rs.status='CLOSED'
      AND (rs.expected_cash<>(SELECT sum(CASE WHEN movement_type IN('OPENING','CASH_SALE','CASH_IN')
        THEN amount ELSE -amount END) FROM register_movements WHERE register_session_id=rs.id)
        OR rs.actual_cash<>rs.expected_cash+rs.difference)
  ) THEN RAISE EXCEPTION 'Cash drawer reconciliation mismatch'; END IF;
  IF EXISTS (
    SELECT 1 FROM stock_transfers st JOIN stock_transfer_items sti ON sti.transfer_id=st.id
    WHERE sti.quantity<>(SELECT sum(quantity) FROM stock_movements WHERE reference_type='TRANSFER'
      AND reference_id=st.id AND movement_type='TRANSFER_IN')
      OR -sti.quantity<>(SELECT sum(quantity) FROM stock_movements WHERE reference_type='TRANSFER'
      AND reference_id=st.id AND movement_type='TRANSFER_OUT')
  ) THEN RAISE EXCEPTION 'Transfer ledger mismatch'; END IF;
  IF (SELECT count(*) FROM audit_logs WHERE action='DEMO_REPORT_SEED')<>1 THEN
    RAISE EXCEPTION 'Repeated execution duplicated seed marker';
  END IF;
  RAISE NOTICE 'PASS: counts, repeat execution, branch/cashier scope, inventory, payments, returns, transfers, register cash and existing open session';
END;
$checks$;

SELECT b.name,
  (SELECT count(*) FROM sales WHERE branch_id=b.id) AS sales,
  (SELECT count(*) FROM purchases WHERE branch_id=b.id) AS purchases,
  (SELECT count(*) FROM medicine_batches WHERE branch_id=b.id AND status='EXPIRED') AS expired_batches,
  (SELECT count(*) FROM expenses WHERE branch_id=b.id) AS expenses
FROM branches b ORDER BY b.id;
