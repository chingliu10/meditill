const {pool}=require('../../config/db');
const repo=require('./dashboard.repository');

async function index(req,res,next){
  try{
    const clock=await repo.businessClock(pool,req.session.user.organization_id);
    const [data,topSelling,expiryRisk,recentSales]=await Promise.all([
      repo.metrics(pool,req.session.user.organization_id,req.branch.id,clock.business_date,clock.timezone),
      repo.topSelling(pool,req.branch.id),
      repo.expiryRisk(pool,req.branch.id),
      repo.recentSales(pool,req.branch.id)
    ]);
    res.render('dashboard/index',{title:'Dashboard',data,topSelling,expiryRisk,recentSales});
  }catch(error){next(error);}
}
module.exports={index};