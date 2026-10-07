const permissions = [
  'medicine.view','medicine.create','medicine.edit','medicine.deactivate',
  'supplier.view','supplier.manage',
  'purchase.view','purchase.create','purchase.receive','purchase.return',
  'inventory.view','inventory.adjust','inventory.transfer','inventory.stock_count',
  'sale.create','sale.view','sale.refund','sale.discount','sale.override_price',
  'register.open','register.close','register.cash_in','register.cash_out',
  'reports.sales','reports.profit','reports.inventory','reports.purchases',
  'users.manage','roles.manage','branches.manage','settings.manage'
];

function usage() {
  console.log('Usage: npm run db:create-owner -- <organization-id> <username> [name]');
  console.log('Set OWNER_PASSWORD in the environment or .env (at least 8 characters).');
  console.log('Optional: OWNER_DEFAULT_BRANCH_ID; otherwise the first active branch is used.');
}

async function createOwner(db, bcrypt, input) {
  return db.withTransaction(async client => {
    const organization = (await client.query(
      'SELECT id FROM organizations WHERE id=$1 AND active=true FOR UPDATE',
      [input.organizationId]
    )).rows[0];
    if (!organization) throw new Error('Active organization not found.');

    const branches = (await client.query(
      'SELECT id FROM branches WHERE organization_id=$1 AND active=true ORDER BY id FOR SHARE',
      [organization.id]
    )).rows;
    if (!branches.length) throw new Error('The organization has no active branches.');
    const defaultBranch = input.defaultBranchId
      ? branches.find(branch => String(branch.id) === input.defaultBranchId)
      : branches[0];
    if (!defaultBranch) throw new Error('Default branch must be active and belong to the organization.');

    // Login searches usernames across organizations, so reject ambiguous accounts.
    const existing = await client.query(
      'SELECT id FROM users WHERE lower(username)=lower($1) LIMIT 1',
      [input.username]
    );
    if (existing.rowCount) throw new Error('Username already exists. Choose a new username.');

    const hash = await bcrypt.hash(input.password, 12);
    const user = (await client.query(
      `INSERT INTO users(organization_id,default_branch_id,name,username,password_hash)
       VALUES($1,$2,$3,$4,$5) RETURNING id,username`,
      [organization.id,defaultBranch.id,input.name,input.username,hash]
    )).rows[0];
    const role = (await client.query(
      `INSERT INTO roles(organization_id,name,description,is_system)
       VALUES($1,'OWNER','Full access',true)
       ON CONFLICT(organization_id,name)
       DO UPDATE SET description=EXCLUDED.description,is_system=true
       RETURNING id`,
      [organization.id]
    )).rows[0];

    await client.query(
      `INSERT INTO permissions(code)
       SELECT unnest($1::text[])
       ON CONFLICT(code) DO NOTHING`,
      [permissions]
    );
    await client.query(
      `INSERT INTO role_permissions(role_id,permission_id)
       SELECT $1,id FROM permissions ON CONFLICT DO NOTHING`,
      [role.id]
    );
    await client.query(
      'INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',
      [user.id,role.id]
    );
    await client.query(
      `INSERT INTO user_branches(user_id,branch_id)
       SELECT $1,unnest($2::bigint[])`,
      [user.id,branches.map(branch => branch.id)]
    );

    const counts = (await client.query(
      `SELECT count(*)::integer AS total,
              count(*) FILTER (WHERE p.code=ANY($2::text[]))::integer AS baseline
       FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id
       WHERE rp.role_id=$1`,
      [role.id,permissions]
    )).rows[0];
    if (counts.baseline !== permissions.length) throw new Error('Not all 31 permissions were granted.');

    return { ...user, permissions: counts.total, branches: branches.length };
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    usage();
    return;
  }
  if (args.length < 2 || args.length > 3) {
    usage();
    throw new Error('Provide an organization ID, username, and optional name.');
  }

  require('dotenv').config();
  const input = {
    organizationId: args[0],
    username: args[1].trim(),
    name: String(args[2] || 'Owner').trim(),
    password: process.env.OWNER_PASSWORD || '',
    defaultBranchId: process.env.OWNER_DEFAULT_BRANCH_ID
  };
  if (!/^[1-9]\d*$/.test(input.organizationId)) throw new Error('Organization ID must be a positive integer.');
  if (input.defaultBranchId && !/^[1-9]\d*$/.test(input.defaultBranchId)) {
    throw new Error('Default branch ID must be a positive integer.');
  }
  if (!input.username || input.username.length > 80) throw new Error('Username must be 1 to 80 characters.');
  if (!input.name || input.name.length > 160) throw new Error('Name must be 1 to 160 characters.');
  if (input.password.length < 8 || Buffer.byteLength(input.password, 'utf8') > 72) {
    throw new Error('OWNER_PASSWORD must be at least 8 characters and at most 72 UTF-8 bytes.');
  }

  const bcrypt = require('bcryptjs');
  const db = require('../src/config/db');
  try {
    const owner = await createOwner(db, bcrypt, input);
    console.log(`Created OWNER ${owner.username} (user ID ${owner.id}).`);
    console.log(`Granted all 31 baseline permissions; ${owner.permissions} total permissions and ${owner.branches} active branches.`);
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Owner creation failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { createOwner };
