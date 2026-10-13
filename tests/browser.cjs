const assert = require('node:assert/strict');
const {chromium} = require(process.env.BROWSER_TEST_PLAYWRIGHT_MODULE || 'playwright');
(async () => {
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage(); const errors=[],badRequests=[];
 page.on('pageerror',e=>errors.push(e.message)); page.on('response',r=>{if(r.status()>=400)badRequests.push(`${r.status()} ${r.url()}`)});
 await page.goto(process.env.BROWSER_TEST_URL || 'http://localhost:4173'); await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('#brand option').count(),31);
 const count=await page.evaluate(async()=>{
  const {vehicles}=await import('./src/vehicles.js');
  for(const v of vehicles){
   for(const [id,value] of [['brand',v.brand],['model',v.model],['version',v.id]]){
    const field=document.getElementById(id);field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}));
   }
   if(document.getElementById('version').value!==v.id || document.getElementById('total-cost').textContent==='—') throw Error(`Version not usable: ${v.id}`);
  }
  return vehicles.length;
 });
 console.log(`All ${count} catalog versions calculate successfully.`);
 await page.locator('#reset-example').click();
 await page.locator('#manual-mode').click();
 await page.locator('#manual-city').fill('10');await page.locator('#manual-highway').fill('20');
 await page.locator('#gasoline-price').fill('6,00');await page.locator('#distance').fill('100');
 await page.locator('#round-trip').check();
 await page.locator('#people').fill('3');await page.locator('#trips').fill('22');
 await page.locator('#trip-form button[type=submit]').click();
 assert.match(await page.locator('#total-cost').innerText(),/90,00/);
 assert.match(await page.locator('#per-person').innerText(),/30,00/);
 assert.match(await page.locator('#monthly-cost').innerText(),/1\.980,00/);
 await page.locator('[data-route=city]').click();assert.match(await page.locator('#total-cost').innerText(),/120,00/);
 await page.locator('[data-route=highway]').click();assert.match(await page.locator('#total-cost').innerText(),/60,00/);
 await page.locator('#distance').fill('0');await page.locator('#trip-form button[type=submit]').click();
 assert.equal(await page.locator('#total-cost').innerText(),'—');assert.equal(await page.locator('#copy-result').isDisabled(),true);
 await page.locator('#distance').fill('100');await page.locator('#trip-form button[type=submit]').click();
 await page.reload();assert.match(await page.locator('#total-cost').innerText(),/60,00/);
 assert.equal(await page.locator('#manual-mode').getAttribute('aria-pressed'),'true');
 await page.locator('#copy-result').click();await page.waitForFunction(()=>document.getElementById('copy-status').textContent==='Copiado!');assert.equal(await page.locator('#copy-status').innerText(),'Copiado!');
 const clipboard=await page.evaluate(()=>navigator.clipboard.readText());assert.ok(clipboard.includes('R$ 60,00'));
 await page.locator('#reset-example').click();assert.equal(await page.locator('#catalog-mode').getAttribute('aria-pressed'),'true');
 await page.locator('#ethanol-price').fill('');await page.locator('#trip-form button[type=submit]').click();
 assert.notEqual(await page.locator('#total-cost').innerText(),'—');assert.match(await page.locator('#comparison-content').innerText(),/Informe preços válidos/);
 await page.locator('#reset-example').click();
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow at ${width}`)}
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
 await context.setOffline(true);await page.reload();
 assert.equal(await page.locator('#brand option').count(),31);assert.match(await page.locator('#total-cost').innerText(),/41,98/);
 await page.locator('#round-trip').check();assert.match(await page.locator('#total-cost').innerText(),/83,96/);
 await context.setOffline(false);
 assert.equal(errors.length,0,errors.join('\n'));assert.equal(badRequests.length,0,badRequests.join('\n'));
 console.log('Passed: manual math, round trip, city/highway, division, month, invalid input, preference restore, copy, optional comparison price, 4 screen widths, offline reload and calculation. No JavaScript errors or HTTP failures.');
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
