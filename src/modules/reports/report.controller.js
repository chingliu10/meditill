const {pool}=require('../../config/db');const repo=require('./report.repository');
function today(){return new Date().toISOString().slice(0,10)}
async function sales(req,res,next){try{const from=req.query.from||today(),to=req.query.to||today();const [summary,days]=await Promise.all([repo.salesSummary(pool,req.branch.id,from,to),repo.daily(pool,req.branch.id,from,to)]);res.render('reports/sales',{title:'Sales Report',summary,days,from,to});}catch(e){next(e);}}
module.exports={sales};
