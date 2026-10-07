-- Run in psql: \i /home/true/apps/meditill/database/seed-report-demo.sql
-- Change target_org below to seed another existing organization.
-- Demo cashier accounts use the existing owner's password hash.
BEGIN;

DO $demo$
<<fixture>>
DECLARE
  target_org bigint := 1;
  prefix text := 'DEMO-RICH-' || target_org;
  seed_date date;
  owner_id bigint;
  owner_hash text;
  org_timezone text;
  unit_id bigint;
  role_id bigint;
  category_ids bigint[] := ARRAY[]::bigint[];
  supplier_ids bigint[] := ARRAY[]::bigint[];
  customer_ids bigint[] := ARRAY[]::bigint[];
  medicine_names text[] := ARRAY[
    'Paracetamol 500 mg','Ibuprofen 200 mg','Aspirin 75 mg','Cetirizine 10 mg',
    'Loratadine 10 mg','Vitamin C 500 mg','Vitamin D3 1000 IU','Zinc 20 mg',
    'Oral Rehydration Salts','Folic Acid 5 mg','Amoxicillin 500 mg','Azithromycin 250 mg',
    'Metformin 500 mg','Amlodipine 5 mg','Losartan 50 mg','Omeprazole 20 mg',
    'Pantoprazole 40 mg','Calcium 500 mg','Iron Supplement','Multivitamin Tablets',
    'Diclofenac 50 mg','Naproxen 250 mg','Loperamide 2 mg','Albendazole 400 mg',
    'Mebendazole 100 mg','Doxycycline 100 mg','Fluconazole 150 mg','Clotrimazole Cream',
    'Hydrocortisone Cream','Antiseptic Solution','Saline Nasal Spray','Cough Syrup',
    'Glycerin Suppositories','Glucose Tablets','Magnesium Supplement','Vitamin B Complex',
    'Eye Lubricant Drops','Sterile Gauze','Adhesive Bandages','Digital Thermometer'
  ];
  category_names text[] := ARRAY[
    'Pain Relief','Allergy','Vitamins','Digestive Care',
    'Antibiotics','Chronic Care','Skin Care','First Aid'
  ];
  g integer;
  k integer;
  med_index integer;
  cashier_id bigint;
  purchase_id bigint;
  item_id bigint;
  batch_id bigint;
  sale_id bigint;
  sale_item_id bigint;
  session_id bigint;
  return_id bigint;
  adjustment_id bigint;
  transfer_id bigint;
  target_batch_id bigint;
  count_id bigint;
  expense_id bigint;
  inserted_id bigint;
  receive_at timestamptz;
  open_at timestamptz;
  sale_at timestamptz;
  work_at timestamptz;
  expiry date;
  batch_status text;
  method text;
  qty numeric;
  extra_qty numeric;
  refund_qty numeric;
  unit_cost numeric;
  price numeric;
  subtotal numeric;
  discount numeric;
  total numeric;
  refund numeric;
  delta numeric;
  branch_count integer;
  br record;
  med record;
  batch record;
  dest record;
