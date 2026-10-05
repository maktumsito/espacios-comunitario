const { chromium } = require('playwright');
const { createServer } = require('node:http');
const { readFileSync, existsSync, writeFileSync } = require('node:fs');
const { resolve, extname } = require('node:path');
const { gzipSync } = require('node:zlib');

(async()=> {
  const phase=process.argv[2]||'after';
  const root=resolve(process.argv[3]||'dist');
  const browser=await chromium.launch({ executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true });
  const server=createServer((req,res)=> {
    if(req.url.startsWith('/api/')) {res.setHeader('Content-Type','application/json');res.end(JSON.stringify({configured:false,connected:false,available:false,success:false}));return;}
    let path=resolve(root,'.'+req.url.split('?')[0]);
    if(!path.startsWith(root)) {res.writeHead(403);res.end();return;}
    if(!existsSync(path)||!extname(path)) path=resolve(root,'index.html');
    const type={'.js':'application/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'}[extname(path)]||'application/octet-stream';
    res.setHeader('Content-Type',type); res.setHeader('Content-Encoding','gzip');res.end(gzipSync(readFileSync(path)));
  });
  await new Promise(resolve=>server.listen(8787,'127.0.0.1',resolve));
  const output=[];
  try {
    const widths=(process.env.BENCH_WIDTHS||'390,1200').split(',').map(Number);
    const counts=(process.env.BENCH_COUNTS||'500,2500,10000').split(',').map(Number);
    for(const width of widths) for(const count of counts) {
      console.log(`${phase}: ${width}px / ${count} reservations`);
      const context=await browser.newContext({viewport:{width,height:844}});
      // Only the isolated static origin is reachable. ALL cloud requests abort.
      await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:8787'?route.continue():route.abort('blockedbyclient'));
      const page=await context.newPage(); const errors=[];
      page.on('pageerror',err=>errors.push(err.message));
      const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
      await page.addInitScript(({count})=> {
        const rows=Array.from({length:count},(_,i)=>({id:`sample-${i}`,fecha:`2026-10-${String(5+i%20).padStart(2,'0')}`,horaInicio:`${String(8+i%12).padStart(2,'0')}:00`,horaFin:`${String(9+i%12).padStart(2,'0')}:00`,espacio:['GIMNASIO','SALA 2','SALA 3','AUDITORIO'][i%4],responsable:`Vecino González ${i}`,descripcion:`Taller comunitario ${i}`,tipoActividad:'Taller',actividadRecurrente:'No',estado:'activa',terminaDiaSiguiente:false,version:0}));
        localStorage.setItem('reservas_comunitarias_cache_v6',JSON.stringify(rows));
        localStorage.setItem('espacios_auth_user',JSON.stringify({username:'local-test',name:'Local Test',role:'Administrador',initials:'LT',canCreateReservations:true,canEditReservations:true,canDeleteReservations:true}));
        localStorage.setItem('espacios_auth_session_expiry_v1',String(Date.now()+2*60*60*1000));
        localStorage.setItem('espacios_auth_session_start_v1',String(Date.now()));
        localStorage.setItem('app_view_preference','calendar');
        window.__mutations=0;new MutationObserver(()=>window.__mutations++).observe(document,{subtree:true,childList:true,attributes:true,characterData:true});
      },{count});
      await page.goto('http://127.0.0.1:8787',{waitUntil:'domcontentloaded'});
      await page.locator('#btn-new-reservation').waitFor({timeout:60000});
      await page.waitForLoadState('load');
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const initial=await page.evaluate(()=>({navigation:performance.getEntriesByType('navigation')[0]?.transferSize||0,resources:performance.getEntriesByType('resource').map(r=>({url:r.name,bytes:r.transferSize}))}));
      output.push({name:'initial-resources',count,width,...initial});
      if(process.env.BENCH_INITIAL_ONLY==='true') {await context.close();continue;}
      const frames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({duration:performance.now()-window.__start,mutations:window.__mutations-window.__before})))));
      async function measured(name,action,prepare=async()=>{}) {
        const samples=[];
        for(let i=0;i<33;i++) {
          await prepare();
          await page.evaluate(()=>{window.__start=performance.now();window.__before=window.__mutations;});
          await action(); const timing=await frames(); if(i>=3)samples.push(timing);
        }
        const sorted=samples.map(x=>x.duration).sort((a,b)=>a-b);
        output.push({name,count,width,medianMs:sorted[15],p95Ms:sorted[28],domMutationMedian:samples.map(s=>s.mutations).sort((a,b)=>a-b)[15],samples});
      }
      await measured('open-form',async()=> {await page.locator('#btn-new-reservation').click();await page.locator('#reservation-modal-form-body').waitFor();},async()=> {
        const close=page.getByRole('button',{name:'Cerrar modal',exact:true});if(await close.count())await close.click();
      });
      // Continuous form exposes the activity description without wizard navigation.
      if(!await page.locator('#input-reserva-descripcion').isVisible())await page.locator('#toggle-wizard-mode-btn').click();
      await measured('typing',async()=> {const input=page.locator('#input-reserva-descripcion');await input.fill('Taller '+Math.random().toString(36).slice(2,8));});
      await page.getByRole('button',{name:'Cerrar modal',exact:true}).click();
      const filterToggle=page.locator(width<768?'#btn-mobile-more-tools':'#btn-navbar-toggle-filters');
      if(width>=768) {
        await filterToggle.click();
        await measured('search-ui',async()=> {await page.locator('#filter-search-input').fill('gonzalez 12');},async()=> {await page.locator('#filter-search-input').fill('');});
        await page.locator('#filter-search-input').fill('');
        await measured('change-view',async()=> {await page.locator('#nav-tab-calendar').click();},async()=> {await page.locator('#nav-tab-mobile').click();});
      }
      const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({url:r.name,bytes:r.transferSize})));
      output.push({name:'resources',count,width,resources,errors});
      writeFileSync(`outputs/${phase}-browser.json`,JSON.stringify({phase,engine:'Edge headless',cpuRate:4,runs:30,warmups:3,cloud:'blocked',output},null,2));
      await context.close();
    }
    writeFileSync(`outputs/${phase}-browser.json`,JSON.stringify({phase,engine:'Edge headless',cpuRate:4,runs:30,warmups:3,cloud:'blocked',output},null,2));
  } finally {await browser.close();server.close();}
})().catch(error=> {console.error(error);process.exitCode=1;});
