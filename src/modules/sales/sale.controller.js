const {pool}=require('../../config/db');
const repo=require('./sale.repository');
const returns=require('./return.service');
const {appError}=require('../../shared/app-error');
const {setFlash}=require('../../shared/flash');

const PERIODS=[
  {key:'today',label:'Today',days:1},
  {key:'yesterday',label:'Yesterday',days:1,yesterday:true},
  {key:'7d',label:'Last 7 Days',days:7},
  {key:'30d',label:'Last 30 Days',days:30},
  {key:'1y',label:'Last 1 Year',days:365}
];

function shiftDate(iso,days){
  const date=new Date(iso+'T12:00:00Z');
  date.setUTCDate(date.getUTCDate()+days);
  return date.toISOString().slice(0,10);
}

function periodRange(businessDate,key){
  const period=PERIODS.find(item=>item.key===key)||PERIODS[2];
  if(period.yesterday){
    const start=shiftDate(businessDate,-1);
    return {period,startDate:start,endDate:businessDate};
  }
  return {
    period,
    startDate:shiftDate(businessDate,-(period.days-1)),
    endDate:shiftDate(businessDate,1)
  };
}

function makeUrl({period,q,page}){
  const params=new URLSearchParams();
  params.set('period',period);
  if(q)params.set('q',q);
  if(page&&page>1)params.set('page',String(page));
  return '/sales?'+params.toString();
}

async function index(req,res,next){
  try{
    const q=String(req.query.q||'').trim();
    const requestedPeriod=String(req.query.period||'7d');
    const requestedPage=Math.max(1,Number.parseInt(req.query.page,10)||1);
    const clock=await repo.businessClock(pool,req.branch.id);
    const {period,startDate,endDate}=periodRange(clock.business_date,requestedPeriod);

    let result=await repo.list(pool,req.session.user.organization_id,req.branch.id,{
      q,
      startDate,
      endDate,
      timezone:clock.timezone,
      page:requestedPage,
      pageSize:25
    });

    const totalPages=Math.max(1,Math.ceil(result.total/result.pageSize));
    const page=Math.min(requestedPage,totalPages);

    if(page!==requestedPage){
      result=await repo.list(pool,req.session.user.organization_id,req.branch.id,{
        q,
        startDate,
        endDate,
        timezone:clock.timezone,
        page,
        pageSize:25
      });
    }

    const firstRow=result.total?((page-1)*result.pageSize)+1:0;
    const lastRow=result.total?Math.min(page*result.pageSize,result.total):0;

    const pageLinks=[];
    const fromPage=Math.max(1,page-2);
    const toPage=Math.min(totalPages,page+2);
    for(let value=fromPage;value<=toPage;value++){
      pageLinks.push({
        value,
        active:value===page,
        url:makeUrl({period:period.key,q,page:value})
      });
    }

    res.render('sales/index',{
      title:'Sales',
      sales:result.rows,
      q,
      period:period.key,
      periods:PERIODS.map(item=>({
        ...item,
        active:item.key===period.key,
        url:makeUrl({period:item.key,q:'',page:1})
      })),
      pagination:{
        page,
        pageSize:result.pageSize,
        totalRows:result.total,
        totalPages,
        firstRow,
        lastRow,
        hasPrevious:page>1,
        hasNext:page<totalPages,
        previousUrl:page>1?makeUrl({period:period.key,q,page:page-1}):null,
        nextUrl:page<totalPages?makeUrl({period:period.key,q,page:page+1}):null,
        pageLinks
      }
    });
  }catch(error){next(error);}
}

async function show(req,res,next){
  try{
    const data=await repo.detail(pool,req.session.user.organization_id,req.branch.id,Number(req.params.id));
    if(!data)throw appError('Sale not found',404);
    res.render('sales/show',{title:data.sale.sale_number,...data});
  }catch(error){next(error);}
}

async function receipt(req,res,next){
  try{
    const data=await repo.detail(pool,req.session.user.organization_id,req.branch.id,Number(req.params.id));
    if(!data)throw appError('Sale not found',404);
    res.render('sales/receipt',{title:'Receipt '+data.sale.sale_number,...data,layout:false});
  }catch(error){next(error);}
}

async function recentApi(req,res,next){
  try{
    const clock=await repo.businessClock(pool,req.branch.id);
    const {startDate,endDate}=periodRange(clock.business_date,'30d');
    const result=await repo.list(pool,req.session.user.organization_id,req.branch.id,{
      q:'',
      startDate,
      endDate,
      timezone:clock.timezone,
      page:1,
      pageSize:50
    });
    res.json(result.rows);
  }catch(error){next(error);}
}

async function createReturn(req,res,next){
  try{
    const ret=await returns.createReturn(Number(req.params.id),req.body,{user:req.session.user,branch:req.branch});
    setFlash(req,'success',`Return ${ret.return_number} completed. Refund TZS ${Number(ret.total_refund).toLocaleString()}.`);
    res.redirect('/sales/'+req.params.id);
  }catch(error){next(error);}
}

module.exports={index,show,receipt,recentApi,createReturn};
