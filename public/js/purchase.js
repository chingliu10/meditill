(() => {
  const tbody=document.querySelector('#itemsTable tbody');
  const addButton=document.querySelector('#addRow');
  const supplierSearch=document.querySelector('#supplierSearch');
  const supplierId=document.querySelector('#supplierId');
  const supplierResults=document.querySelector('#supplierResults');

  let rowIndex=0;
  let supplierTimer;

  function escapeHtml(value){
    return String(value??'')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  async function fetchJson(url){
    const response=await fetch(url,{headers:{accept:'application/json'}});
    if(!response.ok) throw new Error('Search failed');
    return response.json();
  }

  function openMenu(menu){
    menu.classList.add('is-open');
  }

  function closeMenu(menu){
    menu.classList.remove('is-open');
  }

  function renderSupplierResults(items){
    supplierResults.innerHTML='';

    if(!items.length){
      supplierResults.innerHTML='<div class="mt-picker-empty">No suppliers found.</div>';
      openMenu(supplierResults);
      return;
    }

    items.forEach(item=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='mt-picker-item';
      button.innerHTML=`
        <span class="mt-picker-title">${escapeHtml(item.name)}</span>
        <span class="mt-picker-meta">${escapeHtml([item.contact_person,item.phone].filter(Boolean).join(' · '))}</span>
      `;
      button.addEventListener('click',()=>{
        supplierId.value=item.id;
        supplierSearch.value=item.name;
        closeMenu(supplierResults);
      });
      supplierResults.appendChild(button);
    });

    openMenu(supplierResults);
  }

  supplierSearch?.addEventListener('input',()=>{
    supplierId.value='';
    clearTimeout(supplierTimer);
    supplierTimer=setTimeout(async()=>{
      try{
        const items=await fetchJson('/suppliers/api/search?q='+encodeURIComponent(supplierSearch.value.trim()));
        renderSupplierResults(items);
      }catch(error){
        window.MediTillToast?.(error.message,'error');
      }
    },220);
  });

  supplierSearch?.addEventListener('focus',()=>{
    supplierSearch.dispatchEvent(new Event('input'));
  });

  function medicineRow(){
    const index=rowIndex++;
    const tr=document.createElement('tr');

    tr.innerHTML=`
      <td>
        <div class="mt-picker">
          <input type="hidden" name="items[${index}][medicine_id]" class="medicine-id" required>
          <input class="form-control medicine-search" autocomplete="off" placeholder="Search medicine / generic / barcode">
          <div class="mt-picker-menu medicine-results"></div>
          <div class="form-text medicine-unit"></div>
        </div>
      </td>
      <td>
        <input class="form-control quantity-input" type="number" min="0.0001" step="1" name="items[${index}][quantity]" required>
      </td>
      <td><input class="form-control" type="number" min="0" step="0.01" name="items[${index}][unit_cost]" required></td>
      <td><input class="form-control" type="number" min="0" step="0.01" name="items[${index}][selling_price]"></td>
      <td><input class="form-control" name="items[${index}][batch_number]"></td>
      <td><input class="form-control" type="date" name="items[${index}][expiry_date]"></td>
      <td><button type="button" class="btn btn-sm btn-outline-danger remove" aria-label="Remove">×</button></td>
    `;

    const idInput=tr.querySelector('.medicine-id');
    const searchInput=tr.querySelector('.medicine-search');
    const results=tr.querySelector('.medicine-results');
    const qty=tr.querySelector('.quantity-input');
    const unit=tr.querySelector('.medicine-unit');

    let timer;

    async function searchMedicines(){
      idInput.value='';
      clearTimeout(timer);

      timer=setTimeout(async()=>{
        try{
          const items=await fetchJson('/medicines/api/search?q='+encodeURIComponent(searchInput.value.trim()));
          results.innerHTML='';

          if(!items.length){
            results.innerHTML='<div class="mt-picker-empty">No medicines found.</div>';
            return openMenu(results);
          }

          items.slice(0,20).forEach(item=>{
            const button=document.createElement('button');
            button.type='button';
            button.className='mt-picker-item';
            button.innerHTML=`
              <span class="mt-picker-title">${escapeHtml(item.name)} ${escapeHtml(item.strength||'')}</span>
              <span class="mt-picker-meta">${escapeHtml([item.generic_name,item.barcode,item.unit_name].filter(Boolean).join(' · '))}</span>
            `;
            button.addEventListener('click',()=>{
              idInput.value=item.id;
              searchInput.value=[item.name,item.strength].filter(Boolean).join(' ');
              qty.step=item.allow_fraction ? '0.0001' : '1';
              unit.textContent=item.unit_name
                ? `Quantity unit: ${item.unit_name}${item.allow_fraction?' (decimals allowed)':' (whole numbers only)'}`
                : '';
              closeMenu(results);
            });
            results.appendChild(button);
          });

          openMenu(results);
        }catch(error){
          window.MediTillToast?.(error.message,'error');
        }
      },220);
    }

    searchInput.addEventListener('input',searchMedicines);
    searchInput.addEventListener('focus',searchMedicines);
    tr.querySelector('.remove').addEventListener('click',()=>tr.remove());

    tbody.appendChild(tr);
  }

  addButton?.addEventListener('click',medicineRow);
  medicineRow();

  document.addEventListener('click',event=>{
    document.querySelectorAll('.mt-picker-menu.is-open').forEach(menu=>{
      if(!menu.parentElement.contains(event.target)) closeMenu(menu);
    });
  });
})();
