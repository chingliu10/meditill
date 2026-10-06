const {pool}=require('../../config/db');
const repo=require('./count.repository');
const service=require('./count.service');
const {setFlash}=require('../../shared/flash');
const {appError}=require('../../shared/app-error');
const {PERIODS,resolvePeriod,safePage,pagination}=require('../../shared/list-pagination');

const STATUSES=['','OPEN','COMPLETED'];

function listUrl(period,q,status,page){
  const params=new URLSearchParams();
  params.set('period',period);
  if(q)params.set('q',q);
  if(status)params.set('status',status);
  if(page>1)params.set('page',String(page));
  return '/stock-counts?'+params.toString();
}

async function index(req,res,next){
  try{
    const q=String(req.query.q||'').trim();
    const rawStatus=String(req.query.status||'').toUpperCase();
    const status=STATUSES.includes(rawStatus)?rawStatus:'';
    const requestedPage=safePage(req.query.page);
    const clock=await repo.businessClock(pool,req.branch.id);
    const range=resolvePeriod(clock.business_date,String(req.query.period||'30d'));

    let result=await repo.list(pool,req.branch.id,{
      q,status,startDate:range.startDate,endDate:range.endDate,timezone:clock.timezone,page:requestedPage,pageSize:25
    });
    const pager=pagination(result.total,requestedPage,25,page=>listUrl(range.period.key,q,status,page));
    if(pager.page!==requestedPage){
      result=await repo.list(pool,req.branch.id,{
        q,status,startDate:range.startDate,endDate:range.endDate,timezone:clock.timezone,page:pager.page,pageSize:25
      });
    }

    res.render('stock-counts/index',{
      title:'Stock Counts',counts:result.rows,q,status,period:range.period.key,
      periods:PERIODS.map(item=>({...item,active:item.key===range.period.key,url:listUrl(item.key,q,status,1)})),
      statusOptions:[
        {value:'',label:'All statuses',selected:status===''},
        {value:'OPEN',label:'Open',selected:status==='OPEN'},
        {value:'COMPLETED',label:'Completed',selected:status==='COMPLETED'}
      ],
      pagination:pager
    });
  }catch(e){next(e);}
}

async function start(req,res,next){try{const c=await service.start({user:req.session.user,branch:req.branch});res.redirect('/stock-counts/'+c.id);}catch(e){next(e);}}
async function show(req,res,next){try{const d=await repo.detail(pool,req.branch.id,Number(req.params.id));if(!d)throw appError('Stock count not found',404);res.render('stock-counts/show',{title:d.count.count_number,...d});}catch(e){next(e);}}
async function complete(req,res,next){try{await service.complete(Number(req.params.id),req.body,{user:req.session.user,branch:req.branch});setFlash(req,'success','Stock count completed and differences posted.');res.redirect('/stock-counts');}catch(e){next(e);}}
module.exports={index,start,show,complete};
