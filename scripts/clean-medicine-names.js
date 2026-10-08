const DEMO_PREFIX='^[[:space:]]*Demo[[:space:]]*-[[:space:]]*';

function usage(){
  console.log('Preview: npm run db:clean-medicine-names -- <organization-id>');
  console.log('Apply:   npm run db:clean-medicine-names -- <organization-id> --apply');
  console.log('Uses DATABASE_URL. Changes only medicines.name; other data is untouched.');
}

function parseArgs(args){
  if(args.includes('--help')||args.includes('-h'))return null;
  const positional=args.filter(arg=>arg!=='--apply');
  if(positional.length!==1||args.length>2||!/^[1-9]\d*$/.test(positional[0])){
    throw new Error('Provide one positive organization ID and optional --apply.');
  }
  return {organizationId:positional[0],apply:args.includes('--apply')};
}

async function cleanMedicineNames(db,organizationId,{apply=false}={}){
  if(!/^[1-9]\d*$/.test(String(organizationId)))throw new Error('Invalid organization ID.');
  return db.withTransaction(async client=>{
    const organization=(await client.query(
      'SELECT id,name FROM organizations WHERE id=$1 FOR SHARE',[organizationId]
    )).rows[0];
    if(!organization)throw new Error('Organization not found.');

    const {rows:changes}=await client.query(
      `SELECT id,name AS old_name,btrim(regexp_replace(name,$2,'','i')) AS new_name
       FROM medicines WHERE organization_id=$1 AND name ~* $2
       ORDER BY id${apply?' FOR UPDATE':''}`,
      [organizationId,DEMO_PREFIX]
    );
    const invalid=changes.find(row=>!row.new_name);
    if(invalid)throw new Error(`Medicine ${invalid.id} would have an empty name. No changes applied.`);

    if(apply&&changes.length){
      const updated=await client.query(
        `UPDATE medicines m SET name=c.new_name
         FROM unnest($2::bigint[],$3::text[]) AS c(id,new_name)
         WHERE m.organization_id=$1 AND m.id=c.id RETURNING m.id`,
        [organizationId,changes.map(row=>row.id),changes.map(row=>row.new_name)]
      );
      if(updated.rowCount!==changes.length)throw new Error('Medicine count changed. Cleanup rolled back.');
    }
    return {organization,changes,applied:apply};
  });
}

async function main(){
  const input=parseArgs(process.argv.slice(2));
  if(!input){usage();return;}
  require('dotenv').config({quiet:true});
  const db=require('../src/config/db');
  try{
    const target=(await db.pool.query(
      'SELECT current_database() AS database,inet_server_addr()::text AS host,inet_server_port() AS port'
    )).rows[0];
    console.log(`Database: ${target.database}; server: ${target.host||'local socket'}${target.port?':'+target.port:''}`);
    const result=await cleanMedicineNames(db,input.organizationId,{apply:input.apply});
    console.log(`Organization: ${result.organization.id} - ${result.organization.name}`);
    if(result.changes.length)console.table(result.changes);
    console.log(input.apply
      ?`Updated ${result.changes.length} medicine names. All other data was left unchanged.`
      :`Preview only: ${result.changes.length} medicine names would change. Run again with --apply to save.`);
  }finally{await db.pool.end();}
}

if(require.main===module){
  main().catch(error=>{console.error('Medicine name cleanup failed: '+error.message);process.exitCode=1;});
}
module.exports={cleanMedicineNames,parseArgs};
