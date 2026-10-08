const test=require('node:test');
const assert=require('node:assert/strict');
const {cleanMedicineNames,parseArgs}=require('../clean-medicine-names');

function fixture(){
  const medicines=[
    {id:1,organization_id:1,name:'Demo - Amoxicillin 500 mg',sku:'DEMO-RICH-1-M01',price:1000},
    {id:2,organization_id:1,name:'demo - Cetirizine 10 mg',sku:'DEMO-RICH-1-M02',price:500},
    {id:3,organization_id:1,name:'Demodex lotion',sku:'REAL-03',price:900},
    {id:4,organization_id:2,name:'Demo - Vitamin C',sku:'DEMO-RICH-2-M01',price:800},
    {id:5,organization_id:1,name:'Demo Pharmacy',sku:'REAL-05',price:700},
    {id:6,organization_id:1,name:'Medicine with Demo - inside',sku:'REAL-06',price:700}
  ];
  const calls=[];
  let commits=0,rollbacks=0;
  const client={query:async(sql,params)=>{
    calls.push({sql,params});
    if(sql.startsWith('SELECT id,name FROM organizations'))return {rows:[{id:1,name:'Test Pharmacy'}]};
    if(sql.includes('regexp_replace'))return {rows:medicines
      .filter(med=>String(med.organization_id)===String(params[0])&&/^\s*Demo\s*-\s*/i.test(med.name))
      .map(med=>({id:med.id,old_name:med.name,new_name:med.name.replace(/^\s*Demo\s*-\s*/i,'').trim()}))};
    if(sql.includes('UPDATE medicines')){
      params[1].forEach((id,index)=>{medicines.find(med=>med.id===id).name=params[2][index];});
      return {rowCount:params[1].length};
    }
    throw new Error('Unexpected SQL');
  }};
  const db={withTransaction:async work=>{
    const snapshot=structuredClone(medicines);
    try{const result=await work(client);commits++;return result;}
    catch(error){medicines.splice(0,medicines.length,...snapshot);rollbacks++;throw error;}
  }};
  return {db,client,medicines,calls,counts:()=>({commits,rollbacks})};
}

test('CLI defaults to preview and requires explicit apply',()=>{
  assert.deepEqual(parseArgs(['1']),{organizationId:'1',apply:false});
  assert.deepEqual(parseArgs(['1','--apply']),{organizationId:'1',apply:true});
  assert.equal(parseArgs(['--help']),null);
  for(const args of [[],['0'],['1; DELETE'],['1','--all'],['1','2']])assert.throws(()=>parseArgs(args));
});
test('preview lists old and new names without writing anything',async()=>{
  const f=fixture(),before=structuredClone(f.medicines);
  const result=await cleanMedicineNames(f.db,'1');
  assert.deepEqual(result.changes.map(row=>row.new_name),['Amoxicillin 500 mg','Cetirizine 10 mg']);
  assert.deepEqual(f.medicines,before);
  assert.ok(f.calls.every(call=>!call.sql.includes('UPDATE medicines')));
});
test('apply changes only matching medicine names in the chosen organization',async()=>{
  const f=fixture(),expected=structuredClone(f.medicines);
  expected[0].name='Amoxicillin 500 mg';expected[1].name='Cetirizine 10 mg';
  await cleanMedicineNames(f.db,'1',{apply:true});
  assert.deepEqual(f.medicines,expected);
  assert.ok(f.calls.some(call=>call.sql.includes('ORDER BY id FOR UPDATE')));
  const update=f.calls.find(call=>call.sql.includes('UPDATE medicines'));
  assert.match(update.sql,/SET name=c.new_name/);
  assert.match(update.sql,/m.organization_id=\$1/);
  assert.deepEqual(update.params,['1',[1,2],['Amoxicillin 500 mg','Cetirizine 10 mg']]);
});
test('running cleanup again makes no further changes',async()=>{
  const f=fixture();
  await cleanMedicineNames(f.db,'1',{apply:true});
  const result=await cleanMedicineNames(f.db,'1',{apply:true});
  assert.equal(result.changes.length,0);
  assert.equal(f.calls.filter(call=>call.sql.includes('UPDATE medicines')).length,1);
});
test('empty cleaned names abort the entire transaction',async()=>{
  const f=fixture();f.medicines[1].name='Demo - ';
  const before=structuredClone(f.medicines);
  await assert.rejects(cleanMedicineNames(f.db,'1',{apply:true}),/empty name/);
  assert.deepEqual(f.medicines,before);
  assert.equal(f.counts().rollbacks,1);
});
test('unknown organization and invalid identifiers cannot update data',async()=>{
  const f=fixture();
  await assert.rejects(cleanMedicineNames(f.db,'1 OR true',{apply:true}),/Invalid organization/);
  f.client.query=async()=>({rows:[]});
  await assert.rejects(cleanMedicineNames(f.db,'99',{apply:true}),/Organization not found/);
});
test('a failed update count rolls back changes',async()=>{
  const f=fixture(),before=structuredClone(f.medicines),query=f.client.query;
  f.client.query=async(sql,params)=>{
    const result=await query(sql,params);
    return sql.includes('UPDATE medicines')?{rowCount:0}:result;
  };
  await assert.rejects(cleanMedicineNames(f.db,'1',{apply:true}),/rolled back/);
  assert.deepEqual(f.medicines,before);
});
