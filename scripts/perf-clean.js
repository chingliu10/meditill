const {pool}=require('../src/config/db');

const ORG_NAME='MediTill Performance Lab';

async function clean(){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const org=(await client.query('SELECT id FROM organizations WHERE name=$1 LIMIT 1',[ORG_NAME])).rows[0];
    if(!org){
      console.log('No performance-lab organization found.');
      await client.query('ROLLBACK');
      return;
    }

    const branchIds=(await client.query('SELECT id FROM branches WHERE organization_id=$1',[org.id])).rows.map(r=>r.id);

    if(branchIds.length){
      await client.query('DELETE FROM register_movements WHERE register_session_id IN (SELECT id FROM register_sessions WHERE branch_id=ANY($1::bigint[]))',[branchIds]);
      await client.query('DELETE FROM register_sessions WHERE branch_id=ANY($1::bigint[])',[branchIds]);
    }

    await client.query('DELETE FROM organizations WHERE id=$1',[org.id]);
    await client.query('COMMIT');
    console.log('Performance-lab dataset removed.');
  }catch(error){
    await client.query('ROLLBACK');
    throw error;
  }finally{
    client.release();
    await pool.end();
  }
}

clean().catch(error=>{console.error(error);process.exit(1);});
