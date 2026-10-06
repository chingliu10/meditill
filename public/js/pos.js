(()=>{
  const input=document.querySelector('#scanInput');
  const products=document.querySelector('#products');
  const cartLines=document.querySelector('#cartLines');
  const subtotalEl=document.querySelector('#subtotal');
  const totalEl=document.querySelector('#total');
  const payAmount=document.querySelector('#paymentAmount');
  const countEl=document.querySelector('#cartCount');
  const customerSearch=document.querySelector('#customerSearch');
  const customerId=document.querySelector('#customerId');
  const customerResults=document.querySelector('#customerResults');
  const paymentMethod=document.querySelector('#paymentMethod');
  const changePreview=document.querySelector('#changePreview');

  const cart=new Map();
  let timer,customerTimer;

  const money=n=>'TZS '+Number(n||0).toLocaleString('en-TZ',{maximumFractionDigits:2});
  const notify=(text,type='success')=>window.MediTillToast?.(text,type);
  const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

  function cartTotal(){
    return [...cart.values()].reduce((sum,item)=>sum+(item.saleQty*item.salePrice),0);
  }

  function updateChange(){
    if(!changePreview)return;
    const total=cartTotal();
    const received=Number(payAmount?.value||0);
    const method=paymentMethod?.value||'CASH';
    const change=method==='CASH'?Math.max(0,received-total):0;
    changePreview.textContent=money(change);
  }

  function renderCart(){
    cartLines.innerHTML='';
    let total=0,count=0;

    if(!cart.size){
      cartLines.innerHTML='<div class="mt-empty-state">Scan or tap a medicine to begin.</div>';
    }

    for(const item of cart.values()){
      total+=item.saleQty*item.salePrice;
      count+=item.saleQty;

      const row=document.createElement('div');
      row.className='mt-cart-line';
      row.innerHTML=`<img src="${esc(item.image||'/images/default-medicine.svg')}" onerror="this.src='/images/default-medicine.svg'">
        <div class="mt-cart-line-main">
          <strong>${esc(item.name)}</strong>
          <small>${money(item.salePrice)} / ${esc(item.saleUnitName)} · Stock ${Number(item.stock/item.conversion).toLocaleString('en-TZ',{maximumFractionDigits:4})} ${esc(item.saleUnitName)}</small>
          <div class="mt-qty">
            <button type="button" class="minus">−</button>
            <span>${item.saleQty}</span>
            <button type="button" class="plus">+</button>
            <button type="button" class="remove">×</button>
          </div>
        </div>
        <b>${money(item.saleQty*item.salePrice)}</b>`;

      const step=item.allowFraction?.1:1;

      row.querySelector('.minus').onclick=()=>{
        item.saleQty=Number(Math.max(0,item.saleQty-step).toFixed(4));
        if(item.saleQty<=0)cart.delete(item.key);
        renderCart();
      };

      row.querySelector('.plus').onclick=()=>{
        const next=Number((item.saleQty+step).toFixed(4));
        if(next*item.conversion<=item.stock)item.saleQty=next;
        else notify('Not enough stock','warning');
        renderCart();
      };

      row.querySelector('.remove').onclick=()=>{
        cart.delete(item.key);
        renderCart();
      };

      cartLines.appendChild(row);
    }

    subtotalEl.textContent=money(total);
    totalEl.textContent=money(total);
    countEl.textContent=`${Number(count.toFixed(4))} items`;
    payAmount.value=total||'';
    updateChange();
  }

  function add(item){
    const conversion=Number(item.conversion_to_base||1);
    const unitId=item.medicine_unit_id?Number(item.medicine_unit_id):null;
    const key=unitId?`${item.id}:u${unitId}`:`${item.id}:base`;
    const saleUnitName=item.sale_unit_name||item.unit_name||'Unit';
    const salePrice=item.sale_unit_price==null?Number(item.default_selling_price):Number(item.sale_unit_price);
    const allowFraction=unitId?false:!!item.allow_fraction;
    const increment=allowFraction?.1:1;
    const stock=Number(item.stock);

    if(stock<conversion*increment)return notify('Out of stock','error');

    const existing=cart.get(key);
    if(existing){
      const next=Number((existing.saleQty+increment).toFixed(4));
      if(next*conversion<=stock)existing.saleQty=next;
      else return notify('Not enough stock','warning');
    }else{
      cart.set(key,{
        key,
        id:Number(item.id),
        medicineUnitId:unitId,
        name:item.name+(item.strength?' '+item.strength:''),
        salePrice,
        saleQty:increment,
        conversion,
        stock,
        allowFraction,
        saleUnitName,
        image:item.image_path||'/images/default-medicine.svg'
      });
    }

    renderCart();
    input.value='';
    input.focus();
  }

  function showProducts(list){
    products.innerHTML='';

    for(const item of list){
      const card=document.createElement('button');
      card.type='button';
      card.className='mt-pos-product';
      card.innerHTML=`<img src="${esc(item.image_path||'/images/default-medicine.svg')}" onerror="this.src='/images/default-medicine.svg'">
        <span class="mt-pos-product-name">${esc(item.name)} ${esc(item.strength||'')}</span>
        <small>${esc(item.generic_name||'')}</small>
        <div>
          <strong>${money(item.default_selling_price)}</strong>
          <em>${Number(item.stock).toLocaleString('en-TZ',{maximumFractionDigits:4})} in stock</em>
        </div>`;

      card.onclick=()=>add(item);
      products.appendChild(card);
    }
  }

  async function search(query){
    const response=await fetch('/pos/api/search?q='+encodeURIComponent(query));
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Search failed');
    showProducts(data);
    return data;
  }

  async function scan(code){
    const response=await fetch('/pos/api/barcode/'+encodeURIComponent(code));

    if(response.ok){
      add(await response.json());
      return;
    }

    if(response.status!==404){
      let data={};
      try{data=await response.json()}catch(error){}
      throw new Error(data.error||'Barcode lookup failed');
    }

    const matches=await search(code);
    if(!matches.length)notify('Medicine not found','warning');
  }

  input?.addEventListener('keydown',event=>{
    if(event.key==='Enter'){
      event.preventDefault();
      const query=input.value.trim();
      if(query)scan(query).catch(error=>notify(error.message,'error'));
    }
  });

  input?.addEventListener('input',()=>{
    clearTimeout(timer);
    timer=setTimeout(()=>search(input.value).catch(error=>notify(error.message,'error')),220);
  });

  document.querySelectorAll('[data-method]').forEach(button=>{
    button.onclick=()=>{
      document.querySelectorAll('[data-method]').forEach(item=>item.classList.toggle('is-active',item===button));
      paymentMethod.value=button.dataset.method;
      updateChange();
    };
  });

  payAmount?.addEventListener('input',updateChange);

  customerSearch?.addEventListener('input',()=>{
    customerId.value='';
    clearTimeout(customerTimer);

    customerTimer=setTimeout(async()=>{
      const response=await fetch('/customers/api/search?q='+encodeURIComponent(customerSearch.value));
      const list=await response.json();
      customerResults.innerHTML='';

      if(!response.ok){
        notify(list.error||'Customer search failed','error');
        return;
      }

      list.slice(0,12).forEach(customer=>{
        const button=document.createElement('button');
        button.type='button';
        button.className='mt-picker-item';
        button.innerHTML=`<span class="mt-picker-title">${esc(customer.name)}</span><span class="mt-picker-meta">${esc(customer.phone||'')}</span>`;
        button.onclick=()=>{
          customerId.value=customer.id;
          customerSearch.value=customer.name;
          customerResults.classList.remove('is-open');
        };
        customerResults.appendChild(button);
      });

      customerResults.classList.add('is-open');
    },200);
  });

  let saleInFlight=false;

  document.querySelector('#completeSale')?.addEventListener('click',async()=>{
    if(saleInFlight)return;
    if(!cart.size)return notify('Cart is empty','warning');

    const button=document.querySelector('#completeSale');
    const originalText=button.textContent;
    saleInFlight=true;
    button.disabled=true;
    button.textContent='Processing...';

    try{
      const body={
        customer_id:customerId.value||null,
        items:[...cart.values()].map(item=>({
          medicine_id:item.id,
          medicine_unit_id:item.medicineUnitId,
          sale_unit_quantity:item.saleQty,
          unit_price:item.salePrice
        })),
        payments:[{
          method:paymentMethod.value,
          amount:Number(payAmount.value)
        }]
      };

      const response=await fetch('/pos/api/sales',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify(body)
      });

      const data=await response.json();

      if(!response.ok){
        notify(data.error||'Sale failed','error');
        if(response.status===409&&String(data.error||'').toLowerCase().includes('open a register')){
          setTimeout(()=>{location.href='/registers?return=%2Fpos';},800);
        }
        return;
      }

      document.querySelector('#saleSuccessNumber').textContent=data.sale_number;
      document.querySelector('#saleSuccessChange').textContent='Change: '+money(data.change_amount);
      document.querySelector('#saleReceiptLink').href='/sales/'+data.id+'/receipt';
      document.querySelector('#saleSuccess').hidden=false;

      cart.clear();
      renderCart();
      search('');
    }catch(error){
      notify(error.message||'Sale failed','error');
    }finally{
      saleInFlight=false;
      button.disabled=false;
      button.textContent=originalText;
    }
  });

  function dismissSaleSuccess(){
    const success=document.querySelector('#saleSuccess');
    if(success)success.hidden=true;
    customerId.value='';
    customerSearch.value='';
    input.focus();
  }

  document.querySelector('#saleDone')?.addEventListener('click',dismissSaleSuccess);
  document.querySelector('#saleSuccessClose')?.addEventListener('click',dismissSaleSuccess);

  document.addEventListener('click',event=>{
    if(!customerSearch?.parentElement.contains(event.target))customerResults?.classList.remove('is-open');
  });

  const registerModal=document.querySelector('#posRegisterCloseModal');
  const registerCloseButton=document.querySelector('#posCloseRegister');
  const registerCancel=document.querySelector('#posRegisterCloseCancel');
  const registerForm=document.querySelector('#posRegisterCloseForm');

  function openRegisterClose(){
    if(!registerModal)return;
    registerModal.hidden=false;
    requestAnimationFrame(()=>registerModal.classList.add('is-visible'));
    registerForm?.querySelector('input[name="actual_cash"]')?.focus();
  }

  function closeRegisterClose(){
    if(!registerModal)return;
    registerModal.classList.remove('is-visible');
    setTimeout(()=>{registerModal.hidden=true;},150);
  }

  registerCloseButton?.addEventListener('click',openRegisterClose);
  registerCancel?.addEventListener('click',closeRegisterClose);

  registerForm?.addEventListener('submit',async event=>{
    event.preventDefault();
    const submit=registerForm.querySelector('button[type="submit"]');
    const original=submit.textContent;
    submit.disabled=true;
    submit.textContent='Closing...';

    try{
      const response=await fetch('/registers/api/close',{
        method:'POST',
        headers:{'content-type':'application/json','accept':'application/json'},
        body:JSON.stringify(Object.fromEntries(new FormData(registerForm)))
      });
      const data=await response.json();

      if(!response.ok)throw new Error(data.error||'Failed to close register');

      sessionStorage.setItem('meditillToast',JSON.stringify({
        type:'success',
        message:'Register closed. Expected TZS '+Number(data.expected_cash).toLocaleString('en-TZ')+
          ', actual TZS '+Number(data.actual_cash).toLocaleString('en-TZ')+
          ', variance TZS '+Number(data.difference).toLocaleString('en-TZ')
      }));

      location.href='/registers?return=%2Fpos';
    }catch(error){
      notify(error.message,'error');
      submit.disabled=false;
      submit.textContent=original;
    }
  });

  renderCart();
  search('').catch(error=>notify(error.message,'error'));
})();
