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

function resolvePeriod(businessDate,key='7d'){
  const period=PERIODS.find(item=>item.key===key)||PERIODS.find(item=>item.key==='7d');
  if(period.yesterday){
    const startDate=shiftDate(businessDate,-1);
    return {period,startDate,endDate:businessDate};
  }
  return {
    period,
    startDate:shiftDate(businessDate,-(period.days-1)),
    endDate:shiftDate(businessDate,1)
  };
}

function safePage(value){
  return Math.max(1,Number.parseInt(value,10)||1);
}

function pagination(totalRows,requestedPage,pageSize,makeUrl){
  const total=Math.max(0,Number(totalRows)||0);
  const pages=Math.max(1,Math.ceil(total/pageSize));
  const page=Math.min(safePage(requestedPage),pages);
  const firstRow=total?((page-1)*pageSize)+1:0;
  const lastRow=total?Math.min(page*pageSize,total):0;
  const links=[];
  for(let value=Math.max(1,page-2);value<=Math.min(pages,page+2);value++){
    links.push({value,active:value===page,url:makeUrl(value)});
  }
  return {
    page,pageSize,totalRows:total,totalPages:pages,firstRow,lastRow,
    hasPrevious:page>1,hasNext:page<pages,
    previousUrl:page>1?makeUrl(page-1):null,
    nextUrl:page<pages?makeUrl(page+1):null,
    pageLinks:links
  };
}

module.exports={PERIODS,resolvePeriod,safePage,pagination};
