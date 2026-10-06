const {pool}=require('../../config/db');
const repo=require('./report.repository');
function valid(value){return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''));}

const PNL_PERIODS={
  today:{label:'Today',startOffset:0,endOffset:1},
  yesterday:{label:'Yesterday',startOffset:-1,endOffset:0},
  '7d':{label:'Last 7 Days',startOffset:-6,endOffset:1},
  '30d':{label:'Last 30 Days',startOffset:-29,endOffset:1},
  '1y':{label:'Last 1 Year',startOffset:-364,endOffset:1}
};

function shiftDate(isoDate,days){
  const d=new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate()+days);
  return d.toISOString().slice(0,10);
}

function pnlWindow(businessDate,key){
  const selected=PNL_PERIODS[key]||PNL_PERIODS.today;
  return {
    key:PNL_PERIODS[key]?key:'today',
    label:selected.label,
    startDate:shiftDate(businessDate,selected.startOffset),
    endDate:shiftDate(businessDate,selected.endOffset)
  };
}

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

async function inventory(req,res,next){
  try{
    res.render('reports/inventory',{
      title:'Inventory Report',
      rows:await repo.inventory(pool,req.session.user.organization_id,req.branch.id)
    });
  }catch(error){next(error);}
}

async function purchases(req,res,next){
  try{
    const clock=await repo.businessClock(pool,req.branch.id);
    const today=clock.business_date;
    const from=valid(req.query.from)?req.query.from:today;
    const to=valid(req.query.to)?req.query.to:today;
    res.render('reports/purchases',{
      title:'Purchase Report',
      rows:await repo.purchases(pool,req.branch.id,from,to),
      from,
      to
    });
  }catch(error){next(error);}
}

async function expiry(req,res,next){
  try{
    res.render('reports/expiry',{
      title:'Expiry Report',
      rows:await repo.expiry(pool,req.branch.id)
    });
  }catch(error){next(error);}
}

async function profitLoss(req,res,next){
  try{
    const clock=await repo.businessClock(pool,req.branch.id);
    const period=pnlWindow(clock.business_date,String(req.query.period||'today'));
    const [summary,expenseCategories]=await Promise.all([
      repo.profitLoss(
        pool,
        req.branch.id,
        period.startDate,
        period.endDate,
        clock.timezone
      ),
      repo.expenseBreakdown(
        pool,
        req.branch.id,
        period.startDate,
        period.endDate,
        clock.timezone
      )
    ]);

    const revenue=Number(summary.revenue||0);
    const grossProfit=Number(summary.gross_profit||0);
    const netProfit=Number(summary.net_profit||0);
    summary.gross_margin=revenue===0?'0.0':((grossProfit/revenue)*100).toFixed(1);
    summary.net_margin=revenue===0?'0.0':((netProfit/revenue)*100).toFixed(1);

    res.render('reports/profit-loss',{
      title:'Profit & Loss',
      summary,
      expenseCategories,
      period,
      periodToday:period.key==='today',
      periodYesterday:period.key==='yesterday',
      period7d:period.key==='7d',
      period30d:period.key==='30d',
      period1y:period.key==='1y'
    });
  }catch(error){next(error);}
}

module.exports={sales,inventory,purchases,expiry,profitLoss};
