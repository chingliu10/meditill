const {pool}=require('../../config/db');
const repo=require('./customer.repository');
const {appError}=require('../../shared/app-error');

async function createCustomer(input,organizationId){
  const name=String(input.name||'').trim();
  if(!name) throw appError('Customer name is required');
  return repo.create(pool,{organizationId,name,phone:String(input.phone||'').trim(),email:String(input.email||'').trim(),address:String(input.address||'').trim()});
}
async function setCustomerActive(id,active,organizationId){
  const customer=await repo.findById(pool,organizationId,id);
  if(!customer) throw appError('Customer not found',404);
  if(customer.is_walk_in) throw appError('The system walk-in customer cannot be archived',409);
  const updated=await repo.setActive(pool,organizationId,id,active);
  if(!updated) throw appError('Customer could not be updated',409);
  return updated;
}
module.exports={createCustomer,setCustomerActive};