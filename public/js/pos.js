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
  const mobileCartBar=document.querySelector('#mobileCartBar');
  const mobileCartCount=document.querySelector('#mobileCartCount');
  const mobileCartTotal=document.querySelector('#mobileCartTotal');
  const mobileCartClose=document.querySelector('#mobileCartClose');
  const mobileCartBackdrop=document.querySelector('#mobileCartBackdrop');
  const categories=document.querySelector('#posCategories');
  const inStockOnly=document.querySelector('#inStockOnly');
  const clearCart=document.querySelector('#posClearCart');
  const completeSale=document.querySelector('#completeSale');

  const cart=new Map();
  let timer,customerTimer;
  let productSearchController=null;
  let customerSearchController=null;
  let catalogProducts=[];
  let activeCategory='';
  let replacePayment=true;
  let saleInFlight=false;

  const money=n=>'TZS '+Number(n||0).toLocaleString('en-TZ',{maximumFractionDigits:2});
  const notify=(text,type='success',duration=3500)=>window.MediTillToast?.(text,type,duration);
  const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const focusSearch=()=>{
    if(window.matchMedia('(min-width:621px)').matches)input?.focus();
  };

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
      cartLines.innerHTML='<div class="mt-empty-state">No items</div>';
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
            <button type="button" class="minus" aria-label="Decrease quantity" title="Decrease quantity">&minus;</button>
            <span>${item.saleQty}</span>
            <button type="button" class="plus" aria-label="Increase quantity" title="Increase quantity">+</button>
            <button type="button" class="remove" aria-label="Remove medicine" title="Remove medicine">&times;</button>
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
    const itemLabel=Number(count.toFixed(4))===1?'1 item':`${Number(count.toFixed(4))} items`;
    countEl.textContent=itemLabel;
    document.querySelector('#paymentItemCount').textContent=itemLabel;
    if(mobileCartCount)mobileCartCount.textContent=itemLabel;
    if(mobileCartTotal)mobileCartTotal.textContent=money(total);
    payAmount.value=total||'';
    replacePayment=true;
    clearCart.disabled=!cart.size||saleInFlight;
    completeSale.disabled=!cart.size||saleInFlight;
    updateChange();
  }

  function add(item){
    if(saleInFlight)return;
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
    focusSearch();
  }

  function showProducts(list){
    catalogProducts=list;
    const names=[...new Set(list.map(item=>item.category).filter(Boolean))].sort();
    if(!names.includes(activeCategory))activeCategory='';
    categories.replaceChildren();
    ['',...names].forEach(name=>{
      const button=document.createElement('button');
      button.type='button';
      button.textContent=name||'All medicines';
      button.dataset.category=name;
      button.onclick=()=>{activeCategory=name;renderProducts();};
      categories.appendChild(button);
    });
    renderProducts();
  }

  function renderProducts(){
    products.innerHTML='';
    categories.querySelectorAll('button').forEach(button=>{
      const selected=button.dataset.category===activeCategory;
      button.classList.toggle('is-active',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
    const list=catalogProducts.filter(item=>(!activeCategory||item.category===activeCategory)&&(!inStockOnly.checked||Number(item.stock)>0));
    document.querySelector('#posProductCount').textContent=list.length===1?'1 medicine':`${list.length} medicines`;
    if(!list.length)products.innerHTML='<div class="mt-empty-state">No medicines found</div>';

    for(const item of list){
      const card=document.createElement('button');
      card.type='button';
      card.className='mt-pos-product';
      card.title=[item.name,item.strength].filter(Boolean).join(' ');
      card.disabled=Number(item.stock)<=0;
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
    productSearchController?.abort();
    productSearchController=new AbortController();

    const response=await fetch('/pos/api/search?q='+encodeURIComponent(query),{
      signal:productSearchController.signal
    });
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
    timer=setTimeout(()=>search(input.value).catch(error=>{if(error.name!=='AbortError')notify(error.message,'error');}),350);
  });

  inStockOnly.addEventListener('change',renderProducts);
  document.querySelector('#posClearSearch').addEventListener('click',()=>{
    clearTimeout(timer);
    input.value='';
    activeCategory='';
    search('').catch(error=>{if(error.name!=='AbortError')notify(error.message,'error');});
    focusSearch();
  });

  clearCart.addEventListener('click',async()=>{
    if(saleInFlight||!cart.size)return;
    if(!await window.MediTillConfirm({title:'Clear sale?',message:'Remove all items from this sale?'}))return;
    if(saleInFlight)return;
    cart.clear();
    customerId.value='';
    customerSearch.value='';
    customerResults.classList.remove('is-open');
    renderCart();
    focusSearch();
  });

  document.querySelectorAll('[data-method]').forEach(button=>{
    button.onclick=()=>{
      document.querySelectorAll('[data-method]').forEach(item=>item.classList.toggle('is-active',item===button));
      paymentMethod.value=button.dataset.method;
      if(paymentMethod.value!=='CASH'){
        payAmount.value=cartTotal()||'';
        replacePayment=true;
      }
      document.querySelectorAll('[data-cash-amount]').forEach(preset=>{preset.disabled=paymentMethod.value!=='CASH';});
      updateChange();
    };
  });

  payAmount?.addEventListener('input',()=>{replacePayment=false;updateChange();});
  document.querySelector('#posExactAmount').addEventListener('click',()=>{
    payAmount.value=cartTotal()||'';
    replacePayment=true;
    updateChange();
  });
  document.querySelectorAll('[data-cash-amount]').forEach(button=>{
    button.onclick=()=>{payAmount.value=button.dataset.cashAmount;replacePayment=true;updateChange();};
  });
  document.querySelectorAll('[data-pay-key]').forEach(button=>{
    button.onclick=()=>{
      const key=button.dataset.payKey;
      let value=payAmount.value;
      if(key==='backspace')value=value.slice(0,-1);
      else{
        if(replacePayment)value='';
        if(key==='.'&&value.includes('.'))return;
        if(value.length>=12||(value.includes('.')&&value.split('.')[1].length>=2))return;
        value=(value==='0'&&key!=='.'?'':value)+key;
        if(value==='.')value='0.';
      }
      replacePayment=false;
      payAmount.value=value;
      updateChange();
    };
  });

  customerSearch?.addEventListener('input',()=>{
    customerId.value='';
    clearTimeout(customerTimer);

    customerTimer=setTimeout(async()=>{
      customerSearchController?.abort();
      customerSearchController=new AbortController();

      const response=await fetch('/customers/api/search?q='+encodeURIComponent(customerSearch.value),{
        signal:customerSearchController.signal
      });
      const list=await response.json();
      customerResults.innerHTML='';

      if(!response.ok){
        notify(list.error||'Customer search failed','error');
        return;
      }

      list.slice(0,25).forEach(customer=>{
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
    },350);
  });

  document.querySelector('#completeSale')?.addEventListener('click',async()=>{
    if(saleInFlight)return;
    if(!cart.size)return notify('Cart is empty','warning');
    const received=Number(payAmount.value);
    const total=cartTotal();
    if(!Number.isFinite(received)||received<total)return notify('Amount received is below the amount due','warning');
    if(paymentMethod.value!=='CASH'&&received!==total)return notify('Non-cash payment must match the amount due','warning');

    const button=document.querySelector('#completeSale');
    const originalText=button.textContent;
    saleInFlight=true;
    ['#posCart','.mt-pos-catalog','.mt-payment-box'].forEach(selector=>{document.querySelector(selector).inert=true;});
    button.setAttribute('aria-busy','true');
    clearCart.disabled=true;
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
      closeMobileCart();

      cart.clear();
      renderCart();
      search('').catch(error=>{if(error.name!=='AbortError')notify(error.message,'error');});
    }catch(error){
      notify(error.message||'Sale failed','error');
    }finally{
      saleInFlight=false;
      ['#posCart','.mt-pos-catalog','.mt-payment-box'].forEach(selector=>{document.querySelector(selector).inert=false;});
      button.removeAttribute('aria-busy');
      button.disabled=!cart.size;
      clearCart.disabled=!cart.size;
      button.textContent=originalText;
    }
  });

  function dismissSaleSuccess(){
    const success=document.querySelector('#saleSuccess');
    if(success)success.hidden=true;
    customerId.value='';
    customerSearch.value='';
    focusSearch();
  }

  document.querySelector('#saleDone')?.addEventListener('click',dismissSaleSuccess);
  document.querySelector('#saleSuccessClose')?.addEventListener('click',dismissSaleSuccess);

  function openMobileCart(){
    document.body.classList.add('mt-pos-cart-open');
    if(mobileCartBackdrop)mobileCartBackdrop.hidden=false;
  }

  function closeMobileCart(){
    document.body.classList.remove('mt-pos-cart-open');
    if(mobileCartBackdrop)mobileCartBackdrop.hidden=true;
    focusSearch();
  }

  mobileCartBar?.addEventListener('click',openMobileCart);
  mobileCartClose?.addEventListener('click',closeMobileCart);
  mobileCartBackdrop?.addEventListener('click',closeMobileCart);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&document.body.classList.contains('mt-pos-cart-open'))closeMobileCart();
  });

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
