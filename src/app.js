const path = require('path');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { engine } = require('express-handlebars');
const helmet = require('helmet');
const compression = require('compression');
const env = require('./config/env');
const { pool } = require('./config/db');
const { exposeUser } = require('./middleware/auth.middleware');
const { exposeFlash } = require('./middleware/flash.middleware');
const { notFound,errorHandler } = require('./middleware/error.middleware');

const app = express();
app.set('trust proxy', 1);

app.engine('hbs', engine({
  extname: '.hbs',
  defaultLayout: 'main',
  helpers: {
    money(value){return Number(value||0).toLocaleString('en-TZ',{minimumFractionDigits:0,maximumFractionDigits:2});},
    quantity(value){return Number(value||0).toLocaleString('en-TZ',{minimumFractionDigits:0,maximumFractionDigits:4});},
    date(value){if(!value)return '—';const d=new Date(value);if(Number.isNaN(d.getTime()))return String(value);return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(d);},
    dateTime(value){if(!value)return '—';const d=new Date(value);if(Number.isNaN(d.getTime()))return String(value);return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);},
    stockClass(stock,reorder){const q=Number(stock||0),r=Number(reorder||0);if(q<=0)return 'danger';if(q<=r)return 'warning';return 'success';},
    stockLabel(stock,reorder){const q=Number(stock||0),r=Number(reorder||0);if(q<=0)return 'Out of stock';if(q<=r)return 'Low stock';return 'In stock';},
    json(value){return JSON.stringify(value);},
    eq(a,b){return a===b;}
  }
}));
app.set('view engine','hbs');
app.set('views',path.join(__dirname,'..','views'));

app.use(helmet({contentSecurityPolicy:false}));
app.use(compression());
app.use(express.urlencoded({extended:true}));
app.use(express.json({limit:'1mb'}));
app.use(express.static(path.join(__dirname,'..','public')));

app.use(session({
  store:new pgSession({pool,tableName:'session'}),
  secret:env.sessionSecret,
  resave:false,
  saveUninitialized:false,
  cookie:{httpOnly:true,sameSite:'lax',secure:env.nodeEnv==='production',maxAge:1000*60*60*12}
}));

app.use(exposeFlash);
app.use(exposeUser);

app.use('/',require('./modules/auth/auth.routes'));
app.use('/',require('./modules/dashboard/dashboard.routes'));
app.use('/branches',require('./modules/branches/branch.routes'));
app.use('/medicines',require('./modules/medicines/medicine.routes'));
app.use('/medicine-setup',require('./modules/medicine-setup/setup.routes'));
app.use('/suppliers',require('./modules/suppliers/supplier.routes'));
app.use('/customers',require('./modules/customers/customer.routes'));
app.use('/purchases',require('./modules/purchases/purchase.routes'));
app.use('/inventory',require('./modules/inventory/inventory.routes'));
app.use('/transfers',require('./modules/transfers/transfer.routes'));
app.use('/stock-counts',require('./modules/stock-counts/count.routes'));
app.use('/registers',require('./modules/registers/register.routes'));
app.use('/pos',require('./modules/pos/pos.routes'));
app.use('/sales',require('./modules/sales/sale.routes'));
app.use('/expenses',require('./modules/expenses/expense.routes'));
app.use('/reports',require('./modules/reports/report.routes'));
app.use('/users',require('./modules/users/user.routes'));
app.use('/roles',require('./modules/roles/role.routes'));
app.use('/settings',require('./modules/settings/settings.routes'));

app.use(notFound);
app.use(errorHandler);
module.exports = app;
