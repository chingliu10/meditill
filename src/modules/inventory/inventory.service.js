const {withTransaction}=require('../../config/db');
const repo=require('./inventory.repository');
const {nextDocumentNumber}=require('../../shared/document-number');
const {appError}=require('../../shared/app-error');

function stage(error,name){
  error.adjustmentStage=name;
  return error;
}

async function adjust(input,ctx){
  const batchId=Number(input.batch_id);
  const change=Number(input.quantity_change);
  const reason=String(input.reason||'').trim().toUpperCase();

  if(!Number.isInteger(batchId)||batchId<=0) throw appError('Choose a valid batch');
  if(!Number.isFinite(change)||change===0) throw appError('Quantity change cannot be zero');
  if(!reason) throw appError('Adjustment reason is required');

  return withTransaction(async client=>{
    let batch;
    try{
      batch=await repo.lockBatch(client,ctx.branch.id,batchId);
    }catch(error){throw stage(error,'lock_batch');}

    if(!batch) throw appError('Batch not found',404);

    if(!batch.allow_fraction&&!Number.isInteger(change)){
      throw appError(`${batch.medicine_name||'This medicine'} uses ${batch.unit_name||'a countable unit'} and requires a whole-number adjustment`);
    }

    const currentQty=Number(batch.quantity_available);
    const newQty=Number((currentQty+change).toFixed(4));
    if(newQty<0) throw appError('Adjustment would make stock negative',409);

    let number;
    try{
      number=await nextDocumentNumber(
        client,
        ctx.user.organization_id,
        ctx.branch.id,
        'ADJUSTMENT',
        'ADJ'
      );
    }catch(error){throw stage(error,'document_number');}

    let adjustment;
    try{
      adjustment=await repo.createAdjustment(client,{
        organizationId:ctx.user.organization_id,
        branchId:ctx.branch.id,
        userId:ctx.user.id,
        number,
        reason,
        notes:String(input.notes||'').trim()
      });
    }catch(error){throw stage(error,'create_adjustment');}

    try{
      await repo.createAdjustmentItem(client,adjustment.id,batch,change,String(input.notes||'').trim());
    }catch(error){throw stage(error,'create_item');}

    let updated;
    try{
      updated=await repo.updateBatchQuantity(client,batch.id,newQty);
      if(!updated) throw appError('Batch quantity could not be updated',409,'BATCH_UPDATE_FAILED');
    }catch(error){throw stage(error,'update_batch');}

    try{
      await repo.movement(client,{
        organizationId:ctx.user.organization_id,
        branchId:ctx.branch.id,
        medicineId:batch.medicine_id,
        batchId:batch.id,
        type:'ADJUSTMENT',
        quantity:change,
        unitCost:batch.unit_cost,
        referenceType:'ADJUSTMENT',
        referenceId:adjustment.id,
        notes:reason,
        userId:ctx.user.id
      });
    }catch(error){throw stage(error,'stock_movement');}

    return {...adjustment,previous_quantity:currentQty,new_quantity:newQty};
  });
}

async function changeStatus(input,ctx){
  const allowed=new Set(['SALEABLE','QUARANTINED','RECALLED','DAMAGED']);
  const status=String(input.status||'').toUpperCase();
  if(!allowed.has(status)) throw appError('Invalid batch status');

  return withTransaction(async client=>{
    const batch=await repo.lockBatch(client,ctx.branch.id,Number(input.batch_id));
    if(!batch) throw appError('Batch not found',404);
    const updated=await repo.setBatchStatus(client,ctx.branch.id,batch.id,status);
    await client.query(
      `INSERT INTO audit_logs(organization_id,branch_id,user_id,action,entity_type,entity_id,before_data,after_data)
       VALUES($1,$2,$3,'BATCH_STATUS_CHANGE','medicine_batch',$4,$5::jsonb,$6::jsonb)`,
      [
        ctx.user.organization_id,
        ctx.branch.id,
        ctx.user.id,
        batch.id,
        JSON.stringify({status:batch.status}),
        JSON.stringify({status})
      ]
    );
    return updated;
  });
}

module.exports={adjust,changeStatus};
