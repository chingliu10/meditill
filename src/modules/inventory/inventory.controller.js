const {pool}=require('../../config/db');
const repo=require('./inventory.repository');
const service=require('./inventory.service');
const {setFlash}=require('../../shared/flash');
const {safePage,pagination}=require('../../shared/list-pagination');

const STOCK_STATUSES=['','in','low','out'];
const BATCH_STATUSES=['','SALEABLE','QUARANTINED','RECALLED','DAMAGED'];

function stockUrl(q,status,page){
  const params=new URLSearchParams({tab:'stock'});
  if(q)params.set('stock_q',q);
  if(status)params.set('stock_status',status);
  if(page>1)params.set('stock_page',String(page));
  return '/inventory?'+params.toString();
}
function batchUrl(q,status,page){
  const params=new URLSearchParams({tab:'batches'});
  if(q)params.set('batch_q',q);
  if(status)params.set('batch_status',status);
  if(page>1)params.set('batch_page',String(page));
  return '/inventory?'+params.toString();
}

async function index(req,res,next){
  try{
    const activeTab=['stock','batches','adjust'].includes(String(req.query.tab))?String(req.query.tab):'stock';
    const stockQ=String(req.query.stock_q||'').trim();
    const stockStatus=STOCK_STATUSES.includes(String(req.query.stock_status||'').toLowerCase())?String(req.query.stock_status||'').toLowerCase():'';
    const batchQ=String(req.query.batch_q||req.query.q||'').trim();
    const rawBatchStatus=String(req.query.batch_status||'').toUpperCase();
    const batchStatus=BATCH_STATUSES.includes(rawBatchStatus)?rawBatchStatus:'';
    const requestedStockPage=safePage(req.query.stock_page);
    const requestedBatchPage=safePage(req.query.batch_page);

    let [stockResult,batchResult,adjustmentBatches]=await Promise.all([
      repo.stock(pool,req.session.user.organization_id,req.branch.id,{q:stockQ,status:stockStatus,page:requestedStockPage,pageSize:25}),
      repo.batches(pool,req.branch.id,{q:batchQ,status:batchStatus,page:requestedBatchPage,pageSize:25}),
      repo.adjustmentBatches(pool,req.branch.id)
    ]);

    const stockPager=pagination(stockResult.total,requestedStockPage,25,page=>stockUrl(stockQ,stockStatus,page));
    const batchPager=pagination(batchResult.total,requestedBatchPage,25,page=>batchUrl(batchQ,batchStatus,page));

    if(stockPager.page!==requestedStockPage){
      stockResult=await repo.stock(pool,req.session.user.organization_id,req.branch.id,{q:stockQ,status:stockStatus,page:stockPager.page,pageSize:25});
    }
    if(batchPager.page!==requestedBatchPage){
      batchResult=await repo.batches(pool,req.branch.id,{q:batchQ,status:batchStatus,page:batchPager.page,pageSize:25});
    }

    res.render('inventory/index',{
      title:'Inventory',
      stock:stockResult.rows,
      batches:batchResult.rows,
      adjustmentBatches,
      activeTab,
      stockQ,stockStatus,batchQ,batchStatus,
      stockStatusOptions:[
        {value:'',label:'All stock',selected:stockStatus===''},
        {value:'in',label:'In stock',selected:stockStatus==='in'},
        {value:'low',label:'Low stock',selected:stockStatus==='low'},
        {value:'out',label:'Out of stock',selected:stockStatus==='out'}
      ],
      batchStatusOptions:[
        {value:'',label:'All statuses',selected:batchStatus===''},
        {value:'SALEABLE',label:'Saleable',selected:batchStatus==='SALEABLE'},
        {value:'QUARANTINED',label:'Quarantined',selected:batchStatus==='QUARANTINED'},
        {value:'RECALLED',label:'Recalled',selected:batchStatus==='RECALLED'},
        {value:'DAMAGED',label:'Damaged',selected:batchStatus==='DAMAGED'}
      ],
      stockPagination:stockPager,
      batchPagination:batchPager
    });
  }catch(e){next(e);}
}

async function expiring(req,res,next){try{res.json(await repo.expiring(pool,req.branch.id,Number(req.query.days||90)));}catch(e){next(e);}}
async function adjust(req,res,next){
  try{
    const a=await service.adjust(req.body,{user:req.session.user,branch:req.branch});
    setFlash(req,'success',`Adjustment ${a.adjustment_number} posted.`);
    res.redirect('/inventory?tab=adjust');
  }catch(error){
    console.error('[INVENTORY] Adjustment failed',{organizationId:req.session.user?.organization_id,branchId:req.branch?.id,batchId:req.body?.batch_id,quantityChange:req.body?.quantity_change,code:error.code,constraint:error.constraint,detail:error.detail,message:error.message,stage:error.adjustmentStage||null});
    next(error);
  }
}
async function status(req,res,next){try{const b=await service.changeStatus({batch_id:req.params.id,status:req.body.status},{user:req.session.user,branch:req.branch});res.json(b);}catch(e){next(e);}}
module.exports={index,expiring,adjust,status};
