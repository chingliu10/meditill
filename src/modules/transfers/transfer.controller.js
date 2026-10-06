const {pool}=require('../../config/db');
const repo=require('./transfer.repository');
const service=require('./transfer.service');
const {setFlash}=require('../../shared/flash');
const {PERIODS,resolvePeriod,safePage,pagination}=require('../../shared/list-pagination');

const STATUSES=['','IN_TRANSIT','RECEIVED'];

function listUrl(period,q,status,page){
  const params=new URLSearchParams();
  params.set('period',period);
  if(q)params.set('q',q);
  if(status)params.set('status',status);
  if(page>1)params.set('page',String(page));
  return '/transfers?'+params.toString();
}

async function index(req,res,next){
  try{
    const q=String(req.query.q||'').trim();
    const rawStatus=String(req.query.status||'').toUpperCase();
    const status=STATUSES.includes(rawStatus)?rawStatus:'';
    const requestedPage=safePage(req.query.page);
    const clock=await repo.businessClock(pool,req.branch.id);
    const range=resolvePeriod(clock.business_date,String(req.query.period||'7d'));

    const [destinations,batches]=await Promise.all([
      repo.destinations(pool,req.session.user.organization_id,req.branch.id),
      repo.sourceBatches(pool,req.branch.id)
    ]);

    let result=await repo.list(pool,req.session.user.organization_id,req.branch.id,{
      q,status,startDate:range.startDate,endDate:range.endDate,timezone:clock.timezone,page:requestedPage,pageSize:25
    });
    const pager=pagination(result.total,requestedPage,25,page=>listUrl(range.period.key,q,status,page));
    if(pager.page!==requestedPage){
      result=await repo.list(pool,req.session.user.organization_id,req.branch.id,{
        q,status,startDate:range.startDate,endDate:range.endDate,timezone:clock.timezone,page:pager.page,pageSize:25
      });
    }

    res.render('transfers/index',{
      title:'Transfers',transfers:result.rows,destinations,batches,q,status,period:range.period.key,
      periods:PERIODS.map(item=>({...item,active:item.key===range.period.key,url:listUrl(item.key,q,status,1)})),
      statusOptions:[
        {value:'',label:'All statuses',selected:status===''},
        {value:'IN_TRANSIT',label:'In transit',selected:status==='IN_TRANSIT'},
        {value:'RECEIVED',label:'Received',selected:status==='RECEIVED'}
      ],
      pagination:pager
    });
  }catch(e){next(e);}
}

async function send(req,res,next){try{const t=await service.send(req.body,{user:req.session.user,branch:req.branch});setFlash(req,'success',`Transfer ${t.transfer_number} sent.`);res.redirect('/transfers');}catch(e){next(e);}}
async function receive(req,res,next){try{await service.receive(Number(req.params.id),{user:req.session.user,branch:req.branch});setFlash(req,'success','Transfer received and stock posted.');res.redirect('/transfers');}catch(e){next(e);}}
module.exports={index,send,receive};
