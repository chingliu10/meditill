(function(root){
  function paymentValue(total,current,edited,method){
    return !total?'':method==='CASH'&&edited?current:String(total);
  }
  function quantityAllowed(lines,item,quantity){
    if(!Number.isFinite(quantity)||quantity<=0||(!item.allowFraction&&!Number.isInteger(quantity)))return false;
    const reserved=lines.filter(line=>line.id===item.id&&line.key!==item.key)
      .reduce((sum,line)=>sum+line.saleQty*line.conversion,0);
    return reserved+quantity*item.conversion<=item.stock+1e-9;
  }
  function readDraft(raw,scope,now=Date.now()){
    try{
      const draft=JSON.parse(raw);
      if(!draft||draft.version!==1||draft.scope!==scope||!Number.isFinite(draft.time)||
        now-draft.time>12*60*60*1000||draft.time>now+60000||
        !Array.isArray(draft.items)||!draft.items.length||draft.items.length>100||
        !['CASH','MOBILE_MONEY','CARD','BANK'].includes(draft.method)||
        (draft.customerId!==null&&(!Number.isSafeInteger(draft.customerId)||draft.customerId<1))||
        typeof draft.amount!=='string'||!Number.isFinite(Number(draft.amount))||Number(draft.amount)<0||
        draft.items.some(item=>!Number.isSafeInteger(item.id)||item.id<1||
          (item.unitId!==null&&(!Number.isSafeInteger(item.unitId)||item.unitId<1))||
          !Number.isFinite(item.qty)||item.qty<=0||!Number.isFinite(item.price)||item.price<0))return null;
      const keys=draft.items.map(item=>`${item.id}:${item.unitId}`);
      return new Set(keys).size===keys.length?draft:null;
    }catch(error){return null;}
  }
  const api={paymentValue,quantityAllowed,readDraft};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MediTillPosState=api;
})(typeof window==='object'?window:globalThis);
