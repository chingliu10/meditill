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

  function decorateTables(root=document){
    root.querySelectorAll('.mt-table:not(.mt-table-scroll-mobile)').forEach(table=>{
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
    root.querySelectorAll('.mt-table-scroll-mobile').forEach(table=>table.closest('.mt-table-wrap')?.classList.add('mt-scroll-table-wrap'));
  }
  decorateTables();

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

  document.addEventListener('submit',async event=>{
    const form=event.target.closest?.('form[data-confirm-form]');
    if(!form)return;
    event.preventDefault();
    const ok=await window.MediTillConfirm({
      title:form.dataset.confirmTitle||'Confirm action',
      message:form.dataset.confirmMessage||'Are you sure?'
    });
    if(ok)form.submit();
  });

  const ajaxControllers=new Map();
  const debounceTimers=new WeakMap();
  const ajaxSkeletonSnapshots=new WeakMap();

  function ajaxFormUrl(form){
    const url=new URL(form.getAttribute('action')||window.location.pathname,window.location.origin);
    const params=new URLSearchParams(new FormData(form));
    url.search=params.toString();
    return url;
  }

  function ajaxTargetSelector(name){
    const safe=window.CSS?.escape?CSS.escape(name):String(name).replaceAll('"','\\"');
    return '[data-ajax-results="'+safe+'"]';
  }

  function skeletonLineWidth(rowIndex,columnIndex){
    const widths=[78,56,68,44,72,61,82,50];
    return widths[(rowIndex+columnIndex)%widths.length]+'%';
  }

  function showAjaxSkeleton(container){
    const tables=[...container.querySelectorAll('.mt-table')];
    if(!tables.length)return;

    if(!ajaxSkeletonSnapshots.has(container)){
      ajaxSkeletonSnapshots.set(container,tables.map(table=>{
        const tbody=table.querySelector('tbody');
        return tbody?{table,tbody,html:tbody.innerHTML}:null;
      }).filter(Boolean));
    }

    tables.forEach(table=>{
      const tbody=table.querySelector('tbody');
      if(!tbody)return;

      const headers=[...table.querySelectorAll('thead th')];
      const columnCount=Math.max(headers.length,tbody.querySelector('tr')?.children.length||1);
      const fragment=document.createDocumentFragment();

      for(let rowIndex=0;rowIndex<8;rowIndex+=1){
        const row=document.createElement('tr');
        row.className='mt-skeleton-row';
        row.setAttribute('aria-hidden','true');

        for(let columnIndex=0;columnIndex<columnCount;columnIndex+=1){
          const cell=document.createElement('td');
          cell.className='mt-skeleton-cell';
          const label=headers[columnIndex]?.textContent?.trim();
          if(label)cell.dataset.label=label;

          const line=document.createElement('span');
          line.className='mt-skeleton-line';
          line.style.setProperty('--mt-skeleton-width',skeletonLineWidth(rowIndex,columnIndex));
          cell.appendChild(line);
          row.appendChild(cell);
        }

        fragment.appendChild(row);
      }

      tbody.replaceChildren(fragment);
      table.setAttribute('aria-busy','true');
    });
  }

  function restoreAjaxSkeleton(container){
    const snapshots=ajaxSkeletonSnapshots.get(container);
    if(!snapshots)return;

    snapshots.forEach(({table,tbody,html})=>{
      if(tbody.isConnected)tbody.innerHTML=html;
      table.removeAttribute('aria-busy');
    });
    ajaxSkeletonSnapshots.delete(container);
  }

  async function loadAjaxResults(url,targetName,{push=true}={}){
    const selector=ajaxTargetSelector(targetName);
    const current=document.querySelector(selector);
    if(!current)return;

    ajaxControllers.get(targetName)?.abort();
    const controller=new AbortController();
    ajaxControllers.set(targetName,controller);

    const active=document.activeElement;
    const activeName=current.contains(active)?active?.getAttribute('name'):null;
    const selectionStart=activeName&&typeof active.selectionStart==='number'?active.selectionStart:null;
    const selectionEnd=activeName&&typeof active.selectionEnd==='number'?active.selectionEnd:null;

    current.classList.add('is-ajax-loading');
    current.setAttribute('aria-busy','true');
    showAjaxSkeleton(current);

    try{
      const response=await fetch(url,{
        headers:{
          'accept':'text/html',
          'x-requested-with':'XMLHttpRequest'
        },
        signal:controller.signal
      });
      if(!response.ok)throw new Error('Could not load filtered results');

      const html=await response.text();
      const doc=new DOMParser().parseFromString(html,'text/html');
      const incoming=doc.querySelector(selector);
      if(!incoming)throw new Error('Filtered results were not found');

      ajaxSkeletonSnapshots.delete(current);
      current.replaceWith(incoming);
      decorateTables(incoming);

      if(activeName){
        const replacement=incoming.querySelector('[name="'+activeName.replaceAll('"','\\"')+'"]');
        if(replacement){
          replacement.focus({preventScroll:true});
          if(selectionStart!==null&&typeof replacement.setSelectionRange==='function'){
            replacement.setSelectionRange(selectionStart,selectionEnd);
          }
        }
      }

      if(push){
        history.pushState({ajaxTarget:targetName},'',url.pathname+url.search);
      }
    }catch(error){
      if(error.name!=='AbortError'){
        restoreAjaxSkeleton(current);
        showToast(error.message||'Could not load results','error');
      }
    }finally{
      if(ajaxControllers.get(targetName)===controller){
        ajaxControllers.delete(targetName);
        const live=document.querySelector(selector);
        live?.classList.remove('is-ajax-loading');
        live?.removeAttribute('aria-busy');
      }
    }
  }

  document.addEventListener('submit',event=>{
    const form=event.target.closest?.('form[data-ajax-filter]');
    if(!form)return;
    event.preventDefault();
    const targetName=form.dataset.ajaxTarget;
    if(!targetName)return;
    loadAjaxResults(ajaxFormUrl(form),targetName);
  });

  document.addEventListener('input',event=>{
    const input=event.target.closest?.('form[data-ajax-filter][data-debounce-search] input');
    if(!input)return;
    if(input.type&& !['text','search'].includes(input.type))return;

    const form=input.form;
    clearTimeout(debounceTimers.get(form));
    const delay=Math.max(150,Number(form.dataset.debounceSearch)||350);
    debounceTimers.set(form,setTimeout(()=>form.requestSubmit(),delay));
  });

  document.addEventListener('change',event=>{
    const select=event.target.closest?.('form[data-ajax-filter] select');
    if(!select)return;
    const form=select.form;
    clearTimeout(debounceTimers.get(form));
    form.requestSubmit();
  });

  document.addEventListener('keydown',event=>{
    if(event.key!=='Enter'||event.isComposing)return;
    const field=event.target.closest?.('form[data-ajax-filter][data-debounce-search] input');
    if(!field||field.type&& !['text','search'].includes(field.type))return;
    const form=field.form;
    if(!form)return;
    event.preventDefault();
    clearTimeout(debounceTimers.get(form));
    form.requestSubmit();
  });

  document.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const link=event.target.closest?.('a.mt-page-link,a.mt-period-chip,a.mt-search-clear');
    if(!link)return;

    const current=link.closest('[data-ajax-results]');
    const targetName=link.dataset.ajaxTarget||current?.dataset.ajaxResults;
    if(!targetName)return;

    const url=new URL(link.href,window.location.origin);
    if(url.origin!==window.location.origin)return;

    event.preventDefault();

    if(link.classList.contains('mt-period-chip')){
      const strip=link.closest('.mt-period-strip');
      strip?.querySelectorAll('.mt-period-chip').forEach(item=>item.classList.toggle('is-active',item===link));
      const params=url.searchParams;
      const form=document.querySelector('form[data-ajax-filter][data-ajax-target="'+targetName+'"]');
      if(form){
        for(const key of ['period','days']){
          if(params.has(key)){
            const field=form.querySelector('[name="'+key+'"]');
            if(field)field.value=params.get(key);
          }
        }
      }
    }

    if(link.classList.contains('mt-search-clear')){
      const form=document.querySelector('form[data-ajax-filter][data-ajax-target="'+targetName+'"]');
      const input=form?.querySelector('input[name="q"],input[name="stock_q"],input[name="batch_q"]');
      if(input)input.value='';
    }

    loadAjaxResults(url,targetName);
  });

  window.addEventListener('popstate',()=>{
    const targetName=history.state?.ajaxTarget;
    if(targetName)loadAjaxResults(new URL(window.location.href),targetName,{push:false});
    else window.location.reload();
  });

  document.addEventListener('change',async event=>{
    const select=event.target.closest?.('.batch-status');
    if(!select)return;
    if(!select.value)return;

    const ok=await window.MediTillConfirm({title:'Change batch status?',message:'This affects whether the batch can be sold.'});
    if(!ok){select.value='';return;}

    try{
      const response=await fetch('/inventory/batches/'+select.dataset.batch+'/status',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({status:select.value})
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Failed to update batch status');
      showToast('Batch status updated.','success');
      const container=select.closest('[data-ajax-results]');
      if(container){
        await loadAjaxResults(new URL(window.location.href),container.dataset.ajaxResults,{push:false});
      }
    }catch(error){
      showToast(error.message||'Failed to update batch status','error');
      select.value='';
    }
  });

  document.querySelectorAll('[data-password-toggle]').forEach(toggle=>{
    toggle.addEventListener('click',()=>{
      const input=document.getElementById(toggle.dataset.passwordToggle);
      if(!input)return;
      const showing=input.type==='text';
      input.type=showing?'password':'text';
      toggle.setAttribute('aria-label',showing?'Show password':'Hide password');
      toggle.setAttribute('title',showing?'Show password':'Hide password');
      toggle.classList.toggle('is-visible',!showing);
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