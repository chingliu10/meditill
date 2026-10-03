const {pool}=require('../../config/db');
const repo=require('./dashboard.repository');
async function index(req,res,next){try{
  const data=await repo.metrics(pool,req.session.user.organization_id,req.branch.id);
  res.render('dashboard/index',{title:'Dashboard',data,branches:req.session.branches});
}catch(e){next(e);}}
module.exports={index};
