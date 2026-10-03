const {pool}=require('../../config/db');const repo=require('./expense.repository');const service=require('./expense.service');const {setFlash}=require('../../shared/flash');
async function index(req,res,next){try{res.render('expenses/index',{title:'Expenses',expenses:await repo.list(pool,req.session.user.organization_id,req.branch.id)});}catch(e){next(e);}}
async function create(req,res,next){try{const e=await service.createExpense(req.body,{user:req.session.user,branch:req.branch});setFlash(req,'success',`Expense TZS ${Number(e.amount).toLocaleString()} recorded.`);res.redirect('/expenses');}catch(e){next(e);}}
module.exports={index,create};
