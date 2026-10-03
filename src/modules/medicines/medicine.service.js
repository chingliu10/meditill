const {withTransaction}=require('../../config/db');
const repo=require('./medicine.repository');
const {appError}=require('../../shared/app-error');

async function createMedicine(input,context){
  const name=String(input.name||'').trim();
  if(!name) throw appError('Medicine name is required');
  const sellingPrice=Number(input.selling_price||0);
  if(sellingPrice<0) throw appError('Selling price cannot be negative');
  return withTransaction(client=>repo.create(client,{
    organizationId:context.user.organization_id,userId:context.user.id,name,
    genericName:String(input.generic_name||'').trim(),brandName:String(input.brand_name||'').trim(),
    strength:String(input.strength||'').trim(),dosageForm:String(input.dosage_form||'').trim(),
    barcode:String(input.barcode||'').trim(),sku:String(input.sku||'').trim(),
    categoryId:input.category_id,manufacturerId:input.manufacturer_id,baseUnitId:input.base_unit_id,
    sellingPrice,reorderLevel:Number(input.reorder_level||0),prescriptionRequired:input.prescription_required==='on',
    trackExpiry:input.track_expiry!=='off',description:String(input.description||'').trim()
  }));
}
module.exports={createMedicine};
