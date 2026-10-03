async function userBranch(db,userId,branchId){
  const {rows}=await db.query(
    `SELECT b.id,b.name,b.code FROM branches b
     JOIN user_branches ub ON ub.branch_id=b.id
     WHERE ub.user_id=$1 AND b.id=$2 AND b.active=true`,[userId,branchId]);
  return rows[0]||null;
}
module.exports={userBranch};
