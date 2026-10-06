(() => {
  const toastHost=()=>document.getElementById('toastHost');
  const sidebar=document.getElementById('appSidebar');
  const backdrop=document.getElementById('sidebarBackdrop');

  function showToast(message,type='success',duration=3500){
    if(!message) return;
    const toast=document.createElement('div');
    toast.className='mt-toast mt-toast-'+type;
    toast.innerHTML='<span class="mt-toast-icon"></span><span class="mt-toast-message"></span><button type="button" class="mt-toast-close" aria-label="Close">×</button>';
    toast.querySelector('.mt-toast-message').textContent=message;
    toast.querySelector('.mt-toast-close').addEventListener('click',()=>toast.remove());
    toastHost()?.appendChild(toast);
    requestAnimationFrame(()=>toast.classList.add('is-visible'));
    if(duration>0) setTimeout(()=>{toast.classList.remove('is-visible');setTimeout(()=>toast.remove(),180);},duration);
  }
  window.MediTillToast=showToast;

  document.querySelectorAll('[data-server-toast]').forEach(toast=>{
    toast.querySelector('.mt-toast-close')?.addEventListener('click',()=>toast.remove());
    requestAnimationFrame(()=>toast.classList.add('is-visible'));
    setTimeout(()=>{toast.classList.remove('is-visible');setTimeout(()=>toast.remove(),180);},3800);
  });

  try{
    const raw=sessionStorage.getItem('meditillToast');
    if(raw){sessionStorage.removeItem('meditillToast');const item=JSON.parse(raw);showToast(item.message,item.type||'success');}
  }catch(error){sessionStorage.removeItem('meditillToast');}

  function openSidebar(){sidebar?.classList.add('is-open');backdrop?.classList.add('is-open');document.body.classList.add('mt-no-scroll');}
  function closeSidebar(){sidebar?.classList.remove('is-open');backdrop?.classList.remove('is-open');document.body.classList.remove('mt-no-scroll');}
  document.getElementById('openSidebar')?.addEventListener('click',openSidebar);
  document.getElementById('closeSidebar')?.addEventListener('click',closeSidebar);
  document.getElementById('mobileMore')?.addEventListener('click',openSidebar);
  backdrop?.addEventListener('click',closeSidebar);

  const currentPath=window.location.pathname;
  document.querySelectorAll('[data-nav]').forEach(link=>{
    const href=link.getAttribute('href');
    const active=href==='/' ? currentPath==='/' : currentPath===href || currentPath.startsWith(href+'/');
    link.classList.toggle('is-active',active);
  });

  const branchSelect=document.querySelector('.mt-branch-select');
  if(branchSelect){
    const currentBranch=document.querySelector('.mt-user-meta small')?.textContent?.trim() || document.querySelector('.mt-sidebar-user small')?.textContent?.trim();
    const option=[...branchSelect.options].find(item=>item.textContent.trim()===currentBranch);
    if(option) branchSelect.value=option.value;
  }

  document.querySelectorAll('.mt-table:not(.mt-table-scroll-mobile)').forEach(table=>{
    const headers=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
    table.classList.add('mt-mobile-cards');
    table.closest('.mt-table-wrap')?.classList.add('mt-card-table-wrap');
    table.querySelectorAll('tbody tr').forEach(row=>{
      [...row.children].forEach((cell,index)=>{
        if(cell.hasAttribute('colspan')){cell.classList.add('mt-mobile-full');return;}
        const label=headers[index];
        if(label) cell.dataset.label=label;
      });
    });
  });
  document.querySelectorAll('.mt-table-scroll-mobile').forEach(table=>table.closest('.mt-table-wrap')?.classList.add('mt-scroll-table-wrap'));

  let confirmResolver=null;
  const modal=document.getElementById('confirmModal');
  const title=document.getElementById('confirmTitle');
  const message=document.getElementById('confirmMessage');
  window.MediTillConfirm=(options={})=>{
    title.textContent=options.title||'Confirm action';
    message.textContent=options.message||'Are you sure?';
    modal.hidden=false;
    requestAnimationFrame(()=>modal.classList.add('is-visible'));
    return new Promise(resolve=>{confirmResolver=resolve;});
  };
  function resolveConfirm(value){
    if(!confirmResolver) return;
    modal.classList.remove('is-visible');
    setTimeout(()=>{modal.hidden=true;},150);
    confirmResolver(value);
    confirmResolver=null;
  }
  document.getElementById('confirmCancel')?.addEventListener('click',()=>resolveConfirm(false));
  document.getElementById('confirmAccept')?.addEventListener('click',()=>resolveConfirm(true));

  document.querySelectorAll('form[data-confirm-form]').forEach(form=>{
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const ok=await window.MediTillConfirm({title:form.dataset.confirmTitle||'Confirm action',message:form.dataset.confirmMessage||'Are you sure?'});
      if(ok) form.submit();
    });
  });

  // Debounced GET filters: type, pause briefly, then submit automatically.
  document.querySelectorAll('form[data-debounce-search]').forEach(form=>{
    let timer=null;
    const delay=Math.max(150,Number(form.dataset.debounceSearch)||350);
    const schedule=()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>form.requestSubmit(),delay);
    };

    form.querySelectorAll('input[type="text"],input[type="search"],input:not([type])').forEach(input=>{
      input.addEventListener('input',schedule);
    });

    form.querySelectorAll('select').forEach(select=>{
      select.addEventListener('change',()=>{
        clearTimeout(timer);
        form.requestSubmit();
      });
    });
  });

  const installButton=document.getElementById('installApp');
  let deferredInstallPrompt=null;
  const standalone=window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true;
  if(standalone) document.documentElement.classList.add('mt-standalone');
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredInstallPrompt=event;
    if(installButton) installButton.hidden=false;
  });
  installButton?.addEventListener('click',async()=>{
    if(!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt=null;
    installButton.hidden=true;
  });
  window.addEventListener('appinstalled',()=>{
    deferredInstallPrompt=null;
    if(installButton) installButton.hidden=true;
    showToast('MediTill installed on this device.','success');
  });

  let wasOffline=!navigator.onLine;
  if(wasOffline) showToast('You are offline. Cached shell only; live pharmacy operations require a connection.','warning',0);
  window.addEventListener('offline',()=>{wasOffline=true;showToast('Connection lost. Sales and stock changes require internet.','warning',0);});
  window.addEventListener('online',()=>{if(wasOffline) showToast('Back online.','success');wasOffline=false;});
})();