const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../../public/js/pos-fullscreen.js'),'utf8');

function browser({pos=true,available=true,kiosk=false,denied=false}={}){
  const listeners=new Map();
  let active=false,requests=0;
  const location={href:'https://example.test'+(pos?'/pos':'/registers'),origin:'https://example.test',assign(value){this.href=value;}};
  function element(tag,classes=[]){
    const names=new Set(classes);
    return {tag,children:[],inert:false,classList:{contains:name=>names.has(name),add:name=>names.add(name),remove:name=>names.delete(name)},
      appendChild(child){this.children.push(child);child.owner=this;},
      remove(){this.owner.children=this.owner.children.filter(child=>child!==this);},
      addEventListener(){},setAttribute(){},querySelector(){return null;}};
  }
  const body=element('body',pos?['mt-pos-body']:[]);
  const root=element('html');
  const button=element('button');
  const document={body,documentElement:root,fullscreenElement:null,fullscreenEnabled:available,title:'MediTill',
    createElement:element,querySelector:selector=>selector==='dialog[open]'?null:pos?button:null,
    addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},
    removeEventListener(name,fn){listeners.get(name)?.delete(fn);},
    async exitFullscreen(){this.fullscreenElement=null;}
  };
  function requestFullscreen(options){
    requests++;
    assert.equal(options.navigationUI,'hide');
    if(!active||denied)return Promise.reject(new Error('Not permitted'));
    document.fullscreenElement=this;
    return Promise.resolve();
  }
  if(available){
    root.requestFullscreen=requestFullscreen;
    document.createElement=tag=>{const node=element(tag);node.requestFullscreen=requestFullscreen;return node;};
  }
  const display={matches:kiosk,addEventListener(){}};
  const window={location,parent:null,matchMedia:()=>display,addEventListener(){},MediTillToast(){}};
  window.parent=window;
  const navigator={userActivation:{get isActive(){return active;}}};
  const history={state:null,pushState(state,unused,url){this.state=state;location.href=url;},replaceState(state,unused,url){this.state=state;location.href=url;}};
  vm.runInNewContext(source,{document,window,navigator,history,location,URL});
  async function dispatch(name,event={}){
    active=event.isTrusted===true;
    for(const fn of [...(listeners.get(name)||[])])fn({key:'',target:{closest:()=>null},...event});
    active=false;
    await new Promise(resolve=>setImmediate(resolve));
  }
  function gesture(fn){active=true;const result=fn();active=false;return result;}
  return {document,window,controller:window.MediTillPosFullscreen,dispatch,gesture,requests:()=>requests};
}

test('direct entry waits for a real cashier interaction, not a synthetic event',async()=>{
  const page=browser();
  await page.dispatch('DOMContentLoaded');
  assert.equal(page.requests(),0);
  await page.dispatch('pointerdown',{isTrusted:false});
  assert.equal(page.requests(),0);
  await page.dispatch('pointerdown',{isTrusted:true});
  assert.equal(page.controller.isFullscreen(),true);
  assert.equal(page.requests(),1);
  await page.controller.toggle();
  await page.dispatch('pointerdown',{isTrusted:true});
  assert.equal(page.controller.isFullscreen(),false,'intentional exit must not trap the cashier');
});

test('Escape does not enter fullscreen; a normal keystroke does',async()=>{
  const page=browser();
  await page.dispatch('DOMContentLoaded');
  await page.dispatch('keydown',{isTrusted:true,key:'Escape'});
  assert.equal(page.requests(),0);
  await page.dispatch('keydown',{isTrusted:true,key:'1'});
  assert.equal(page.controller.isFullscreen(),true);
});
test('Escape closes a POS dialog without invoking the fullscreen toggle',async()=>{
  const page=browser();
  await page.dispatch('DOMContentLoaded');
  await page.dispatch('keydown',{isTrusted:true,key:'1'});
  const original=page.document.querySelector;
  page.document.querySelector=selector=>selector==='dialog[open]'?{}:original(selector);
  await page.dispatch('keydown',{isTrusted:true,key:'Escape'});
  assert.equal(page.controller.isFullscreen(),true);
  page.document.querySelector=original;
  await page.dispatch('keydown',{isTrusted:true,key:'Escape'});
  assert.equal(page.controller.isFullscreen(),false);
});

test('every POS link variant opens the same fullscreen terminal',async()=>{
  for(const route of ['/pos','/pos/','/pos?branch=2','/pos#cart']){
    const page=browser({pos:false});
    assert.equal(page.gesture(()=>page.controller.open(route)),true);
    assert.equal(page.controller.isFullscreen(),true);
    assert.equal(page.document.body.children[0].children[0].src,'https://example.test'+route);
  }
});

test('register submission retains fullscreen across a delayed API handoff',async()=>{
  const page=browser({pos:false});
  await page.gesture(()=>page.controller.enter());
  assert.equal(page.requests(),1);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(page.controller.open('/pos'),true);
  assert.equal(page.requests(),1,'handoff must not request fullscreen without activation');
  assert.equal(page.controller.isFullscreen(),true);
  await page.controller.navigate('/');
  assert.equal(page.document.body.children.length,0);
  assert.equal(page.controller.isFullscreen(),false);
});

test('POS brand link re-enters fullscreen without replacing the cart document',async()=>{
  const page=browser();
  assert.equal(page.gesture(()=>page.controller.open('/pos')),true);
  assert.equal(page.document.body.children.length,0);
  assert.equal(page.controller.isFullscreen(),true);
});

test('unsupported browsers and non-POS destinations retain normal navigation',async()=>{
  const page=browser({available:false});
  await page.dispatch('DOMContentLoaded');
  assert.equal(page.controller.open('/pos'),false);
  assert.equal(page.requests(),0);
  const supported=browser({pos:false});
  assert.equal(supported.controller.open('/purchases'),false);
  assert.equal(supported.controller.open('https://other.test/pos'),false);
});

test('kiosk display is already fullscreen and does not need a gesture',async()=>{
  const page=browser({kiosk:true});
  await page.dispatch('DOMContentLoaded');
  assert.equal(page.controller.isFullscreen(),true);
  assert.equal(page.requests(),0);
});

test('a denied fullscreen request leaves POS usable without repeated prompts',async()=>{
  const page=browser({denied:true});
  await page.dispatch('DOMContentLoaded');
  await page.dispatch('pointerdown',{isTrusted:true});
  assert.equal(page.controller.isFullscreen(),false);
  await page.dispatch('pointerdown',{isTrusted:true});
  assert.equal(page.requests(),1);
});

test('installed POS requests fullscreen before other display modes',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../../public/manifest.webmanifest'),'utf8'));
  assert.equal(manifest.start_url,'/pos');
  assert.equal(manifest.display,'fullscreen');
  assert.equal(manifest.display_override[0],'fullscreen');
});
