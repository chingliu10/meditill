(()=>{
  let host=null;
  let frame=null;
  let previousUrl='';
  let previousState=null;
  let previousTitle='';
  let background=[];
  let toggleInFlight=false;

  const fullscreenElement=()=>document.fullscreenElement||document.webkitFullscreenElement;
  const requestFullscreen=element=>{
    const request=element.requestFullscreen||element.webkitRequestFullscreen;
    try{
      return request?Promise.resolve(request.call(element)):Promise.reject(new Error('Fullscreen unavailable'));
    }catch(error){return Promise.reject(error);}
  };
  const exitFullscreen=()=>{
    const exit=document.exitFullscreen||document.webkitExitFullscreen;
    return exit?Promise.resolve(exit.call(document)):Promise.resolve();
  };

  function supported(){
    const root=document.documentElement;
    if(root.requestFullscreen)return document.fullscreenEnabled!==false;
    return !!(root.webkitRequestFullscreen&&document.webkitFullscreenEnabled!==false);
  }

  function parentController(){
    try{
      if(window.parent!==window){
        const controller=window.parent.MediTillPosFullscreen;
        if(controller?.ownsFrame(window))return controller;
      }
    }catch(error){}
    return null;
  }

  function isFullscreen(){
    const parent=parentController();
    return parent?parent.isFullscreen():!!fullscreenElement();
  }

  function updateButton(){
    const button=document.querySelector('[data-pos-fullscreen-toggle]');
    if(!button)return;
    button.hidden=!supported();
    const active=isFullscreen();
    const label=active?'Exit fullscreen':'Enter fullscreen';
    button.setAttribute('aria-label',label);
    button.setAttribute('title',label);
    button.setAttribute('aria-pressed',String(active));
    const icon=button.querySelector('img');
    if(icon)icon.src=active?'/images/minimize.svg':'/images/maximize.svg';
  }

  function updateState(){
    updateButton();
    try{frame?.contentWindow.MediTillPosFullscreen?.updateButton();}catch(error){}
  }

  async function toggle(){
    const parent=parentController();
    if(parent)return parent.toggle();
    if(toggleInFlight)return;
    toggleInFlight=true;
    try{
      if(fullscreenElement())await exitFullscreen();
      else await requestFullscreen(host||document.documentElement);
    }catch(error){
      const notify=frame?.contentWindow.MediTillToast||window.MediTillToast;
      notify?.('Fullscreen is unavailable.','warning');
    }finally{
      toggleInFlight=false;
      updateState();
    }
  }

  async function close(restoreHistory=true){
    if(!host)return;
    const closingHost=host;
    try{if(fullscreenElement())await exitFullscreen();}catch(error){}
    if(host!==closingHost)return;
    closingHost.remove();
    host=null;
    frame=null;
    background.forEach(({element,inert})=>{element.inert=inert;});
    background=[];
    document.body.classList.remove('mt-pos-takeover-open');
    document.title=previousTitle;
    if(restoreHistory)history.replaceState(previousState,'',previousUrl);
  }

  async function navigate(value){
    const url=new URL(value,location.origin);
    if(url.origin!==location.origin)return;
    await close();
    location.assign(url.href);
  }

  function launch(url){
    if(host)return;
    previousUrl=location.href;
    previousState=history.state;
    previousTitle=document.title;
    host=document.createElement('div');
    host.className='mt-pos-takeover';
    frame=document.createElement('iframe');
    frame.title='MediTill POS';
    frame.allow='fullscreen';
    frame.allowFullscreen=true;
    frame.src=url.href;
    frame.addEventListener('load',()=>{
      if(!frame)return;
      try{
        const loadedUrl=frame.contentWindow.location.href;
        if(loadedUrl==='about:blank')return;
        if(!frame.contentDocument.body?.classList.contains('mt-pos-body')){
          navigate(loadedUrl);
          return;
        }
        document.title=frame.contentDocument.title;
        updateState();
      }catch(error){navigate(url.href);}
    });
    host.appendChild(frame);
    background=[...document.body.children].map(element=>({element,inert:element.inert}));
    background.forEach(({element})=>{element.inert=true;});
    document.body.appendChild(host);
    document.body.classList.add('mt-pos-takeover-open');

    // Fullscreen must begin in this click, before navigating the POS document.
    requestFullscreen(host).catch(()=>updateState());
    history.pushState({...history.state,posTakeover:true},'',url.href);
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-pos-fullscreen-toggle]');
    if(button){
      event.preventDefault();
      toggle();
      return;
    }
    if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    const link=event.target.closest?.('a[href]');
    if(!link||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;
    const url=new URL(link.href,location.href);
    if(url.origin!==location.origin||link.getAttribute('href').startsWith('#'))return;
    const parent=parentController();
    if(parent){
      if(url.pathname!=='/pos'){
        event.preventDefault();
        parent.navigate(url.href);
      }
      return;
    }
    if(url.pathname!=='/pos'||document.body.classList.contains('mt-pos-body')||!supported())return;
    event.preventDefault();
    launch(url);
  });

  document.addEventListener('fullscreenchange',updateState);
  document.addEventListener('webkitfullscreenchange',updateState);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&isFullscreen())toggle();
  });
  document.addEventListener('DOMContentLoaded',updateButton);
  window.addEventListener('popstate',()=>{if(host)close(false);});
  window.MediTillPosFullscreen={
    toggle,isFullscreen,navigate,updateButton,
    ownsFrame:child=>!!frame&&frame.contentWindow===child
  };
})();
