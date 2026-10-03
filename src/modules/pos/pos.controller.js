const {pool}=require('../../config/db');
const repo=require('./pos.repository');
const service=require('./pos.service');
const medRepo=require('../medicines/medicine.repository');

async function index(req,res,next){
  try{
    const register=await repo.openRegister(pool,req.session.user.id,req.branch.id);
    res.render('pos/index',{title:'POS',register});
  }catch(error){
    next(error);
  }
}

async function search(req,res,next){
  try{
    res.json(await repo.search(
      pool,
      req.session.user.organization_id,
      req.branch.id,
      req.query.q||''
    ));
  }catch(error){
    next(error);
  }
}

async function barcode(req,res,next){
  try{
    const med=await medRepo.byBarcode(
      pool,
      req.session.user.organization_id,
      req.branch.id,
      req.params.barcode
    );

    if(!med) return res.status(404).json({error:'Medicine not found'});
    res.json(med);
  }catch(error){
    next(error);
  }
}

async function sale(req,res,next){
  try{
    const created=await service.completeSale(req.body,{
      user:req.session.user,
      branch:req.branch
    });

    console.info('[SALE] Completed', {
      saleId:created.id,
      saleNumber:created.sale_number,
      branchId:created.branch_id,
      registerSessionId:created.register_session_id,
      total:created.total,
      amountPaid:created.amount_paid,
      change:created.change_amount
    });

    res.status(201).json(created);
  }catch(error){
    console.warn('[SALE] Failed', {
      branchId:req.branch.id,
      userId:req.session.user.id,
      code:error.code||'SALE_ERROR',
      message:error.message
    });
    next(error);
  }
}

module.exports={index,search,barcode,sale};
