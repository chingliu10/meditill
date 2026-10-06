const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');

const permissions = [
  'medicine.view','medicine.create','medicine.edit','medicine.deactivate',
  'supplier.view','supplier.manage',
  'purchase.view','purchase.create','purchase.receive','purchase.return',
  'inventory.view','inventory.adjust','inventory.transfer','inventory.stock_count',
  'sale.create','sale.view','sale.refund','sale.discount','sale.override_price',
  'register.open','register.close','register.cash_in','register.cash_out',
  'reports.sales','reports.profit','reports.inventory',
  'users.manage','roles.manage','branches.manage','settings.manage'
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const org = (await client.query(
      `INSERT INTO organizations(name,currency,timezone)
       VALUES('MediTill Demo Pharmacy','TZS','Africa/Dar_es_Salaam')
       RETURNING id`
    )).rows[0];
    const branch = (await client.query(
      `INSERT INTO branches(organization_id,name,code)
       VALUES($1,'Main Branch','MAIN') RETURNING id`,[org.id]
    )).rows[0];
    const hash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',12);
    const user = (await client.query(
      `INSERT INTO users(organization_id,default_branch_id,name,username,password_hash)
       VALUES($1,$2,'Administrator','admin',$3) RETURNING id`,
      [org.id,branch.id,hash]
    )).rows[0];
    const role = (await client.query(
      `INSERT INTO roles(organization_id,name,description,is_system)
       VALUES($1,'OWNER','Full access',true) RETURNING id`,[org.id]
    )).rows[0];

    for (const code of permissions) {
      const p = (await client.query(
        `INSERT INTO permissions(code) VALUES($1)
         ON CONFLICT(code) DO UPDATE SET code=EXCLUDED.code RETURNING id`,[code]
      )).rows[0];
      await client.query('INSERT INTO role_permissions(role_id,permission_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[role.id,p.id]);
    }
    await client.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[user.id,role.id]);
    await client.query('INSERT INTO user_branches(user_id,branch_id) VALUES($1,$2)',[user.id,branch.id]);
    await client.query(`INSERT INTO categories(organization_id,name) VALUES
      ($1,'Analgesics'),($1,'Antibiotics'),($1,'Vitamins'),($1,'First Aid'),($1,'Personal Care')`,[org.id]);
    await client.query(`INSERT INTO units(organization_id,name,symbol) VALUES
      ($1,'Piece','pc'),($1,'Tablet','tab'),($1,'Capsule','cap'),($1,'Bottle','btl'),($1,'Millilitre','ml')`,[org.id]);
    await client.query(`INSERT INTO customers(organization_id,name,is_walk_in) VALUES($1,'Walk-in Customer',true)`,[org.id]);
    await client.query(`INSERT INTO registers(branch_id,name) VALUES($1,'Register 1')`,[branch.id]);
    await client.query('COMMIT');
    console.log('Seed complete. Username: admin');
  } catch (e) {
    await client.query('ROLLBACK'); throw e;
  } finally {
    client.release(); await pool.end();
  }
}
seed().catch(e=>{console.error(e);process.exit(1)});
