const {pool}=require('../../config/db');
const repo=require('./report.repository');
const {PERIODS,resolvePeriod,safePage,pagination}=require('../../shared/list-pagination');
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
    const range=resolvePeriod(clock.business_date,String(req.query.period||'7d'));
    const [summary,days]=await Promise.all([
      repo.salesSummary(pool,req.branch.id,range.startDate,range.endDate,clock.timezone),
      repo.daily(pool,req.branch.id,range.startDate,range.endDate,clock.timezone)
    ]);
    res.render('reports/sales',{
      title:'Sales Report',
      summary,
      days,
      period:range.period.key,
      periods:PERIODS.map(item=>({
        ...item,
        active:item.key===range.period.key,
        url:'/reports/sales?period='+item.key
      }))
    });
  }catch(error){next(error);}
}

async function inventory(req,res,next){
  try{
    const q=String(req.query.q||'').trim();
    const requestedPage=safePage(req.query.page);
    let result=await repo.inventory(pool,req.session.user.organization_id,req.branch.id,{q,page:requestedPage,pageSize:25});
    const makeUrl=page=>{
      const params=new URLSearchParams();
      if(q)params.set('q',q);
      if(page>1)params.set('page',String(page));
      return '/reports/inventory'+(params.toString()?('?'+params.toString()):'');
    };
    const pager=pagination(result.total,requestedPage,25,makeUrl);
    if(pager.page!==requestedPage){
      result=await repo.inventory(pool,req.session.user.organization_id,req.branch.id,{q,page:pager.page,pageSize:25});
    }
    res.render('reports/inventory',{title:'Inventory Report',rows:result.rows,q,pagination:pager});
  }catch(error){next(error);}
}

async function purchases(req,res,next){
  try{
    const clock=await repo.businessClock(pool,req.branch.id);
    const range=resolvePeriod(clock.business_date,String(req.query.period||'7d'));
    res.render('reports/purchases',{
      title:'Purchase Report',
      rows:await repo.purchases(pool,req.branch.id,range.startDate,shiftDate(range.endDate,-1)),
      period:range.period.key,
      periods:PERIODS.map(item=>({
        ...item,
        active:item.key===range.period.key,
        url:'/reports/purchases?period='+item.key
      }))
    });
  }catch(error){next(error);}
}

async function expiry(req,res,next){
  try{
    const q=String(req.query.q||'').trim();
    const allowedDays=[30,60,90,365];
    const requestedDays=Number(req.query.days||90);
    const days=allowedDays.includes(requestedDays)?requestedDays:90;
    const requestedPage=safePage(req.query.page);

    let result=await repo.expiry(pool,req.branch.id,{q,days,page:requestedPage,pageSize:25});
    const makeUrl=page=>{
      const params=new URLSearchParams();
      params.set('days',String(days));
      if(q)params.set('q',q);
      if(page>1)params.set('page',String(page));
      return '/reports/expiry?'+params.toString();
    };
    const pager=pagination(result.total,requestedPage,25,makeUrl);
    if(pager.page!==requestedPage){
      result=await repo.expiry(pool,req.branch.id,{q,days,page:pager.page,pageSize:25});
    }

    res.render('reports/expiry',{
      title:'Expiry Report',
      rows:result.rows,
      q,
      days,
      horizonOptions:[
        {days:30,label:'Next 30 Days',active:days===30,url:'/reports/expiry?days=30'+(q?'&q='+encodeURIComponent(q):'')},
        {days:60,label:'Next 60 Days',active:days===60,url:'/reports/expiry?days=60'+(q?'&q='+encodeURIComponent(q):'')},
        {days:90,label:'Next 90 Days',active:days===90,url:'/reports/expiry?days=90'+(q?'&q='+encodeURIComponent(q):'')},
        {days:365,label:'Next 1 Year',active:days===365,url:'/reports/expiry?days=365'+(q?'&q='+encodeURIComponent(q):'')}
      ],
      pagination:pager
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
