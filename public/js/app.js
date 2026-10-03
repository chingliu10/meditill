(() => {
  const toastHost=()=>document.getElementById('toastHost');
  const sidebar=document.getElementById('appSidebar');
  const backdrop=document.getElementById('sidebarBackdrop');

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
    toastHost()?.appendChild(toast);
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

  function openSidebar(){
    sidebar?.classList.add('is-open');
    backdrop?.classList.add('is-open');
    document.body.classList.add('mt-no-scroll');
  }

  function closeSidebar(){
    sidebar?.classList.remove('is-open');
    backdrop?.classList.remove('is-open');
    document.body.classList.remove('mt-no-scroll');
  }

  document.getElementById('openSidebar')?.addEventListener('click',openSidebar);
  document.getElementById('closeSidebar')?.addEventListener('click',closeSidebar);
  backdrop?.addEventListener('click',closeSidebar);

  const currentPath=window.location.pathname;
  document.querySelectorAll('[data-nav]').forEach(link=>{
    const href=link.getAttribute('href');
    const active=href==='/' ? currentPath==='/' : currentPath===href || currentPath.startsWith(href+'/');
    link.classList.toggle('is-active',active);
  });

  const branchSelect=document.querySelector('.mt-branch-select');
  if(branchSelect){
    const currentBranch=document.querySelector('.mt-user-meta small')?.textContent?.trim();
    const option=[...branchSelect.options].find(item=>item.textContent.trim()===currentBranch);
    if(option) branchSelect.value=option.value;
  }

  document.querySelectorAll('[data-coming-soon]').forEach(button=>{
    button.addEventListener('click',()=>{
      showToast(`${button.dataset.comingSoon} is next in the implementation queue.`,'warning');
    });
  });

  let confirmResolver=null;
  const modal=document.getElementById('confirmModal');
  const title=document.getElementById('confirmTitle');
  const message=document.getElementById('confirmMessage');

  window.MediTillConfirm=(options={})=>{
    title.textContent=options.title||'Confirm action';
    message.textContent=options.message||'Are you sure?';
    modal.hidden=false;
    requestAnimationFrame(()=>modal.classList.add('is-visible'));

    return new Promise(resolve=>{ confirmResolver=resolve; });
  };

  function resolveConfirm(value){
    if(!confirmResolver) return;
    modal.classList.remove('is-visible');
    setTimeout(()=>{ modal.hidden=true; },150);
    confirmResolver(value);
    confirmResolver=null;
  }

  document.getElementById('confirmCancel')?.addEventListener('click',()=>resolveConfirm(false));
  document.getElementById('confirmAccept')?.addEventListener('click',()=>resolveConfirm(true));
})();
