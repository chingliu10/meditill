const {pool}=require('../../config/db');const repo=require('./supplier.repository');const {appError}=require('../../shared/app-error');
async function createSupplier(input,organizationId){const name=String(input.name||'').trim();if(!name)throw appError('Supplier name is required');return repo.create(pool,{organizationId,name,contactPerson:input.contact_person,phone:input.phone,email:input.email,address:input.address,notes:input.notes});}
module.exports={createSupplier};
