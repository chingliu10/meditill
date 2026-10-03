async function list(db,organizationId,branchId){
  const {rows}=await db.query(
    `SELECT e.*,u.name created_by_name FROM expenses e LEFT JOIN users u ON u.id=e.created_by
     WHERE e.organization_id=$1 AND e.branch_id=$2 ORDER BY e.created_at DESC LIMIT 200`,
    [organizationId,branchId]
  ); return rows;
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
module.exports={list,openRegister,create,registerMovement};
