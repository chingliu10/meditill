(() => {
  const input=document.querySelector('#scanInput');
  const products=document.querySelector('#products');
  const cartLines=document.querySelector('#cartLines');
  const subtotalEl=document.querySelector('#subtotal');
  const totalEl=document.querySelector('#total');
  const payAmount=document.querySelector('#paymentAmount');
  const cart=new Map();
  let timer;

  const money=n=>'TZS '+Number(n||0).toLocaleString('en-TZ');

  function notify(text,type='success'){
    if(window.MediTillToast) window.MediTillToast(text,type);
  }

  function renderCart(){
    cartLines.innerHTML='';
    let total=0;

    for(const item of cart.values()){
      total+=item.quantity*item.price;

      const row=document.createElement('div');
      row.className='d-flex align-items-center justify-content-between border-bottom py-2';
      row.innerHTML=`
        <div>
          <strong>${item.name}</strong>
          <div class="small text-muted">${money(item.price)} each · ${item.unitName||''}</div>
        </div>
        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-sm btn-outline-secondary minus">−</button>
          <span>${Number(item.quantity).toLocaleString(undefined,{maximumFractionDigits:4})}</span>
          <button class="btn btn-sm btn-outline-secondary plus">+</button>
        </div>
      `;

      const step=item.allowFraction ? 0.1 : 1;

      row.querySelector('.minus').onclick=()=>{
        item.quantity=Math.max(0,Number((item.quantity-step).toFixed(4)));
        if(item.quantity<=0) cart.delete(item.id);
        renderCart();
      };

      row.querySelector('.plus').onclick=()=>{
        const next=Number((item.quantity+step).toFixed(4));
        if(next<=Number(item.stock)) item.quantity=next;
        renderCart();
      };

      cartLines.appendChild(row);
    }

    subtotalEl.textContent=money(total);
    totalEl.textContent=money(total);
    payAmount.value=total||'';
  }

  function add(item){
    if(Number(item.stock)<=0){
      notify('Out of stock','error');
      return;
    }

    const existing=cart.get(Number(item.id));
    const increment=item.allow_fraction ? 0.1 : 1;

    if(existing){
      const next=Number((existing.quantity+increment).toFixed(4));
      if(next<=Number(item.stock)) existing.quantity=next;
    }else{
      cart.set(Number(item.id),{
        id:Number(item.id),
        name:item.name+(item.strength?' '+item.strength:''),
        price:Number(item.default_selling_price),
        quantity:increment,
        stock:Number(item.stock),
        allowFraction:!!item.allow_fraction,
        unitName:item.unit_name||item.unit||''
      });
    }

    renderCart();
    input.value='';
    input.focus();
  }

  function showProducts(list){
    products.innerHTML='';

    for(const item of list){
      const col=document.createElement('div');
      col.className='col-6 col-md-4';
      col.innerHTML=`
        <div class="card product-tile p-2">
          <strong>${item.name}</strong>
          <small>${item.strength||''}</small>
          <div class="mt-auto d-flex justify-content-between gap-2">
            <span>${money(item.default_selling_price)}</span>
            <span>Stock ${Number(item.stock).toLocaleString(undefined,{maximumFractionDigits:4})}</span>
          </div>
        </div>
      `;
      col.onclick=()=>add(item);
      products.appendChild(col);
    }
  }

  async function search(q){
    const response=await fetch('/pos/api/search?q='+encodeURIComponent(q));
    const data=await response.json();
    if(!response.ok) throw new Error(data.error||'Search failed');
    showProducts(data);
  }

  async function scan(code){
    const response=await fetch('/pos/api/barcode/'+encodeURIComponent(code));

    if(response.ok){
      add(await response.json());
      return;
    }

    await search(code);
  }

  input?.addEventListener('keydown',event=>{
    if(event.key==='Enter'){
      event.preventDefault();
      const q=input.value.trim();
      if(q) scan(q).catch(error=>notify(error.message,'error'));
    }
  });

  input?.addEventListener('input',()=>{
    clearTimeout(timer);
    timer=setTimeout(()=>{
      search(input.value).catch(error=>notify(error.message,'error'));
    },250);
  });

  document.querySelector('#completeSale')?.addEventListener('click',async()=>{
    if(!cart.size){
      notify('Cart is empty','warning');
      return;
    }

    const body={
      items:[...cart.values()].map(item=>({
        medicine_id:item.id,
        quantity:item.quantity,
        unit_price:item.price
      })),
      payments:[{
        method:document.querySelector('#paymentMethod').value,
        amount:Number(payAmount.value)
      }]
    };

    try{
      const response=await fetch('/pos/api/sales',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify(body)
      });

      const data=await response.json();
      if(!response.ok) throw new Error(data.error||'Sale failed');

      notify(
        `Sale ${data.sale_number} completed. Change: ${money(data.change_amount)}`,
        'success'
      );

      cart.clear();
      renderCart();
      input.focus();
      search('').catch(()=>{});
    }catch(error){
      notify(error.message,'error');
    }
  });

  search('').catch(error=>notify(error.message,'error'));
})();
