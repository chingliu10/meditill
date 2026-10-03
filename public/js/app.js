(() => {
  const host=()=>document.getElementById('toastHost');

  function showToast(message,type='success',duration=3500){
    if(!message) return;

    const toast=document.createElement('div');
    toast.className=`mt-toast mt-toast-${type}`;
    toast.innerHTML=`
      <span class="mt-toast-icon"></span>
      <span class="mt-toast-message"></span>
      <button type="button" class="mt-toast-close" aria-label="Close">×</button>
    `;

    toast.querySelector('.mt-toast-message').textContent=message;
    toast.querySelector('.mt-toast-close').addEventListener('click',()=>toast.remove());
    host()?.appendChild(toast);

    requestAnimationFrame(()=>toast.classList.add('is-visible'));
    if(duration>0){
      setTimeout(()=>{
        toast.classList.remove('is-visible');
        setTimeout(()=>toast.remove(),180);
      },duration);
    }
  }

  window.MediTillToast=showToast;

  document.querySelectorAll('[data-server-toast]').forEach(toast=>{
    toast.querySelector('.mt-toast-close')?.addEventListener('click',()=>toast.remove());
    requestAnimationFrame(()=>toast.classList.add('is-visible'));
    setTimeout(()=>{
      toast.classList.remove('is-visible');
      setTimeout(()=>toast.remove(),180);
    },3800);
  });

  try{
    const raw=sessionStorage.getItem('meditillToast');
    if(raw){
      sessionStorage.removeItem('meditillToast');
      const item=JSON.parse(raw);
      showToast(item.message,item.type||'success');
    }
  }catch(error){
    sessionStorage.removeItem('meditillToast');
  }
})();
