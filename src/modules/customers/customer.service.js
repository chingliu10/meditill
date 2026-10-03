const {pool}=require('../../config/db');
const repo=require('./customer.repository');
const {appError}=require('../../shared/app-error');

async function createCustomer(input,organizationId){
  const name=String(input.name||'').trim();
  if(!name) throw appError('Customer name is required');
  return repo.create(pool,{
    organizationId,
    name,
    phone:String(input.phone||'').trim(),
    email:String(input.email||'').trim(),
    address:String(input.address||'').trim()
  });
}
module.exports={createCustomer};
