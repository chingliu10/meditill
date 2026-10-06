const bcrypt=require('bcryptjs');
const {pool}=require('../src/config/db');

const ORG_NAME='MediTill Performance Lab';
const USERNAME='perf_admin_loadtest';

function intEnv(name,fallback,min,max){
  const value=Number(process.env[name]||fallback);
  if(!Number.isInteger(value)||value<min||value>max) throw new Error(`${name} must be an integer between ${min} and ${max}`);
  return value;
}

const MEDICINES=intEnv('PERF_MEDICINES',1500,100,5000);
const SUPPLIERS=intEnv('PERF_SUPPLIERS',100,10,500);
const CUSTOMERS=intEnv('PERF_CUSTOMERS',2500,100,10000);
const SALES=intEnv('PERF_SALES',30000,1000,100000);
const EXPENSES=intEnv('PERF_EXPENSES',6000,500,50000);
const PASSWORD=String(process.env.PERF_SEED_PASSWORD||'');

if(PASSWORD.length<8){
  throw new Error('Set PERF_SEED_PASSWORD to at least 8 characters before running perf:seed.');
}

async function seed(){
  const client=await pool.connect();
  const started=Date.now();

  try{
    await client.query('BEGIN');

    const existingOrg=await client.query('SELECT id FROM organizations WHERE name=$1 LIMIT 1',[ORG_NAME]);
    if(existingOrg.rows.length) throw new Error(`${ORG_NAME} already exists. Run npm run perf:clean before reseeding.`);

    const existingUser=await client.query('SELECT id FROM users WHERE lower(username)=lower($1) LIMIT 1',[USERNAME]);
    if(existingUser.rows.length) throw new Error(`Username ${USERNAME} already exists. Run perf:clean or choose a clean database.`);

    const organization=(await client.query(
      `INSERT INTO organizations(name,currency,timezone)
       VALUES($1,'TZS','Africa/Dar_es_Salaam')
       RETURNING id`,[ORG_NAME]
    )).rows[0];

    const branch=(await client.query(
      `INSERT INTO branches(organization_id,name,code,address)
       VALUES($1,'Performance Branch','PERF','Synthetic load-test branch')
       RETURNING id`,[organization.id]
    )).rows[0];

    const hash=await bcrypt.hash(PASSWORD,12);
    const user=(await client.query(
      `INSERT INTO users(organization_id,default_branch_id,name,username,password_hash)
       VALUES($1,$2,'Performance Administrator',$3,$4)
       RETURNING id`,
      [organization.id,branch.id,USERNAME,hash]
    )).rows[0];

    const role=(await client.query(
      `INSERT INTO roles(organization_id,name,description,is_system)
       VALUES($1,'OWNER','Performance-lab full access',true)
       RETURNING id`,[organization.id]
    )).rows[0];

    await client.query(
      `INSERT INTO role_permissions(role_id,permission_id)
       SELECT $1,id FROM permissions
       ON CONFLICT DO NOTHING`,[role.id]
    );
    await client.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[user.id,role.id]);
    await client.query('INSERT INTO user_branches(user_id,branch_id) VALUES($1,$2)',[user.id,branch.id]);

    const units=(await client.query(
      `INSERT INTO units(organization_id,name,symbol,allow_fraction) VALUES
       ($1,'Tablet','tab',false),
       ($1,'Capsule','cap',false),
       ($1,'Bottle','btl',false),
       ($1,'Millilitre','ml',true)
       RETURNING id,name`,[organization.id]
    )).rows;

    await client.query(
      `INSERT INTO categories(organization_id,name)
       SELECT $1,name FROM unnest(ARRAY[
         'Analgesics','Antibiotics','Cardiovascular','Diabetes','Gastrointestinal',
         'Respiratory','Allergy','Vitamins','Dermatology','First Aid'
       ]) name`,[organization.id]
    );

    await client.query(
      `INSERT INTO suppliers(organization_id,name,contact_person,phone,email,address,active)
       SELECT $1,
              'PERF Supplier '||lpad(g::text,4,'0'),
              'Contact '||g,
              '07'||lpad((10000000+g)::text,8,'0'),
              'perf-supplier-'||g||'@example.test',
              'Synthetic supplier address '||g,
              true
       FROM generate_series(1,$2::int) g`,
      [organization.id,SUPPLIERS]
    );

    await client.query(
      `INSERT INTO customers(organization_id,name,phone,email,is_walk_in,active)
       VALUES($1,'Performance Walk-in Customer',NULL,NULL,true,true)`,
      [organization.id]
    );

    await client.query(
      `INSERT INTO customers(organization_id,name,phone,email,is_walk_in,active)
       SELECT $1,
              'PERF Customer '||lpad(g::text,5,'0'),
              '06'||lpad((10000000+g)::text,8,'0'),
              'perf-customer-'||g||'@example.test',
              false,
              true
       FROM generate_series(1,$2::int) g`,
      [organization.id,CUSTOMERS]
    );

    await client.query(
      `CREATE TEMP TABLE perf_med_map(
         perf_index integer PRIMARY KEY,
         medicine_id bigint NOT NULL,
         unit_name varchar(80) NOT NULL,
         price numeric(18,2) NOT NULL,
         unit_cost numeric(18,2) NOT NULL,
         final_qty numeric(18,4) NOT NULL,
         batch_id bigint
       ) ON COMMIT DROP`
    );

    const unitIds=Object.fromEntries(units.map(row=>[row.name,Number(row.id)]));
    const tablet=unitIds.Tablet,capsule=unitIds.Capsule,bottle=unitIds.Bottle,ml=unitIds.Millilitre;

    await client.query(
      `WITH src AS (
         SELECT g,
                CASE g%4 WHEN 0 THEN $3::bigint WHEN 1 THEN $4::bigint WHEN 2 THEN $5::bigint ELSE $6::bigint END unit_id,
                CASE g%4 WHEN 0 THEN 'Millilitre' WHEN 1 THEN 'Tablet' WHEN 2 THEN 'Capsule' ELSE 'Bottle' END unit_name,
                (100+((g%60)*50))::numeric price,
                (40+((g%35)*25))::numeric cost,
                CASE
                  WHEN g<=floor($2::numeric*0.25) THEN 0
                  WHEN g<=floor($2::numeric*0.45) THEN (1+(g%5))::numeric
                  ELSE (50+(g%451))::numeric
                END final_qty
         FROM generate_series(1,$2::int) g
       ),
       inserted AS (
         INSERT INTO medicines(
           organization_id,base_unit_id,name,generic_name,brand_name,strength,dosage_form,
           sku,default_selling_price,reorder_level,prescription_required,track_expiry,active,created_by
         )
         SELECT $1,unit_id,
                'PERF Medicine '||lpad(g::text,5,'0'),
                'Generic '||((g%180)+1),
                'Brand '||((g%90)+1),
                CASE WHEN unit_name='Millilitre' THEN ((g%20)+1)||' mg/ml' ELSE ((g%10)+1)*100||' mg' END,
                CASE unit_name WHEN 'Tablet' THEN 'Tablet' WHEN 'Capsule' THEN 'Capsule' WHEN 'Bottle' THEN 'Liquid' ELSE 'Liquid' END,
                'PERF-MED-'||lpad(g::text,5,'0'),
                price,
                10,
                (g%11=0),
                true,
                true,
                $7
         FROM src
         RETURNING id,sku,default_selling_price
       )
       INSERT INTO perf_med_map(perf_index,medicine_id,unit_name,price,unit_cost,final_qty)
       SELECT regexp_replace(i.sku,'[^0-9]','','g')::int,
              i.id,
              s.unit_name,
              s.price,
              s.cost,
              s.final_qty
       FROM inserted i
       JOIN src s ON s.g=regexp_replace(i.sku,'[^0-9]','','g')::int`,
      [organization.id,MEDICINES,ml,tablet,capsule,bottle,user.id]
    );

    await client.query(
      `WITH ranked_suppliers AS (
         SELECT id,row_number() OVER(ORDER BY id) rn
         FROM suppliers
         WHERE organization_id=$1 AND name LIKE 'PERF Supplier %'
       )
       INSERT INTO purchases(
         organization_id,branch_id,supplier_id,purchase_number,supplier_invoice_number,
         purchase_date,subtotal,discount,tax,total,status,payment_status,notes,created_by,received_at
       )
       SELECT $1,$2,s.id,
              'PERF-PUR-'||lpad(m.perf_index::text,6,'0'),
              'INV-'||lpad(m.perf_index::text,6,'0'),
              now()-(((m.perf_index-1)%365)||' days')::interval,
              0,0,0,0,'RECEIVED',
              CASE m.perf_index%3 WHEN 0 THEN 'PAID' WHEN 1 THEN 'PARTIAL' ELSE 'UNPAID' END,
              'Synthetic performance purchase',
              $5,
              now()-(((m.perf_index-1)%365)||' days')::interval
       FROM perf_med_map m
       JOIN ranked_suppliers s ON s.rn=((m.perf_index-1)%$3)+1`,
      [organization.id,branch.id,SUPPLIERS,MEDICINES,user.id]
    );

    await client.query(
      `INSERT INTO purchase_items(
         purchase_id,medicine_id,quantity,unit_cost,selling_price,batch_number,manufacturing_date,expiry_date,line_total
       )
       SELECT p.id,m.medicine_id,1,m.unit_cost,m.price,
              'PERF-BATCH-'||lpad(m.perf_index::text,5,'0'),
              (current_date-interval '90 days')::date,
              (current_date+(((m.perf_index%720)+120)||' days')::interval)::date,
              m.unit_cost
       FROM perf_med_map m
       JOIN purchases p ON p.organization_id=$1
        AND p.purchase_number='PERF-PUR-'||lpad(m.perf_index::text,6,'0')`,
      [organization.id]
    );

    await client.query(
      `INSERT INTO medicine_batches(
         organization_id,branch_id,medicine_id,purchase_item_id,batch_number,manufacturing_date,expiry_date,
         unit_cost,default_selling_price,quantity_received,quantity_available,status,received_at
       )
       SELECT $1,$2,pi.medicine_id,pi.id,pi.batch_number,pi.manufacturing_date,pi.expiry_date,
              pi.unit_cost,pi.selling_price,1,m.final_qty,
              CASE WHEN m.final_qty=0 THEN 'DEPLETED' ELSE 'SALEABLE' END,
              p.received_at
       FROM purchase_items pi
       JOIN purchases p ON p.id=pi.purchase_id
       JOIN perf_med_map m ON m.medicine_id=pi.medicine_id
       WHERE p.organization_id=$1`,
      [organization.id,branch.id]
    );

    await client.query(
      `UPDATE perf_med_map m
       SET batch_id=b.id
       FROM medicine_batches b
       WHERE b.organization_id=$1 AND b.branch_id=$2 AND b.medicine_id=m.medicine_id`,
      [organization.id,branch.id]
    );

    await client.query(
      `WITH ranked_customers AS (
         SELECT id,row_number() OVER(ORDER BY id) rn
         FROM customers
         WHERE organization_id=$1 AND is_walk_in=false
       ),
       src AS (
         SELECT g,
                ((g-1)%$4)+1 med_index,
                ((g-1)%$5)+1 customer_index,
                now()-(((g-1)%365)||' days')::interval-(((g*37)%86400)||' seconds')::interval created_at
         FROM generate_series(1,$3::int) g
       )
       INSERT INTO sales(
         organization_id,branch_id,register_session_id,customer_id,user_id,sale_number,
         subtotal,discount,tax,total,amount_paid,change_amount,payment_status,status,notes,created_at
       )
       SELECT $1,$2,NULL,
              CASE WHEN src.g%5=0 THEN NULL ELSE c.id END,
              $6,
              'PERF-SALE-'||lpad(src.g::text,7,'0'),
              m.price,0,0,m.price,m.price,0,'PAID','COMPLETED',
              'Synthetic performance sale',
              src.created_at
       FROM src
       JOIN perf_med_map m ON m.perf_index=src.med_index
       LEFT JOIN ranked_customers c ON c.rn=src.customer_index`,
      [organization.id,branch.id,SALES,MEDICINES,CUSTOMERS,user.id]
    );

    await client.query(
      `INSERT INTO sale_items(
         sale_id,medicine_id,quantity,unit_price,discount,line_total,
         sale_unit_name,sale_unit_quantity,conversion_to_base,sale_unit_price
       )
       SELECT s.id,m.medicine_id,1,m.price,0,m.price,m.unit_name,1,1,m.price
       FROM sales s
       JOIN perf_med_map m
         ON m.perf_index=((split_part(s.sale_number,'-',3)::int-1)%$2)+1
       WHERE s.organization_id=$1 AND s.sale_number LIKE 'PERF-SALE-%'`,
      [organization.id,MEDICINES]
    );

    await client.query(
      `INSERT INTO sale_item_batches(sale_item_id,batch_id,quantity,unit_cost)
       SELECT si.id,m.batch_id,1,m.unit_cost
       FROM sale_items si
       JOIN sales s ON s.id=si.sale_id
       JOIN perf_med_map m ON m.medicine_id=si.medicine_id
       WHERE s.organization_id=$1 AND s.sale_number LIKE 'PERF-SALE-%'`,
      [organization.id]
    );

    await client.query(
      `INSERT INTO sale_payments(sale_id,register_session_id,payment_method,amount,reference,created_by,created_at)
       SELECT s.id,NULL,
              CASE (split_part(s.sale_number,'-',3)::int%4)
                WHEN 0 THEN 'CASH'
                WHEN 1 THEN 'MOBILE_MONEY'
                WHEN 2 THEN 'CARD'
                ELSE 'BANK'
              END,
              s.total,
              CASE WHEN split_part(s.sale_number,'-',3)::int%4=0 THEN NULL ELSE 'PERF-'||s.id END,
              $2,
              s.created_at
       FROM sales s
       WHERE s.organization_id=$1 AND s.sale_number LIKE 'PERF-SALE-%'`,
      [organization.id,user.id]
    );

    await client.query(
      `INSERT INTO sale_returns(
         organization_id,branch_id,sale_id,return_number,reason,total_refund,created_by,approved_by,created_at
       )
       SELECT $1,$2,s.id,
              'PERF-RET-'||lpad(split_part(s.sale_number,'-',3)::int::text,7,'0'),
              'Synthetic performance return',
              s.total,$3,$3,s.created_at+interval '2 hours'
       FROM sales s
       WHERE s.organization_id=$1
         AND s.sale_number LIKE 'PERF-SALE-%'
         AND split_part(s.sale_number,'-',3)::int%33=0`,
      [organization.id,branch.id,user.id]
    );

    await client.query(
      `INSERT INTO sale_return_items(
         sale_return_id,sale_item_id,batch_id,quantity,refund_amount,stock_disposition
       )
       SELECT sr.id,si.id,sib.batch_id,si.quantity,si.line_total,'RETURN_TO_STOCK'
       FROM sale_returns sr
       JOIN sale_items si ON si.sale_id=sr.sale_id
       JOIN sale_item_batches sib ON sib.sale_item_id=si.id
       WHERE sr.organization_id=$1`,
      [organization.id]
    );

    await client.query(
      `UPDATE sales s SET status='REFUNDED'
       WHERE s.organization_id=$1
         AND EXISTS(SELECT 1 FROM sale_returns sr WHERE sr.sale_id=s.id)`,
      [organization.id]
    );

    await client.query(
      `WITH sold AS (
         SELECT sib.batch_id,COALESCE(SUM(sib.quantity),0) qty
         FROM sale_item_batches sib
         JOIN sale_items si ON si.id=sib.sale_item_id
         JOIN sales s ON s.id=si.sale_id
         WHERE s.organization_id=$1
         GROUP BY sib.batch_id
       ),
       returned AS (
         SELECT sri.batch_id,COALESCE(SUM(sri.quantity),0) qty
         FROM sale_return_items sri
         JOIN sale_returns sr ON sr.id=sri.sale_return_id
         WHERE sr.organization_id=$1
         GROUP BY sri.batch_id
       )
       UPDATE medicine_batches b
       SET quantity_received=m.final_qty+COALESCE(sold.qty,0)-COALESCE(returned.qty,0),
           quantity_available=m.final_qty,
           status=CASE WHEN m.final_qty=0 THEN 'DEPLETED' ELSE 'SALEABLE' END
       FROM perf_med_map m
       LEFT JOIN sold ON sold.batch_id=m.batch_id
       LEFT JOIN returned ON returned.batch_id=m.batch_id
       WHERE b.id=m.batch_id`,
      [organization.id]
    );

    await client.query(
      `UPDATE purchase_items pi
       SET quantity=b.quantity_received,
           line_total=b.quantity_received*pi.unit_cost
       FROM medicine_batches b
       WHERE b.purchase_item_id=pi.id AND b.organization_id=$1`,
      [organization.id]
    );

    await client.query(
      `UPDATE purchases p
       SET subtotal=x.total,total=x.total
       FROM (
         SELECT pi.purchase_id,SUM(pi.line_total) total
         FROM purchase_items pi
         JOIN purchases px ON px.id=pi.purchase_id
         WHERE px.organization_id=$1
         GROUP BY pi.purchase_id
       ) x
       WHERE p.id=x.purchase_id`,
      [organization.id]
    );

    await client.query(
      `INSERT INTO purchase_payments(purchase_id,register_session_id,payment_method,amount,reference,created_by,created_at)
       SELECT p.id,NULL,
              CASE p.id%3 WHEN 0 THEN 'BANK' WHEN 1 THEN 'MOBILE_MONEY' ELSE 'CARD' END,
              CASE p.payment_status WHEN 'PAID' THEN p.total ELSE round(p.total/2,2) END,
              'PERF-PAY-'||p.id,
              $2,
              p.purchase_date
       FROM purchases p
       WHERE p.organization_id=$1 AND p.payment_status IN('PAID','PARTIAL') AND p.total>0`,
      [organization.id,user.id]
    );

    await client.query(
      `INSERT INTO stock_movements(
         organization_id,branch_id,medicine_id,batch_id,movement_type,quantity,unit_cost,
         reference_type,reference_id,notes,performed_by,created_at
       )
       SELECT $1,$2,b.medicine_id,b.id,'PURCHASE',b.quantity_received,b.unit_cost,
              'PURCHASE',pi.purchase_id,'Synthetic performance purchase',$3,b.received_at
       FROM medicine_batches b
       JOIN purchase_items pi ON pi.id=b.purchase_item_id
       WHERE b.organization_id=$1`,
      [organization.id,branch.id,user.id]
    );

    await client.query(
      `INSERT INTO stock_movements(
         organization_id,branch_id,medicine_id,batch_id,movement_type,quantity,unit_cost,
         reference_type,reference_id,notes,performed_by,created_at
       )
       SELECT $1,$2,si.medicine_id,sib.batch_id,'SALE',-sib.quantity,sib.unit_cost,
              'SALE',s.id,'Synthetic performance sale',$3,s.created_at
       FROM sale_item_batches sib
       JOIN sale_items si ON si.id=sib.sale_item_id
       JOIN sales s ON s.id=si.sale_id
       WHERE s.organization_id=$1`,
      [organization.id,branch.id,user.id]
    );

    await client.query(
      `INSERT INTO stock_movements(
         organization_id,branch_id,medicine_id,batch_id,movement_type,quantity,unit_cost,
         reference_type,reference_id,notes,performed_by,created_at
       )
       SELECT $1,$2,si.medicine_id,sri.batch_id,'SALE_RETURN',sri.quantity,sib.unit_cost,
              'SALE_RETURN',sr.id,'Synthetic performance return',$3,sr.created_at
       FROM sale_return_items sri
       JOIN sale_returns sr ON sr.id=sri.sale_return_id
       JOIN sale_items si ON si.id=sri.sale_item_id
       JOIN sale_item_batches sib ON sib.sale_item_id=si.id AND sib.batch_id=sri.batch_id
       WHERE sr.organization_id=$1`,
      [organization.id,branch.id,user.id]
    );

    const expenseCategories=['Rent','Electricity','Internet','Transport','Repairs','Cleaning','Security','Stationery','Licences','Other'];

    await client.query(
      `INSERT INTO expenses(
         organization_id,branch_id,register_session_id,category,description,amount,payment_method,created_by,created_at
       )
       SELECT $1,$2,NULL,
              (ARRAY['Rent','Electricity','Internet','Transport','Repairs','Cleaning','Security','Stationery','Licences','Other'])[1+((g-1)%10)],
              'Synthetic performance expense '||g,
              (500+((g%80)*250))::numeric,
              (ARRAY['CASH','MOBILE_MONEY','CARD','BANK'])[1+((g-1)%4)],
              $4,
              now()-(((g-1)%365)||' days')::interval-(((g*53)%86400)||' seconds')::interval
       FROM generate_series(1,$3::int) g`,
      [organization.id,branch.id,EXPENSES,user.id]
    );

    await client.query(
      `INSERT INTO registers(branch_id,name,active)
       VALUES($1,'Performance Register 1',true)`,
      [branch.id]
    );

    await client.query('COMMIT');

    const returnCount=Math.floor(SALES/33);
    console.log('');
    console.log('Performance dataset created successfully.');
    console.log('Organization:',ORG_NAME);
    console.log('Username:',USERNAME);
    console.log('Branch: Performance Branch');
    console.log('');
    console.log('Synthetic volume:');
    console.log('  Medicines :',MEDICINES);
    console.log('  Suppliers :',SUPPLIERS);
    console.log('  Customers :',CUSTOMERS+1);
    console.log('  Purchases :',MEDICINES);
    console.log('  Sales     :',SALES);
    console.log('  Returns   : ~'+returnCount);
    console.log('  Expenses  :',EXPENSES);
    console.log('  OOS meds  : ~'+Math.floor(MEDICINES*0.25));
    console.log('  Low stock : ~'+(Math.floor(MEDICINES*0.45)-Math.floor(MEDICINES*0.25)));
    console.log('');
    console.log('Elapsed:',((Date.now()-started)/1000).toFixed(1)+'s');
    console.log('Run npm run perf:probe to measure core query timings.');
  }catch(error){
    await client.query('ROLLBACK');
    throw error;
  }finally{
    client.release();
    await pool.end();
  }
}

seed().catch(error=>{
  console.error(error);
  process.exit(1);
});
