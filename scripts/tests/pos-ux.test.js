const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const state=require('../../public/js/pos-state');
const repo=require('../../src/modules/pos/pos.repository');
test('POS no longer reads or renders the separate strength field',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../../public/js/pos.js'),'utf8');
  assert.doesNotMatch(source,/\.strength\b|mt-product-strength|mt-cart-strength|Strength not specified/);
});
const line={key:'1:base',id:1,conversion:1,saleQty:1,stock:12,allowFraction:false};
test('cash entered by cashier survives quantity and price changes',()=>{
  assert.equal(state.paymentValue(2000,'5000',true,'CASH'),'5000');
  assert.equal(state.paymentValue(6000,'5000',true,'CASH'),'5000');
});
test('exact and non-cash amounts track the cart; empty cart resets',()=>{
  assert.equal(state.paymentValue(2000,'1000',false,'CASH'),'2000');
  assert.equal(state.paymentValue(2000,'5000',true,'CARD'),'2000');
  assert.equal(state.paymentValue(0,'5000',true,'CASH'),'');
});
test('stock is shared between base units and packages',()=>{
  const pack={...line,key:'1:u10',conversion:10};
  assert.equal(state.quantityAllowed([line,pack],line,3),false);
  assert.equal(state.quantityAllowed([line,pack],line,2),true);
});
test('quantity rejects nonfinite, nonpositive and fractional whole units',()=>{
  for(const qty of [NaN,Infinity,0,-1,.5])assert.equal(state.quantityAllowed([line],line,qty),false);
  assert.equal(state.quantityAllowed([],{...line,allowFraction:true},.5),true);
});
const draft={version:1,scope:'1:1:1:6',time:100000,items:[{id:1,unitId:null,qty:1,price:1000}],
  customerId:null,amount:'5000',method:'CASH',pending:true};
test('draft accepts pending checkout without losing its marker',()=>assert.equal(state.readDraft(JSON.stringify(draft),draft.scope,100001).pending,true));
test('drafts cannot cross users, branches or register sessions',()=>{
  for(const scope of ['1:2:1:6','1:1:2:6','1:1:1:7'])assert.equal(state.readDraft(JSON.stringify(draft),scope,100001),null);
});
test('expired, corrupt and duplicate drafts are rejected',()=>{
  assert.equal(state.readDraft('{',draft.scope),null);
  assert.equal(state.readDraft(JSON.stringify(draft),draft.scope,100000+43200001),null);
  assert.equal(state.readDraft(JSON.stringify({...draft,items:[...draft.items,...draft.items]}),draft.scope,100001),null);
});
test('catalog SQL scopes stock and filters before paginating with bound values',async()=>{
  let captured;
  const db={query:async(sql,params)=>{captured={sql,params};return {rows:[]};}};
  await repo.search(db,1,2,"%' OR true --",{categoryId:3,stockOnly:true,limit:50,offset:50});
  assert.deepEqual(captured.params.slice(5),[3,true,50,50,null]);
  assert.match(captured.sql,/m.organization_id=\$1/);
  assert.match(captured.sql,/b.branch_id=\$2/);
  assert.match(captured.sql,/COUNT\(\*\) OVER\(\)/);
  assert.match(captured.sql,/LIMIT \$8 OFFSET \$9/);
  assert.ok(!captured.sql.includes("%' OR true --"));
});
