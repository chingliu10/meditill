const {pool}=require('../../config/db');
const repo=require('./report.repository');
function valid(value){return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''));}

async function sales(req,res,next){
  try{
    const clock=await repo.businessClock(pool,req.branch.id);
    const today=clock.business_date;
    const from=valid(req.query.from)?req.query.from:today;
    const to=valid(req.query.to)?req.query.to:today;
    const [summary,days]=await Promise.all([
      repo.salesSummary(pool,req.branch.id,from,to,clock.timezone),
      repo.daily(pool,req.branch.id,from,to,clock.timezone)
    ]);
    res.render('reports/sales',{title:'Sales Report',summary,days,from,to});
  }catch(error){next(error);}
}
async function inventory(req,res,next){try{res.render('reports/inventory',{title:'Inventory Report',rows:await repo.inventory(pool,req.session.user.organization_id,req.branch.id)});}catch(error){next(error);}}
async function purchases(req,res,next){
  try{
    const clock=await repo.businessClock(pool,req.branch.id);
    const today=clock.business_date;
    const from=valid(req.query.from)?req.query.from:today;
    const to=valid(req.query.to)?req.query.to:today;
    res.render('reports/purchases',{title:'Purchase Report',rows:await repo.purchases(pool,req.branch.id,from,to),from,to});
  }catch(error){next(error);}
}
async function expiry(req,res,next){try{res.render('reports/expiry',{title:'Expiry Report',rows:await repo.expiry(pool,req.branch.id)});}catch(error){next(error);}}
module.exports={sales,inventory,purchases,expiry};