BEGIN
  SELECT timezone INTO org_timezone
  FROM organizations WHERE id=target_org AND active=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active organization % not found',target_org; END IF;

  IF EXISTS (
    SELECT 1 FROM audit_logs
    WHERE organization_id=target_org AND action='DEMO_REPORT_SEED' AND entity_type=prefix
  ) THEN
    RAISE NOTICE 'Demo dataset already exists for organization %. Nothing added.',target_org;
    RETURN;
  END IF;

  PERFORM set_config('TimeZone',org_timezone,true);
  seed_date := current_date;
  SELECT u.id,u.password_hash INTO owner_id,owner_hash
  FROM users u
  WHERE u.organization_id=target_org AND u.active=true
    AND EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id
      WHERE ur.user_id=u.id AND r.name='OWNER' AND r.organization_id=target_org
    )
  ORDER BY u.id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'An active OWNER is required in organization %',target_org; END IF;

  CREATE TEMP TABLE demo_branches (
    id bigint PRIMARY KEY,name text,cashier_1 bigint,cashier_2 bigint,register_id bigint
  ) ON COMMIT DROP;
  INSERT INTO demo_branches(id,name)
  SELECT id,name FROM branches WHERE organization_id=target_org AND active=true;
  GET DIAGNOSTICS branch_count = ROW_COUNT;
  IF branch_count=0 THEN RAISE EXCEPTION 'No active branches found'; END IF;

  CREATE TEMP TABLE demo_medicines (
    ordinal integer PRIMARY KEY,id bigint,price numeric,cost numeric
  ) ON COMMIT DROP;
  CREATE TEMP TABLE demo_batches (
    branch_id bigint,ordinal integer,purchase_id bigint,item_id bigint,batch_id bigint,
    PRIMARY KEY(branch_id,ordinal)
  ) ON COMMIT DROP;
  CREATE TEMP TABLE demo_sessions (id bigint PRIMARY KEY,ordinal integer) ON COMMIT DROP;

  INSERT INTO units(organization_id,name,symbol)
  VALUES(target_org,'Demo Unit','du')
  ON CONFLICT(organization_id,name) DO UPDATE SET allow_fraction=false
  RETURNING id INTO unit_id;

  FOR g IN 1..8 LOOP
    INSERT INTO categories(organization_id,name)
    VALUES(target_org,'Demo - ' || category_names[g])
    ON CONFLICT(organization_id,name) DO UPDATE SET active=true
    RETURNING id INTO inserted_id;
    category_ids := array_append(category_ids,inserted_id);
  END LOOP;

  FOR g IN 1..20 LOOP
    INSERT INTO suppliers(organization_id,name,contact_person,phone,email,address,notes)
    VALUES(target_org,'Demo Supplier ' || lpad(g::text,2,'0'),
      'Demo Contact ' || g,'+255700' || lpad(g::text,6,'0'),
      'supplier' || g || '@demo.invalid','Synthetic supplier address',prefix)
    RETURNING id INTO inserted_id;
    supplier_ids := array_append(supplier_ids,inserted_id);
  END LOOP;

  FOR g IN 1..40 LOOP
    INSERT INTO customers(organization_id,name,phone,email,address)
    VALUES(target_org,'Demo Customer ' || lpad(g::text,2,'0'),
      '+255710' || lpad(g::text,6,'0'),'customer' || g || '@demo.invalid',
      'Synthetic customer address') RETURNING id INTO inserted_id;
    customer_ids := array_append(customer_ids,inserted_id);

    unit_cost := 500+(g%10)*150;
    price := unit_cost*1.6+200;
    INSERT INTO medicines(
      organization_id,category_id,base_unit_id,name,generic_name,brand_name,sku,
      default_selling_price,reorder_level,prescription_required,description,created_by
    ) VALUES(
      target_org,category_ids[1+(g-1)%8],unit_id,'Demo - ' || medicine_names[g],
      medicine_names[g],'Demo Pharmacy',prefix || '-M' || lpad(g::text,2,'0'),
      price,10,g BETWEEN 11 AND 17,'Synthetic report fixture',owner_id
    ) RETURNING id INTO inserted_id;
    INSERT INTO demo_medicines VALUES(g,inserted_id,price,unit_cost);
    INSERT INTO medicine_barcodes(medicine_id,barcode,barcode_type,is_primary)
    VALUES(inserted_id,prefix || '-BAR' || lpad(g::text,2,'0'),'CODE128',true);
    INSERT INTO medicine_units(medicine_id,name,conversion_to_base,barcode,selling_price)
    VALUES(inserted_id,'Box of 10',10,prefix || '-BOX' || lpad(g::text,2,'0'),price*9);
  END LOOP;

  INSERT INTO roles(organization_id,name,description)
  VALUES(target_org,'DEMO CASHIER','Cashiers for synthetic branch reports')
  ON CONFLICT(organization_id,name) DO UPDATE SET description=EXCLUDED.description
  RETURNING id INTO role_id;
  INSERT INTO role_permissions(role_id,permission_id)
  SELECT role_id,id FROM permissions WHERE code IN (
    'medicine.view','customer.view','customer.manage','sale.create','sale.view','sale.refund',
    'sale.discount','sales.receipt','register.open','register.close','register.cash_in',
    'register.cash_out','inventory.view','reports.sales','reports.inventory'
  ) ON CONFLICT DO NOTHING;

  FOR br IN SELECT * FROM demo_branches ORDER BY id LOOP
    FOR k IN 1..2 LOOP
      INSERT INTO users(organization_id,default_branch_id,name,username,password_hash)
      VALUES(target_org,br.id,'Demo Cashier ' || k || ' - ' || br.name,
        'demo_' || target_org || '_b' || br.id || '_cashier_' || k,owner_hash)
      RETURNING id INTO cashier_id;
      INSERT INTO user_roles(user_id,role_id) VALUES(cashier_id,role_id);
      INSERT INTO user_branches(user_id,branch_id) VALUES(cashier_id,br.id);
      IF k=1 THEN
        UPDATE demo_branches SET cashier_1=cashier_id WHERE id=br.id;
      ELSE
        UPDATE demo_branches SET cashier_2=cashier_id WHERE id=br.id;
      END IF;
    END LOOP;
    INSERT INTO registers(branch_id,name)
    VALUES(br.id,'Demo Reports Register') RETURNING id INTO inserted_id;
    UPDATE demo_branches SET register_id=inserted_id WHERE id=br.id;
  END LOOP;

  FOR br IN SELECT * FROM demo_branches ORDER BY id LOOP
    FOR med IN SELECT * FROM demo_medicines ORDER BY ordinal LOOP
      g := med.ordinal;
      cashier_id := CASE WHEN g%2=0 THEN br.cashier_2 ELSE br.cashier_1 END;
      receive_at := (seed_date-(22+g%5))::timestamp + interval '7 hours';
      expiry := seed_date+CASE
        WHEN g BETWEEN 11 AND 20 THEN 7+g
        WHEN g BETWEEN 21 AND 30 THEN 15+g
        WHEN g BETWEEN 31 AND 35 THEN 40+g
        ELSE 180+g END;
      qty := CASE WHEN g<=5 THEN 5 WHEN g<=10 THEN 3 ELSE 100+(g%7)*12 END;
      INSERT INTO purchases(
        organization_id,branch_id,supplier_id,purchase_number,supplier_invoice_number,
        purchase_date,status,payment_status,notes,created_by,received_at
      ) VALUES(target_org,br.id,supplier_ids[1+(g-1)%20],
        prefix || '-B' || br.id || '-P' || g,prefix || '-INV-B' || br.id || '-' || g,
        receive_at,'RECEIVED',CASE g%3 WHEN 0 THEN 'PAID' WHEN 1 THEN 'PARTIAL' ELSE 'UNPAID' END,
        prefix,cashier_id,receive_at) RETURNING id INTO purchase_id;

      INSERT INTO purchase_items(
        purchase_id,medicine_id,quantity,unit_cost,selling_price,batch_number,
        manufacturing_date,expiry_date,line_total
      ) VALUES(purchase_id,med.id,qty,med.cost,med.price,
        prefix || '-B' || br.id || '-LOT' || g,seed_date-300,expiry,qty*med.cost)
      RETURNING id INTO item_id;
      INSERT INTO medicine_batches(
        organization_id,branch_id,medicine_id,purchase_item_id,batch_number,
        manufacturing_date,expiry_date,unit_cost,default_selling_price,
        quantity_received,quantity_available,status,received_at,created_at
      ) VALUES(target_org,br.id,med.id,item_id,prefix || '-B' || br.id || '-LOT' || g,
        seed_date-300,expiry,med.cost,med.price,qty,qty,'SALEABLE',receive_at,receive_at)
      RETURNING id INTO batch_id;
      INSERT INTO demo_batches VALUES(br.id,g,purchase_id,item_id,batch_id);
      INSERT INTO stock_movements(
        organization_id,branch_id,medicine_id,batch_id,movement_type,quantity,unit_cost,
        reference_type,reference_id,notes,performed_by,created_at
      ) VALUES(target_org,br.id,med.id,batch_id,'PURCHASE',qty,med.cost,
        'PURCHASE',purchase_id,prefix,cashier_id,receive_at);

      IF g<=35 THEN
        batch_status := CASE WHEN g<=20 THEN 'EXPIRED' WHEN g<=25 THEN 'QUARANTINED'
          WHEN g<=30 THEN 'DAMAGED' ELSE 'RECALLED' END;
        expiry := CASE WHEN g<=20 THEN seed_date-(1+g%20) ELSE seed_date+200 END;
        extra_qty := 20+g;
        INSERT INTO purchase_items(
          purchase_id,medicine_id,quantity,unit_cost,selling_price,batch_number,
          manufacturing_date,expiry_date,line_total
        ) VALUES(purchase_id,med.id,extra_qty,med.cost,med.price,
          prefix || '-B' || br.id || '-HOLD' || g,seed_date-300,expiry,extra_qty*med.cost)
        RETURNING id INTO item_id;
        INSERT INTO medicine_batches(
          organization_id,branch_id,medicine_id,purchase_item_id,batch_number,
          manufacturing_date,expiry_date,unit_cost,default_selling_price,
          quantity_received,quantity_available,status,received_at,created_at
        ) VALUES(target_org,br.id,med.id,item_id,prefix || '-B' || br.id || '-HOLD' || g,
          seed_date-300,expiry,med.cost,med.price,extra_qty,extra_qty,batch_status,receive_at,receive_at)
        RETURNING id INTO batch_id;
        INSERT INTO stock_movements(
          organization_id,branch_id,medicine_id,batch_id,movement_type,quantity,unit_cost,
          reference_type,reference_id,notes,performed_by,created_at
        ) VALUES(target_org,br.id,med.id,batch_id,'PURCHASE',extra_qty,med.cost,
          'PURCHASE',purchase_id,prefix,cashier_id,receive_at);
      END IF;
      SELECT sum(line_total) INTO total FROM purchase_items
      WHERE purchase_items.purchase_id=fixture.purchase_id;
      UPDATE purchases SET subtotal=fixture.total,total=fixture.total WHERE id=fixture.purchase_id;
      IF g%3<>2 THEN
        INSERT INTO purchase_payments(purchase_id,payment_method,amount,reference,created_by,created_at)
        VALUES(purchase_id,CASE g%3 WHEN 0 THEN 'BANK' ELSE 'MOBILE_MONEY' END,
          CASE g%3 WHEN 0 THEN total ELSE round(total/2,2) END,
          prefix || '-PAY-' || purchase_id,cashier_id,receive_at+interval '1 hour');
      END IF;
    END LOOP;

    FOR g IN 1..50 LOOP
      cashier_id := CASE WHEN g%2=0 THEN br.cashier_2 ELSE br.cashier_1 END;
      open_at := (seed_date-18+(g-1)/3)::timestamp + (8+((g-1)%3)*3)*interval '1 hour';
      sale_at := open_at+interval '1 hour';
      INSERT INTO register_sessions(
        register_id,branch_id,user_id,opening_cash,opened_at,closed_at,status
      ) VALUES(br.register_id,br.id,cashier_id,100000,open_at,open_at+interval '3 hours','CLOSED')
      RETURNING id INTO session_id;
      INSERT INTO demo_sessions VALUES(session_id,g);
      INSERT INTO register_movements(register_session_id,movement_type,amount,performed_by,created_at)
      VALUES(session_id,'OPENING',100000,cashier_id,open_at);

      med_index := 11+(g-1)%30;
      SELECT * INTO med FROM demo_medicines WHERE ordinal=med_index;
      qty := 2+g%5;
      SELECT b.* INTO batch FROM medicine_batches b
      JOIN demo_batches d ON d.batch_id=b.id
      WHERE d.branch_id=br.id AND d.ordinal=med_index
        AND b.status='SALEABLE' AND b.expiry_date>=sale_at::date AND b.quantity_available>=qty
      ORDER BY b.expiry_date,b.received_at,b.id LIMIT 1 FOR UPDATE OF b;
      IF NOT FOUND THEN RAISE EXCEPTION 'Saleable stock missing in branch %, medicine %',br.id,med.id; END IF;
      subtotal := qty*med.price;
      discount := CASE WHEN g>40 AND g%3=0 THEN round(subtotal*0.10,2) ELSE 0 END;
      total := subtotal-discount;
      method := (ARRAY['CASH','MOBILE_MONEY','CARD','BANK'])[1+(g-1)%4];
      INSERT INTO sales(
        organization_id,branch_id,register_session_id,customer_id,user_id,sale_number,
        subtotal,discount,total,amount_paid,payment_status,status,notes,created_at
      ) VALUES(target_org,br.id,session_id,customer_ids[1+(g-1)%40],cashier_id,
        prefix || '-B' || br.id || '-S' || g,subtotal,discount,total,total,'PAID','COMPLETED',prefix,sale_at)
      RETURNING id INTO sale_id;
      INSERT INTO sale_items(
        sale_id,medicine_id,quantity,unit_price,line_total,
        sale_unit_name,sale_unit_quantity,conversion_to_base,sale_unit_price
      ) VALUES(sale_id,med.id,qty,med.price,subtotal,'Demo Unit',qty,1,med.price)
      RETURNING id INTO sale_item_id;
      INSERT INTO sale_item_batches(sale_item_id,batch_id,quantity,unit_cost)
      VALUES(sale_item_id,batch.id,qty,batch.unit_cost);
      UPDATE medicine_batches SET quantity_available=quantity_available-qty WHERE id=batch.id;
      INSERT INTO stock_movements(
        organization_id,branch_id,medicine_id,batch_id,movement_type,quantity,unit_cost,
        reference_type,reference_id,notes,performed_by,created_at
      ) VALUES(target_org,br.id,med.id,batch.id,'SALE',-qty,batch.unit_cost,
        'SALE',sale_id,prefix,cashier_id,sale_at);
      INSERT INTO sale_payments(
        sale_id,register_session_id,payment_method,amount,reference,created_by,created_at
      ) VALUES(sale_id,session_id,method,total,prefix || '-SP-' || sale_id,cashier_id,sale_at);
      IF method='CASH' THEN
        INSERT INTO register_movements(
          register_session_id,movement_type,amount,reference_type,reference_id,performed_by,created_at
        ) VALUES(session_id,'CASH_SALE',total,'SALE',sale_id,cashier_id,sale_at);
      END IF;

      IF g<=20 THEN
        refund_qty := CASE WHEN g%4=0 THEN qty ELSE 1 END;
        refund := refund_qty*med.price;
        INSERT INTO sale_returns(
          organization_id,branch_id,sale_id,return_number,reason,total_refund,
          created_by,approved_by,created_at,refund_method,refund_reference
        ) VALUES(target_org,br.id,sale_id,prefix || '-B' || br.id || '-SR' || g,
          'Demo customer return',refund,cashier_id,owner_id,sale_at+interval '20 minutes',
          method,prefix || '-REFUND-' || sale_id) RETURNING id INTO return_id;
        INSERT INTO sale_return_items(
          sale_return_id,sale_item_id,batch_id,quantity,refund_amount,stock_disposition
        ) VALUES(return_id,sale_item_id,batch.id,refund_qty,refund,'RETURN_TO_STOCK');
        UPDATE medicine_batches SET quantity_available=quantity_available+refund_qty WHERE id=batch.id;
        INSERT INTO stock_movements(
          organization_id,branch_id,medicine_id,batch_id,movement_type,quantity,unit_cost,
          reference_type,reference_id,notes,performed_by,created_at
        ) VALUES(target_org,br.id,med.id,batch.id,'SALE_RETURN',refund_qty,batch.unit_cost,
          'SALE_RETURN',return_id,prefix,cashier_id,sale_at+interval '20 minutes');
        UPDATE sales SET status=CASE WHEN refund_qty=qty THEN 'REFUNDED' ELSE 'PARTIALLY_REFUNDED' END
        WHERE id=sale_id;
        IF method='CASH' THEN
          INSERT INTO register_movements(
            register_session_id,movement_type,amount,reference_type,reference_id,performed_by,created_at
          ) VALUES(session_id,'CASH_REFUND',refund,'SALE_RETURN',return_id,cashier_id,sale_at+interval '20 minutes');
        END IF;
      END IF;

      IF g<=30 THEN
        total := 500+(g%8)*400;
        INSERT INTO expenses(
          organization_id,branch_id,register_session_id,category,description,amount,
          payment_method,created_by,created_at
        ) VALUES(target_org,br.id,session_id,
          (ARRAY['Transport','Cleaning','Electricity','Internet','Stationery','Repairs'])[1+(g-1)%6],
          prefix || ' expense ' || g,total,method,cashier_id,sale_at+interval '40 minutes')
        RETURNING id INTO expense_id;
        IF method='CASH' THEN
          INSERT INTO register_movements(
            register_session_id,movement_type,amount,reference_type,reference_id,performed_by,created_at
          ) VALUES(session_id,'EXPENSE',total,'EXPENSE',expense_id,cashier_id,sale_at+interval '40 minutes');
        END IF;
      END IF;
    END LOOP;

    work_at := (seed_date-1)::timestamp+interval '10 hours';
    FOR g IN 11..30 LOOP
      SELECT b.*,d.purchase_id,d.item_id INTO batch FROM medicine_batches b
      JOIN demo_batches d ON d.batch_id=b.id WHERE d.branch_id=br.id AND d.ordinal=g FOR UPDATE OF b;
      INSERT INTO purchase_returns(
        organization_id,branch_id,purchase_id,return_number,reason,total_value,created_by,created_at
      ) VALUES(target_org,br.id,batch.purchase_id,prefix || '-B' || br.id || '-PR' || g,
        'Demo supplier return',5*batch.unit_cost,br.cashier_1,work_at) RETURNING id INTO return_id;
      INSERT INTO purchase_return_items(
        purchase_return_id,purchase_item_id,batch_id,quantity,unit_cost,line_total
      ) VALUES(return_id,batch.item_id,batch.id,5,batch.unit_cost,5*batch.unit_cost);
      UPDATE medicine_batches SET quantity_available=quantity_available-5 WHERE id=batch.id;
      INSERT INTO stock_movements(
        organization_id,branch_id,medicine_id,batch_id,movement_type,quantity,unit_cost,
        reference_type,reference_id,notes,performed_by,created_at
      ) VALUES(target_org,br.id,batch.medicine_id,batch.id,'PURCHASE_RETURN',-5,batch.unit_cost,
        'PURCHASE_RETURN',return_id,prefix,br.cashier_1,work_at);
    END LOOP;

    FOR g IN 1..20 LOOP
      med_index := CASE WHEN g<=5 THEN g ELSE g+5 END;
      SELECT b.* INTO batch FROM medicine_batches b JOIN demo_batches d ON d.batch_id=b.id
      WHERE d.branch_id=br.id AND d.ordinal=med_index FOR UPDATE OF b;
      delta := CASE WHEN g<=5 THEN -batch.quantity_available WHEN g%2=0 THEN 2 ELSE -1 END;
      INSERT INTO stock_adjustments(organization_id,branch_id,adjustment_number,reason,notes,created_by,created_at)
      VALUES(target_org,br.id,prefix || '-B' || br.id || '-ADJ' || g,
        CASE WHEN g<=5 THEN 'DAMAGED' ELSE 'CORRECTION' END,prefix,br.cashier_2,work_at+interval '1 hour')
      RETURNING id INTO adjustment_id;
      INSERT INTO stock_adjustment_items(adjustment_id,medicine_id,batch_id,quantity_change,notes)
      VALUES(adjustment_id,batch.medicine_id,batch.id,delta,prefix);
      UPDATE medicine_batches SET quantity_available=quantity_available+delta,
        status=CASE WHEN quantity_available+delta=0 THEN 'DEPLETED' ELSE status END WHERE id=batch.id;
      INSERT INTO stock_movements(
        organization_id,branch_id,medicine_id,batch_id,movement_type,quantity,unit_cost,
        reference_type,reference_id,notes,performed_by,created_at
      ) VALUES(target_org,br.id,batch.medicine_id,batch.id,'ADJUSTMENT',delta,batch.unit_cost,
        'ADJUSTMENT',adjustment_id,prefix,br.cashier_2,work_at+interval '1 hour');
    END LOOP;
    RAISE NOTICE 'Branch %: 40 purchases, 50 sales, 20 expired batches, 30 expenses, 20 sale returns, 20 purchase returns, 20 adjustments',br.name;
  END LOOP;

  -- Transfer after all sales so historical allocation sees only the original FEFO batches.
  IF branch_count>1 THEN
    FOR br IN SELECT * FROM demo_branches ORDER BY id LOOP
      SELECT * INTO dest FROM demo_branches ORDER BY (id>br.id) DESC,id LIMIT 1;
      FOR g IN 11..30 LOOP
        SELECT b.* INTO batch FROM medicine_batches b JOIN demo_batches d ON d.batch_id=b.id
        WHERE d.branch_id=br.id AND d.ordinal=g FOR UPDATE OF b;
        INSERT INTO stock_transfers(
          organization_id,from_branch_id,to_branch_id,transfer_number,status,created_by,
          sent_at,received_at,received_by,created_at
        ) VALUES(target_org,br.id,dest.id,prefix || '-B' || br.id || '-TR' || g,
          'RECEIVED',br.cashier_1,work_at+interval '2 hours',work_at+interval '3 hours',
          dest.cashier_1,work_at+interval '2 hours') RETURNING id INTO transfer_id;
        INSERT INTO stock_transfer_items(transfer_id,medicine_id,batch_id,quantity)
        VALUES(transfer_id,batch.medicine_id,batch.id,3);
        UPDATE medicine_batches SET quantity_available=quantity_available-3 WHERE id=batch.id;
        INSERT INTO stock_movements(
          organization_id,branch_id,medicine_id,batch_id,movement_type,quantity,unit_cost,
          reference_type,reference_id,notes,performed_by,created_at
        ) VALUES(target_org,br.id,batch.medicine_id,batch.id,'TRANSFER_OUT',-3,batch.unit_cost,
          'TRANSFER',transfer_id,prefix,br.cashier_1,work_at+interval '2 hours');
        INSERT INTO medicine_batches(
          organization_id,branch_id,medicine_id,batch_number,manufacturing_date,expiry_date,
          unit_cost,default_selling_price,quantity_received,quantity_available,status,received_at,created_at
        ) VALUES(target_org,dest.id,batch.medicine_id,prefix || '-TRANSFER-' || transfer_id,
          batch.manufacturing_date,batch.expiry_date,batch.unit_cost,batch.default_selling_price,
          3,3,'SALEABLE',work_at+interval '3 hours',work_at+interval '3 hours')
        RETURNING id INTO target_batch_id;
        INSERT INTO stock_movements(
          organization_id,branch_id,medicine_id,batch_id,movement_type,quantity,unit_cost,
          reference_type,reference_id,notes,performed_by,created_at
        ) VALUES(target_org,dest.id,batch.medicine_id,target_batch_id,'TRANSFER_IN',3,batch.unit_cost,
          'TRANSFER',transfer_id,prefix,dest.cashier_1,work_at+interval '3 hours');
      END LOOP;
    END LOOP;
  END IF;

  FOR br IN SELECT * FROM demo_branches ORDER BY id LOOP
    FOR g IN 11..30 LOOP
      SELECT b.* INTO batch FROM medicine_batches b JOIN demo_batches d ON d.batch_id=b.id
      WHERE d.branch_id=br.id AND d.ordinal=g FOR UPDATE OF b;
      INSERT INTO stock_counts(organization_id,branch_id,count_number,status,started_by,started_at,completed_at)
      VALUES(target_org,br.id,prefix || '-B' || br.id || '-COUNT' || g,'COMPLETED',br.cashier_2,
        work_at+interval '4 hours',work_at+interval '5 hours') RETURNING id INTO count_id;
      INSERT INTO stock_count_items(stock_count_id,medicine_id,batch_id,system_quantity,counted_quantity,difference)
      VALUES(count_id,batch.medicine_id,batch.id,batch.quantity_available,batch.quantity_available,0);
    END LOOP;
  END LOOP;

  UPDATE register_sessions rs SET expected_cash=x.expected,
    actual_cash=x.expected+x.variance,difference=x.variance
  FROM (
    SELECT ds.id,sum(CASE WHEN rm.movement_type IN('OPENING','CASH_SALE','CASH_IN') THEN rm.amount
      ELSE -rm.amount END) AS expected,
      CASE ds.ordinal%7 WHEN 0 THEN -100 WHEN 1 THEN 200 ELSE 0 END AS variance
    FROM demo_sessions ds JOIN register_movements rm ON rm.register_session_id=ds.id
    GROUP BY ds.id,ds.ordinal
  ) x WHERE rs.id=x.id;

  IF EXISTS (
    SELECT 1 FROM medicine_batches b JOIN demo_medicines m ON m.id=b.medicine_id
    WHERE b.quantity_available<>(SELECT COALESCE(sum(sm.quantity),0) FROM stock_movements sm WHERE sm.batch_id=b.id)
  ) THEN RAISE EXCEPTION 'Demo stock ledger did not reconcile'; END IF;

  INSERT INTO audit_logs(organization_id,user_id,action,entity_type,after_data)
  VALUES(target_org,owner_id,'DEMO_REPORT_SEED',prefix,
    jsonb_build_object('medicines',40,'customers',40,'suppliers',20,'branches',branch_count,
      'sales_per_branch',50,'purchases_per_branch',40,'expired_batches_per_branch',20));
  RAISE NOTICE 'Complete: organization %, % branches, 40 medicines, 40 customers, 20 suppliers. Demo cashiers use the existing owner password.',target_org,branch_count;
END;
$demo$;

COMMIT;
