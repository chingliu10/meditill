async function businessClock(db,branchId){
  const {rows}=await db.query(
    `SELECT o.timezone,to_char(now() AT TIME ZONE o.timezone,'YYYY-MM-DD') business_date
     FROM branches b
     JOIN organizations o ON o.id=b.organization_id
     WHERE b.id=$1 LIMIT 1`,
    [branchId]
  );
  return rows[0]||{timezone:'Africa/Dar_es_Salaam',business_date:null};
}

async function list(db,organizationId,branchId,filters={}){
  const q=String(filters.q||'').trim();
  const term=`%${q}%`;
  const method=String(filters.method||'').trim().toUpperCase();
  const startDate=filters.startDate;
  const endDate=filters.endDate;
  const timezone=filters.timezone||'Africa/Dar_es_Salaam';
  const page=Math.max(1,Number(filters.page)||1);
  const pageSize=Math.min(100,Math.max(1,Number(filters.pageSize)||25));
  const offset=(page-1)*pageSize;
  const params=[organizationId,branchId,q,term,method,startDate,endDate,timezone];

  const total=Number((await db.query(
    `SELECT COUNT(*)::int total
     FROM expenses e
     WHERE e.organization_id=$1 AND e.branch_id=$2
       AND ($3='' OR e.category ILIKE $4 OR COALESCE(e.description,'') ILIKE $4)
       AND ($5='' OR e.payment_method=$5)
       AND e.created_at >= ($6::date::timestamp AT TIME ZONE $8)
       AND e.created_at < ($7::date::timestamp AT TIME ZONE $8)`,
    params
  )).rows[0]?.total||0);

  const {rows}=await db.query(
    `SELECT e.*,u.name created_by_name
     FROM expenses e
     LEFT JOIN users u ON u.id=e.created_by
     WHERE e.organization_id=$1 AND e.branch_id=$2
       AND ($3='' OR e.category ILIKE $4 OR COALESCE(e.description,'') ILIKE $4)
       AND ($5='' OR e.payment_method=$5)
       AND e.created_at >= ($6::date::timestamp AT TIME ZONE $8)
       AND e.created_at < ($7::date::timestamp AT TIME ZONE $8)
     ORDER BY e.created_at DESC,e.id DESC
     LIMIT $9 OFFSET $10`,
    [...params,pageSize,offset]
  );
  return {rows,total};
}

async function openRegister(db,userId,branchId){
  const {rows}=await db.query('SELECT id FROM register_sessions WHERE user_id=$1 AND branch_id=$2 AND status=\'OPEN\' LIMIT 1',[userId,branchId]);
  return rows[0]||null;
}
async function create(db,data){
  const {rows}=await db.query(
    `INSERT INTO expenses(organization_id,branch_id,register_session_id,category,description,amount,payment_method,created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [data.organizationId,data.branchId,data.registerSessionId||null,data.category,data.description||null,data.amount,data.paymentMethod,data.userId]
  ); return rows[0];
}
async function registerMovement(db,sessionId,expenseId,amount,userId){
  await db.query(
    `INSERT INTO register_movements(register_session_id,movement_type,amount,reference_type,reference_id,performed_by)
     VALUES($1,'EXPENSE',$2,'EXPENSE',$3,$4)`,
    [sessionId,amount,expenseId,userId]
  );
}
module.exports={businessClock,list,openRegister,create,registerMovement};
