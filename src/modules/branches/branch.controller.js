const {pool}=require('../../config/db');
const repo=require('./branch.repository');
async function switchBranch(req,res,next){
  try{
    const branch=await repo.userBranch(pool,req.session.user.id,req.body.branch_id);
    if(!branch){const e=new Error('Branch access denied');e.statusCode=403;throw e;}
    req.session.currentBranch=branch;
    res.redirect(req.get('referer')||'/');
  }catch(e){next(e);}
}
module.exports={switchBranch};
