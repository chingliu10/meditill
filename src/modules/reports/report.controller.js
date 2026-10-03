const {pool}=require('../../config/db');
const repo=require('./report.repository');

function localDate(){
  const now=new Date();
  const year=now.getFullYear();
  const month=String(now.getMonth()+1).padStart(2,'0');
  const day=String(now.getDate()).padStart(2,'0');
  return `${year}-${month}-${day}`;
}

function validDate(value){
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''));
}

async function sales(req,res,next){
  try{
    const today=localDate();
    const from=validDate(req.query.from) ? req.query.from : today;
    const to=validDate(req.query.to) ? req.query.to : today;

    const [summary,days]=await Promise.all([
      repo.salesSummary(pool,req.branch.id,from,to),
      repo.daily(pool,req.branch.id,from,to)
    ]);

    res.render('reports/sales',{
      title:'Sales Report',
      summary,
      days,
      from,
      to
    });
  }catch(error){
    console.error('[REPORT] Sales report failed',{
      branchId:req.branch && req.branch.id,
      from:req.query.from||null,
      to:req.query.to||null,
      message:error.message,
      code:error.code||null
    });
    next(error);
  }
}

module.exports={sales};
