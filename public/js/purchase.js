(() => {
  const medicines=window.MEDITILL_MEDICINES||[];
  const tbody=document.querySelector('#itemsTable tbody');
  const add=document.querySelector('#addRow');
  let index=0;
  function row(){
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><select class="form-select" name="items[${index}][medicine_id]" required><option value="">Choose...</option>${medicines.map(m=>`<option value="${m.id}">${m.name} ${m.strength||''}</option>`).join('')}</select></td>
      <td><input class="form-control" type="number" min="0.0001" step="0.0001" name="items[${index}][quantity]" required></td>
      <td><input class="form-control" type="number" min="0" step="0.01" name="items[${index}][unit_cost]" required></td>
      <td><input class="form-control" type="number" min="0" step="0.01" name="items[${index}][selling_price]"></td>
      <td><input class="form-control" name="items[${index}][batch_number]"></td>
      <td><input class="form-control" type="date" name="items[${index}][expiry_date]"></td>
      <td><button type="button" class="btn btn-sm btn-outline-danger remove">×</button></td>`;
    tr.querySelector('.remove').onclick=()=>tr.remove();
    tbody.appendChild(tr); index++;
  }
  add?.addEventListener('click',row); row();
})();