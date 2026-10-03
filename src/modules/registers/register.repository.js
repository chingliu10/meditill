async function registers(db,branchId){
  const {rows}=await db.query('SELECT id,name FROM registers WHERE branch_id=$1 AND active=true ORDER BY name',[branchId]);
  return rows;
}
async function openSession(db,registerId,branchId,userId,openingCash){
  const {rows}=await db.query(
    `INSERT INTO register_sessions(register_id,branch_id,user_id,opening_cash)
     VALUES($1,$2,$3,$4) RETURNING *`,[registerId,branchId,userId,openingCash]);
  await db.query(
    `INSERT INTO register_movements(register_session_id,movement_type,amount,performed_by)
     VALUES($1,'OPENING',$2,$3)`,[rows[0].id,openingCash,userId]);
  return rows[0];
}
async function current(db,userId){
  const {rows}=await db.query(
    `SELECT rs.*,r.name register_name FROM register_sessions rs
     JOIN registers r ON r.id=rs.register_id
     WHERE rs.user_id=$1 AND rs.status='OPEN' LIMIT 1`,[userId]);
  return rows[0]||null;
}
async function expectedCash(db,sessionId){
  const {rows}=await db.query(
    `SELECT COALESCE(sum(CASE
      WHEN movement_type IN('OPENING','CASH_SALE','CASH_IN') THEN amount
      WHEN movement_type IN('CASH_REFUND','CASH_OUT','EXPENSE') THEN -amount
      ELSE 0 END),0) expected
     FROM register_movements WHERE register_session_id=$1`,[sessionId]);
  return Number(rows[0].expected||0);
}
async function close(db,sessionId,actual,expected){
  const {rows}=await db.query(
    `UPDATE register_sessions SET status='CLOSED',closed_at=now(),expected_cash=$2,actual_cash=$3,difference=$3-$2
     WHERE id=$1 AND status='OPEN' RETURNING *`,[sessionId,expected,actual]);
  return rows[0]||null;
}
module.exports={registers,openSession,current,expectedCash,close};
