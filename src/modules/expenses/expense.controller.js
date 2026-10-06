const {pool}=require('../../config/db');
const repo=require('./expense.repository');
const service=require('./expense.service');
const {setFlash}=require('../../shared/flash');
const {PERIODS,resolvePeriod,safePage,pagination}=require('../../shared/list-pagination');

const METHODS=['','CASH','MOBILE_MONEY','CARD','BANK'];

function listUrl(period,q,method,page){
  const params=new URLSearchParams();
  params.set('period',period);
  if(q)params.set('q',q);
  if(method)params.set('method',method);
  if(page>1)params.set('page',String(page));
  return '/expenses?'+params.toString();
}

async function index(req,res,next){
  try{
    const q=String(req.query.q||'').trim();
    const method=METHODS.includes(String(req.query.method||'').toUpperCase())?String(req.query.method||'').toUpperCase():'';
    const requestedPage=safePage(req.query.page);
    const clock=await repo.businessClock(pool,req.branch.id);
    const range=resolvePeriod(clock.business_date,String(req.query.period||'7d'));

    let result=await repo.list(pool,req.session.user.organization_id,req.branch.id,{
      q,method,startDate:range.startDate,endDate:range.endDate,timezone:clock.timezone,page:requestedPage,pageSize:25
    });
    const pager=pagination(result.total,requestedPage,25,page=>listUrl(range.period.key,q,method,page));
    if(pager.page!==requestedPage){
      result=await repo.list(pool,req.session.user.organization_id,req.branch.id,{
        q,method,startDate:range.startDate,endDate:range.endDate,timezone:clock.timezone,page:pager.page,pageSize:25
      });
    }

    res.render('expenses/index',{
      title:'Expenses',
      expenses:result.rows,
      q,method,
      period:range.period.key,
      periods:PERIODS.map(item=>({...item,active:item.key===range.period.key,url:listUrl(item.key,q,method,1)})),
      paymentMethods:[
        {value:'',label:'All methods',selected:method===''},
        {value:'CASH',label:'Cash',selected:method==='CASH'},
        {value:'MOBILE_MONEY',label:'Mobile',selected:method==='MOBILE_MONEY'},
        {value:'CARD',label:'Card',selected:method==='CARD'},
        {value:'BANK',label:'Bank',selected:method==='BANK'}
      ],
      pagination:pager
    });
  }catch(e){next(e);}
}

async function create(req,res,next){
  try{
    const e=await service.createExpense(req.body,{user:req.session.user,branch:req.branch});
    setFlash(req,'success',`Expense TZS ${Number(e.amount).toLocaleString()} recorded.`);
    res.redirect('/expenses');
  }catch(e){next(e);}
}
module.exports={index,create};
