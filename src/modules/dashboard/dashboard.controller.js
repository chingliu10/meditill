const {pool}=require('../../config/db');
const repo=require('./dashboard.repository');

const PERIODS={
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

function periodWindow(businessDate,key){
  const selected=PERIODS[key]||PERIODS.today;
  return {
    key:PERIODS[key]?key:'today',
    label:selected.label,
    startDate:shiftDate(businessDate,selected.startOffset),
    endDate:shiftDate(businessDate,selected.endOffset)
  };
}

function hasPermission(access,code){
  return access.is_owner===true || (Array.isArray(access.permissions)&&access.permissions.includes(code));
}

async function index(req,res,next){
  try{
    const organizationId=req.session.user.organization_id;
    const branchId=req.branch.id;
    const [clock,permissionContext]=await Promise.all([
      repo.businessClock(pool,organizationId),
      repo.access(pool,req.session.user.id)
    ]);

    const period=periodWindow(clock.business_date,String(req.query.period||'today'));
    const access={
      canSales:hasPermission(permissionContext,'sale.view')||hasPermission(permissionContext,'reports.sales'),
      canSaleCreate:hasPermission(permissionContext,'sale.create'),
      canSalesReports:hasPermission(permissionContext,'reports.sales'),
      canProfit:hasPermission(permissionContext,'reports.profit'),
      canPurchases:hasPermission(permissionContext,'purchase.view'),
      canInventory:hasPermission(permissionContext,'inventory.view'),
      canExpiry:hasPermission(permissionContext,'reports.inventory')
    };

    const range=[period.startDate,period.endDate,clock.timezone];

    const [sales,profit,purchases,inventory,expiry,topSelling,expiryRisk,recentSales]=await Promise.all([
      access.canSales?repo.salesMetrics(pool,organizationId,branchId,...range):Promise.resolve(null),
      access.canProfit?repo.profitMetric(pool,organizationId,branchId,...range):Promise.resolve(null),
      access.canPurchases?repo.purchaseMetric(pool,organizationId,branchId,...range):Promise.resolve(null),
      access.canInventory?repo.inventoryHealth(pool,organizationId,branchId,clock.business_date):Promise.resolve(null),
      access.canExpiry?repo.expiryHealth(pool,branchId,clock.business_date):Promise.resolve(null),
      access.canSalesReports?repo.topSelling(pool,branchId,...range):Promise.resolve([]),
      access.canExpiry?repo.expiryRisk(pool,branchId,clock.business_date):Promise.resolve([]),
      access.canSales?repo.recentSales(pool,branchId,...range):Promise.resolve([])
    ]);

    const data={
      sales_period:sales?.sales_period??null,
      transactions_period:sales?.transactions_period??null,
      gross_profit_period:profit?.gross_profit_period??null,
      purchases_period:purchases?.purchases_period??null,
      low_stock:inventory?.low_stock??null,
      out_of_stock:inventory?.out_of_stock??null,
      expiring_30:expiry?.expiring_30??null,
      expired_batches:expiry?.expired_batches??null
    };

    res.render('dashboard/index',{
      title:'Dashboard',
      data,
      topSelling,
      expiryRisk,
      recentSales,
      access,
      hasMetricCards:access.canSales||access.canProfit||access.canPurchases,
      hasAlerts:access.canInventory||access.canExpiry,
      hasInsights:access.canSalesReports||access.canExpiry,
      period,
      periodToday:period.key==='today',
      periodYesterday:period.key==='yesterday',
      period7d:period.key==='7d',
      period30d:period.key==='30d',
      period1y:period.key==='1y'
    });
  }catch(error){next(error);}
}

module.exports={index};
