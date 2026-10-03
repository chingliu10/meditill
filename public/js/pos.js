(() => {
  const input=document.querySelector('#scanInput'), products=document.querySelector('#products'), cartLines=document.querySelector('#cartLines');
  const subtotalEl=document.querySelector('#subtotal'),totalEl=document.querySelector('#total'),payAmount=document.querySelector('#paymentAmount'),message=document.querySelector('#posMessage');
  const cart=new Map(); let timer;
  const money=n=>'TZS '+Number(n||0).toLocaleString('en-TZ');

  function renderCart(){
    cartLines.innerHTML='';
    let total=0;
    for(const item of cart.values()){
      total+=item.quantity*item.price;
      const row=document.createElement('div');row.className='d-flex align-items-center justify-content-between border-bottom py-2';
      row.innerHTML=`<div><strong>${item.name}</strong><div class="small text-muted">${money(item.price)} each</div></div>
      <div class="d-flex align-items-center gap-2"><button class="btn btn-sm btn-outline-secondary minus">−</button><span>${item.quantity}</span><button class="btn btn-sm btn-outline-secondary plus">+</button></div>`;
      row.querySelector('.minus').onclick=()=>{item.quantity--;if(item.quantity<=0)cart.delete(item.id);renderCart()};
      row.querySelector('.plus').onclick=()=>{if(item.quantity<Number(item.stock))item.quantity++;renderCart()};
      cartLines.appendChild(row);
    }
    subtotalEl.textContent=money(total);totalEl.textContent=money(total);payAmount.value=total||'';
  }
  function add(item){
    if(Number(item.stock)<=0){flash('Out of stock','danger');return}
    const existing=cart.get(Number(item.id));
    if(existing){if(existing.quantity<Number(item.stock))existing.quantity++;}
    else cart.set(Number(item.id),{id:Number(item.id),name:item.name+(item.strength?' '+item.strength:''),price:Number(item.default_selling_price),quantity:1,stock:Number(item.stock)});
    renderCart(); input.value='';input.focus();
  }
  function showProducts(list){products.innerHTML='';for(const item of list){const col=document.createElement('div');col.className='col-6 col-md-4';col.innerHTML=`<div class="card product-tile p-2"><strong>${item.name}</strong><small>${item.strength||''}</small><div class="mt-auto d-flex justify-content-between"><span>${money(item.default_selling_price)}</span><span>Stock ${item.stock}</span></div></div>`;col.onclick=()=>add(item);products.appendChild(col);}}
  async function search(q){const r=await fetch('/pos/api/search?q='+encodeURIComponent(q));showProducts(await r.json());}
  async function scan(code){const r=await fetch('/pos/api/barcode/'+encodeURIComponent(code));if(r.ok)add(await r.json());else search(code);}
  function flash(text,type='success'){message.innerHTML=`<div class="alert alert-${type} py-2">${text}</div>`;setTimeout(()=>message.innerHTML='',3500);}
  input?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const q=input.value.trim();if(q)scan(q)}});
  input?.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>search(input.value),250)});
  document.querySelector('#completeSale')?.addEventListener('click',async()=>{
    if(!cart.size)return flash('Cart is empty','warning');
    const body={items:[...cart.values()].map(i=>({medicine_id:i.id,quantity:i.quantity,unit_price:i.price})),payments:[{method:document.querySelector('#paymentMethod').value,amount:Number(payAmount.value)}]};
    const r=await fetch('/pos/api/sales',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    const data=await r.json();if(!r.ok)return flash(data.error||'Sale failed','danger');
    flash(`Sale ${data.sale_number} completed. Change: ${money(data.change_amount)}`);cart.clear();renderCart();input.focus();
  });
  search('');
})();