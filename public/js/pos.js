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
  let paymentEdited=false;
  let catalogPage=1;
  let draftBlocked=false;
  let checkoutPending=false;
  let storageFailed=false;
  let restoring=false;
  let draftRevision=0;
  const state=window.MediTillPosState;
  const scope=document.body.dataset.draftScope;
  const draftKey=/^\d+:\d+:\d+:\d+$/.test(scope||'')?'meditill.pos.draft:'+scope:null;
  const draftNotice=document.querySelector('#posDraftNotice');
  const draftMessage=document.querySelector('#posDraftMessage');
  const confirmDialog=document.querySelector('#posConfirm');
  function confirmSale(title,message,accept='Clear sale'){
    document.querySelector('#posConfirmTitle').textContent=title;
    document.querySelector('#posConfirmMessage').textContent=message;
    document.querySelector('#posConfirmAccept').textContent=accept;
    confirmDialog.returnValue='';
    confirmDialog.showModal();
    return new Promise(resolve=>confirmDialog.addEventListener('close',()=>resolve(confirmDialog.returnValue==='accept'),{once:true}));
  }
  document.querySelector('#posConfirmCancel').onclick=()=>confirmDialog.close('cancel');
  document.querySelector('#posConfirmAccept').onclick=()=>confirmDialog.close('accept');
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('keydown',event=>{
    if(event.key==='Tab'){
      const targets=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]')].filter(target=>target.getClientRects().length);
      const first=targets[0],last=targets.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
    if(event.key==='Escape'){
      event.preventDefault();
      event.stopPropagation();
      if(!saleInFlight&&!registerClosing)dialog.close('cancel');
    }
  }));
  let registerClosing=false;

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
    const shortfall=Math.max(0,total-(Number.isFinite(received)?received:0));
    document.querySelector('#posChangeLabel').textContent=shortfall?'Remaining':'Change';
    changePreview.textContent=money(shortfall||change);
    changePreview.parentElement.classList.toggle('is-short',shortfall>0);
    saveDraft();
  }

  function saveDraft(){
    if(!draftKey||restoring||draftBlocked&&!checkoutPending)return;
    try{
      if(!cart.size){sessionStorage.removeItem(draftKey);return;}
      sessionStorage.setItem(draftKey,JSON.stringify({version:1,scope,time:Date.now(),
        method:paymentMethod.value,amount:Number.isFinite(Number(payAmount.value))&&Number(payAmount.value)>=0?payAmount.value:'',edited:paymentEdited,pending:checkoutPending,
        customerId:customerId.value?Number(customerId.value):null,
        items:[...cart.values()].map(item=>({id:item.id,unitId:item.medicineUnitId,qty:item.saleQty,
          price:item.salePrice,name:item.name,strength:item.strength||'',unitName:item.saleUnitName}))}));
    }catch(error){
      if(!storageFailed)notify('Draft recovery is unavailable in this browser. Keep this sale open.','warning',6000);
      storageFailed=true;
    }
  }
  function notice(message,blocked=false){
    draftBlocked=blocked;
    draftMessage.textContent=message;
    draftNotice.hidden=!message;
    document.querySelector('#posReviewSales').hidden=!checkoutPending;
    document.querySelector('#posDraftRetry').textContent=checkoutPending?'Resume sale':'Retry';
    document.querySelector('#posDraftRetry').hidden=!blocked;
    document.querySelector('#posDraftDiscard').hidden=!blocked;
    completeSale.disabled=!cart.size||saleInFlight||blocked||invalidCart();
  }
  function invalidCart(){
    return [...cart.values()].some(item=>item.unavailable||!state.quantityAllowed([...cart.values()],item,item.saleQty));
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
          <strong>${esc(item.name)}</strong><span class="mt-cart-strength">${esc(item.strength||'')}</span>
          <small>${money(item.salePrice)} / ${esc(item.saleUnitName)} · Stock ${Number(item.stock/item.conversion).toLocaleString('en-TZ',{maximumFractionDigits:4})} ${esc(item.saleUnitName)}</small>
          <div class="mt-qty">
            <button type="button" class="minus" aria-label="Decrease quantity" title="Decrease quantity">&minus;</button>
            <input class="quantity" type="number" min="${item.allowFraction?.1:1}" step="${item.allowFraction?.1:1}" value="${item.saleQty}" aria-label="Quantity for ${esc(item.name)} (${esc(item.saleUnitName)})">
            <button type="button" class="plus" aria-label="Increase quantity" title="Increase quantity">+</button>
            <button type="button" class="remove" aria-label="Remove medicine" title="Remove medicine">&times;</button>
          </div>
        </div>
        <b>${money(item.saleQty*item.salePrice)}</b>`;
      if(item.unavailable||!state.quantityAllowed([...cart.values()],item,item.saleQty)){
        const error=document.createElement('small');
        error.className='mt-cart-error';
        error.textContent=item.unavailable?'Medicine or unit unavailable. Remove this item.':'Stock changed. Reduce quantity or remove this item.';
        row.querySelector('.mt-cart-line-main').appendChild(error);
      }
      row.querySelector('.quantity').onchange=event=>{
        const next=Number(event.target.value);
        if(state.quantityAllowed([...cart.values()],item,next))item.saleQty=next;
        else notify('Enter a valid quantity within available stock','warning');
        renderCart();
      };

      const step=item.allowFraction?.1:1;

      row.querySelector('.minus').onclick=()=>{
        item.saleQty=Number(Math.max(0,item.saleQty-step).toFixed(4));
        if(item.saleQty<=0)cart.delete(item.key);
        renderCart();
      };

      row.querySelector('.plus').onclick=()=>{
        const next=Number((item.saleQty+step).toFixed(4));
        if(state.quantityAllowed([...cart.values()],item,next))item.saleQty=next;
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
    payAmount.value=state.paymentValue(total,payAmount.value,paymentEdited,paymentMethod.value);
    if(!total){paymentEdited=false;replacePayment=true;}
    clearCart.disabled=!cart.size||saleInFlight;
    completeSale.disabled=!cart.size||saleInFlight||draftBlocked||invalidCart();
    updateChange();
  }

  function add(item){
    if(saleInFlight||draftBlocked)return;
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
      if(state.quantityAllowed([...cart.values()],existing,next))existing.saleQty=next;
      else return notify('Not enough stock','warning');
    }else{
      cart.set(key,{
        key,
        id:Number(item.id),
        medicineUnitId:unitId,
        name:item.name,
        strength:item.strength||'',
        salePrice,
        saleQty:increment,
        conversion,
        stock,
        allowFraction,
        saleUnitName,
        image:item.image_path||'/images/default-medicine.svg'
      });
      if(!state.quantityAllowed([...cart.values()],cart.get(key),increment)){
        cart.delete(key);
        return notify('Not enough stock across the selected units','warning');
      }
    }

    renderCart();
    input.value='';
    focusSearch();
  }

  function renderProducts(){
    products.innerHTML='';
    const list=catalogProducts;
    if(!list.length)products.innerHTML='<div class="mt-empty-state">No medicines found</div>';

    for(const item of list){
      const card=document.createElement('article');
      card.className='mt-medicine-tile';
      card.title=[item.name,item.strength].filter(Boolean).join(' ');
      card.innerHTML=`<button type="button" class="mt-product-add" aria-label="Add ${esc(item.name)} ${esc(item.strength||'')}">
        <img src="${esc(item.image_path||'/images/default-medicine.svg')}" alt="" onerror="this.src='/images/default-medicine.svg'">
        <span class="mt-pos-product-name">${esc(item.name)}</span>
        <span class="mt-product-strength">${esc(item.strength||'Strength not specified')}</span>
        <small>${esc(item.generic_name||'')}</small>
        <strong class="mt-product-price"></strong><span class="mt-product-stock"></span></button>
        ${(item.packages||[]).length
          ?`<select class="mt-product-unit" aria-label="Selling unit for ${esc(item.name)}"><option value="">${esc(item.unit_name||'Unit')}</option></select>`
          :`<span class="mt-product-unit-label">${esc(item.unit_name||'Unit')}</span>`}`;
      const units=card.querySelector('select');
      (item.packages||[]).forEach(unit=>{
        const option=document.createElement('option');
        option.value=unit.id;
        option.textContent=`${unit.name} (${Number(unit.conversion_to_base)} ${item.unit_name||'units'})`;
        units.appendChild(option);
      });
      const button=card.querySelector('button');
      let selected=item;
      const selectUnit=()=>{
        const unit=(item.packages||[]).find(unit=>String(unit.id)===units?.value);
        const conversion=Number(unit?.conversion_to_base||1);
        selected={...item,medicine_unit_id:unit?.id||null,conversion_to_base:conversion,
          sale_unit_name:unit?.name||item.unit_name||'Unit',
          sale_unit_price:unit?(unit.selling_price==null?Number(item.default_selling_price)*conversion:Number(unit.selling_price)):null};
        card.querySelector('.mt-product-price').textContent=money(selected.sale_unit_price??item.default_selling_price);
        const stock=Number(item.stock)/conversion;
        card.querySelector('.mt-product-stock').textContent=`${stock.toLocaleString('en-TZ',{maximumFractionDigits:2})} ${selected.sale_unit_name} in stock`;
        button.disabled=stock<(unit||!item.allow_fraction?1:.1);
        button.setAttribute('aria-label',`Add ${item.name} ${item.strength||''}, ${selected.sale_unit_name}`);
      };
      if(units)units.onchange=selectUnit;
      selectUnit();
      button.onclick=()=>add(selected);
      products.appendChild(card);
    }
  }

  async function search(query,page=1){
    productSearchController?.abort();
    productSearchController=new AbortController();

    products.setAttribute('aria-busy','true');
    const params=new URLSearchParams({q:query,page:String(page),category:activeCategory,stock:String(inStockOnly.checked)});
    const response=await fetch('/pos/api/catalog?'+params,{
      signal:productSearchController.signal
    });
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Search failed');
    catalogPage=data.page;
    catalogProducts=data.items;
    categories.innerHTML='<option value="">All medicines</option>';
    data.categories.forEach(category=>{
      const option=document.createElement('option');
      option.value=category.id;
      option.textContent=category.name;
      categories.appendChild(option);
    });
    categories.value=activeCategory;
    document.querySelector('#posProductCount').textContent=`${data.total} ${data.total===1?'medicine':'medicines'}`;
    document.querySelector('#posPageCount').textContent=`Page ${data.page} of ${Math.max(1,Math.ceil(data.total/data.pageSize))}`;
    document.querySelector('#posPreviousPage').disabled=data.page<=1;
    document.querySelector('#posNextPage').disabled=data.page*data.pageSize>=data.total;
    products.removeAttribute('aria-busy');
    renderProducts();
    products.scrollTop=0;
    return data.items;
  }
  function browse(page=1){
    clearTimeout(timer);
    return search(input.value,page).catch(error=>{
      if(error.name==='AbortError')return;
      products.removeAttribute('aria-busy');
      products.innerHTML='<div class="mt-empty-state">Medicines could not be loaded.<button type="button" class="mt-btn mt-btn-secondary">Retry</button></div>';
      products.querySelector('button').onclick=()=>browse(page);
      notify(error.message,'error');
    });
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

    activeCategory='';
    inStockOnly.checked=false;
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
    timer=setTimeout(()=>browse(),250);
  });

  inStockOnly.addEventListener('change',()=>browse());
  categories.addEventListener('change',()=>{activeCategory=categories.value;browse();});
  document.querySelector('#posPreviousPage').onclick=()=>browse(catalogPage-1);
  document.querySelector('#posNextPage').onclick=()=>browse(catalogPage+1);
  document.querySelector('#posClearSearch').addEventListener('click',()=>{
    clearTimeout(timer);
    input.value='';
    activeCategory='';
    browse();
    focusSearch();
  });

  clearCart.addEventListener('click',async()=>{
    if(saleInFlight||!cart.size)return;
    if(!await confirmSale('Clear sale?',checkoutPending?'Check sales first. Clearing this cart does not cancel a completed payment.':'Remove all items from this sale?'))return;
    if(saleInFlight)return;
    draftRevision++;
    cart.clear();
    checkoutPending=false;
    notice('');
    customerId.value='';
    customerSearch.value='';
    customerResults.classList.remove('is-open');
    renderCart();
    focusSearch();
  });

  document.querySelectorAll('[data-method]').forEach(button=>{
    button.onclick=()=>{
      document.querySelectorAll('[data-method]').forEach(item=>item.classList.toggle('is-active',item===button));
      document.querySelectorAll('[data-method]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
      paymentMethod.value=button.dataset.method;
      if(paymentMethod.value!=='CASH'){
        payAmount.value=cartTotal()||'';
        replacePayment=true;
        paymentEdited=false;
      }
      document.querySelectorAll('[data-cash-amount]').forEach(preset=>{preset.disabled=paymentMethod.value!=='CASH';});
      updateChange();
    };
  });

  payAmount?.addEventListener('input',()=>{replacePayment=false;paymentEdited=true;updateChange();});
  document.querySelector('#posExactAmount').addEventListener('click',()=>{
    payAmount.value=cartTotal()||'';
    replacePayment=true;
    paymentEdited=false;
    updateChange();
  });
  document.querySelectorAll('[data-cash-amount]').forEach(button=>{
    button.onclick=()=>{payAmount.value=button.dataset.cashAmount;replacePayment=true;paymentEdited=true;updateChange();};
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
      paymentEdited=true;
      payAmount.value=value;
      updateChange();
    };
  });

  customerSearch?.addEventListener('input',()=>{
    customerId.value='';
    saveDraft();
    clearTimeout(customerTimer);

    customerTimer=setTimeout(async()=>{
      try{
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
          saveDraft();
        };
        customerResults.appendChild(button);
      });

      customerResults.classList.add('is-open');
      }catch(error){if(error.name!=='AbortError')notify('Customer search unavailable','warning');}
    },350);
  });

  document.querySelector('#completeSale')?.addEventListener('click',async()=>{
    if(saleInFlight||draftBlocked||invalidCart())return;
    if(!cart.size)return notify('Cart is empty','warning');
    const received=Number(payAmount.value);
    const total=cartTotal();
    if(!Number.isFinite(received)||received<total)return notify('Amount received is below the amount due','warning');
    if(paymentMethod.value!=='CASH'&&received!==total)return notify('Non-cash payment must match the amount due','warning');

    const button=document.querySelector('#completeSale');
    const originalText=button.textContent;
    saleInFlight=true;
    checkoutPending=true;
    saveDraft();
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
        checkoutPending=response.status>=500;
        if(checkoutPending)notice('Sale result unknown. Check sales before resuming to avoid a duplicate payment.',true);
        saveDraft();
        notify(data.error||'Sale failed','error');
        if(response.status===409&&String(data.error||'').toLowerCase().includes('open a register')){
          setTimeout(()=>{location.href='/registers?return=%2Fpos';},800);
        }
        return;
      }

      document.querySelector('#saleSuccessNumber').textContent=data.sale_number;
      document.querySelector('#saleSuccessChange').textContent='Change: '+money(data.change_amount);
      document.querySelector('#saleReceiptLink').href='/sales/'+data.id+'/receipt';
      closeMobileCart();
      checkoutPending=false;
      cart.clear();
      customerId.value='';
      customerSearch.value='';
      renderCart();
      document.querySelector('#saleSuccess').showModal();
      search('').catch(error=>{if(error.name!=='AbortError')notify(error.message,'error');});
    }catch(error){
      notice('Sale result unknown. Check sales before resuming to avoid a duplicate payment.',true);
      notify('Connection lost. Verify whether the sale completed before trying again.','warning',7000);
    }finally{
      saleInFlight=false;
      ['#posCart','.mt-pos-catalog','.mt-payment-box'].forEach(selector=>{document.querySelector(selector).inert=false;});
      button.removeAttribute('aria-busy');
      button.disabled=!cart.size||draftBlocked||invalidCart();
      clearCart.disabled=!cart.size;
      button.textContent=originalText;
    }
  });

  function dismissSaleSuccess(){
    const success=document.querySelector('#saleSuccess');
    if(success?.open)success.close();
    customerId.value='';
    customerSearch.value='';
    focusSearch();
  }

  document.querySelector('#saleDone')?.addEventListener('click',dismissSaleSuccess);
  document.querySelector('#saleSuccessClose')?.addEventListener('click',dismissSaleSuccess);
  document.querySelector('#saleSuccess').addEventListener('close',()=>{customerId.value='';customerSearch.value='';focusSearch();});

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
    if(event.key==='Escape'&&!document.querySelector('dialog[open]')&&document.body.classList.contains('mt-pos-cart-open'))closeMobileCart();
  });

  document.addEventListener('click',event=>{
    if(!customerSearch?.parentElement.contains(event.target))customerResults?.classList.remove('is-open');
  });

  const registerModal=document.querySelector('#posRegisterCloseModal');
  const registerCloseButton=document.querySelector('#posCloseRegister');
  const registerCancel=document.querySelector('#posRegisterCloseCancel');
  const registerForm=document.querySelector('#posRegisterCloseForm');

  function openRegisterClose(){
    if(!registerModal||saleInFlight)return;
    if(draftBlocked)return notify('Resolve the saved sale before closing this register','warning');
    registerModal.showModal();
    registerForm?.querySelector('input[name="actual_cash"]')?.focus();
  }

  function closeRegisterClose(){
    if(!registerModal)return;
    if(!registerClosing)registerModal.close();
  }

  registerCloseButton?.addEventListener('click',openRegisterClose);
  registerCancel?.addEventListener('click',closeRegisterClose);

  registerForm?.addEventListener('submit',async event=>{
    event.preventDefault();
    const submit=registerForm.querySelector('button[type="submit"]');
    const original=submit.textContent;
    submit.disabled=true;
    registerClosing=true;
    submit.textContent='Closing...';

    try{
      const response=await fetch('/registers/api/close',{
        method:'POST',
        headers:{'content-type':'application/json','accept':'application/json'},
        body:JSON.stringify(Object.fromEntries(new FormData(registerForm)))
      });
      const data=await response.json();

      if(!response.ok)throw new Error(data.error||'Failed to close register');
      if(draftKey)sessionStorage.removeItem(draftKey);
      sessionStorage.setItem('meditillToast',JSON.stringify({
        type:'success',
        message:'Register closed. Expected TZS '+Number(data.expected_cash).toLocaleString('en-TZ')+
          ', actual TZS '+Number(data.actual_cash).toLocaleString('en-TZ')+
          ', variance TZS '+Number(data.difference).toLocaleString('en-TZ')
      }));

      location.href='/registers?return=%2Fpos';
    }catch(error){
      registerClosing=false;
      notify(error.message,'error');
      submit.disabled=false;
      submit.textContent=original;
    }
  });

  async function restoreDraft(){
    if(!draftKey||restoring)return;
    let raw;
    try{raw=sessionStorage.getItem(draftKey);}catch(error){storageFailed=true;return;}
    if(!raw)return;
    const draft=state.readDraft(raw,scope);
    if(!draft){sessionStorage.removeItem(draftKey);return;}
    restoring=true;
    const revision=++draftRevision;
    notice('Checking saved sale...',true);
    try{
      const response=await fetch('/pos/api/draft/check',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({ids:[...new Set(draft.items.map(item=>item.id))],customer_id:draft.customerId})});
      const data=await response.json();
      if(revision!==draftRevision)return;
      if(!response.ok)throw new Error(data.error||'Draft check failed');
      cart.clear();
      let priceChanged=false;
      for(const saved of draft.items){
        const med=data.items.find(item=>Number(item.id)===saved.id);
        const unit=med?.packages?.find(item=>Number(item.id)===saved.unitId);
        const unavailable=!med||(saved.unitId!==null&&!unit);
        const conversion=Number(unit?.conversion_to_base||1);
        const price=med?(unit?(unit.selling_price==null?Number(med.default_selling_price)*conversion:Number(unit.selling_price)):Number(med.default_selling_price)):saved.price;
        if(price!==saved.price)priceChanged=true;
        const key=saved.unitId?`${saved.id}:u${saved.unitId}`:`${saved.id}:base`;
        cart.set(key,{key,id:saved.id,medicineUnitId:saved.unitId,name:med?.name||saved.name||'Unavailable medicine',
          strength:med?.strength||saved.strength,saleQty:saved.qty,salePrice:price,conversion,stock:Number(med?.stock||0),
          allowFraction:saved.unitId===null&&!!med?.allow_fraction,saleUnitName:unit?.name||med?.unit_name||saved.unitName||'Unit',
          image:med?.image_path,unavailable});
      }
      customerId.value=data.customer?.id||'';
      customerSearch.value=data.customer?.name||'';
      paymentMethod.value=draft.method;
      document.querySelectorAll('[data-method]').forEach(button=>{
        const selected=button.dataset.method===draft.method;
        button.classList.toggle('is-active',selected);
        button.setAttribute('aria-pressed',String(selected));
      });
      document.querySelectorAll('[data-cash-amount]').forEach(button=>{button.disabled=draft.method!=='CASH';});
      payAmount.value=draft.amount;
      paymentEdited=!!draft.edited;
      replacePayment=!paymentEdited;
      checkoutPending=!!draft.pending;
      restoring=false;
      notice(checkoutPending?'Sale result unknown. Check sales before resuming to avoid a duplicate payment.':
        priceChanged?'Draft recovered. Prices changed; review the sale.':'Draft recovered.',checkoutPending);
      renderCart();
    }catch(error){
      if(revision!==draftRevision)return;
      restoring=false;
      notice('Saved sale could not be checked. Retry or discard it before starting another sale.',true);
    }
  }
  document.querySelector('#posDraftRetry').onclick=async()=>{
    if(checkoutPending){
      if(!await confirmSale('Resume this sale?','Confirm in sales that this payment was NOT completed. Resuming may otherwise create a duplicate sale.','Resume sale'))return;
      checkoutPending=false;
      notice('Review the recovered sale before completing payment.');
      renderCart();
    }else await restoreDraft();
  };
  document.querySelector('#posDraftDiscard').onclick=async()=>{
    if(!await confirmSale('Discard saved sale?',checkoutPending?'Discarding does not cancel a completed sale. Verify its result in sales.':'Remove the saved unfinished sale?','Discard'))return;
    draftRevision++;
    checkoutPending=false;
    restoring=false;
    cart.clear();
    customerId.value='';
    customerSearch.value='';
    notice('');
    if(draftKey)sessionStorage.removeItem(draftKey);
    renderCart();
  };
  document.querySelector('a[href="/logout"]')?.addEventListener('click',()=>{
    try{Object.keys(sessionStorage).filter(key=>key.startsWith('meditill.pos.draft:')).forEach(key=>sessionStorage.removeItem(key));}catch(error){}
  });
  window.addEventListener('beforeunload',event=>{
    if((storageFailed||!draftKey)&&cart.size){event.preventDefault();event.returnValue='';}
  });
  restoring=true;
  renderCart();
  restoring=false;
  restoreDraft().catch(error=>notify('Draft recovery unavailable','warning'));
  browse();
})();
