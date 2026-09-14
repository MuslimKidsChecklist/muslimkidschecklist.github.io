const { chromium } = require('playwright');
const F = 'file://' + __dirname + '/idx_gum_test.html';
const VERIFY = '**/api.gumroad.com/v2/licenses/verify';

const P = (over={}) => ({ success:true, uses:1, purchase: Object.assign({
  id:'p1', product_name:'Muslim Kids Checklist', email:'parent@example.com',
  refunded:false, chargebacked:false, disputed:false,
  subscription_cancelled_at:null, subscription_ended_at:null, subscription_failed_at:null
}, over) });

let pass=0, fail=0;
const t=(name,cond,extra='')=>{ (cond?pass++:fail++); console.log((cond?'  PASS  ':'  FAIL  ')+name+(extra?'  — '+extra:'')); };

/* handler(productId, key) -> {status, body} */
async function run(name, handler, steps){
  const b = await chromium.launch();
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  const seen = [];
  await p.route(VERIFY, async route => {
    const body = new URLSearchParams(route.request().postData()||'');
    const rec = { product: body.get('product_id'), key: body.get('license_key'), inc: body.get('increment_uses_count') };
    seen.push(rec);
    const res = handler(rec.product, rec.key);
    if(res === 'abort') return route.abort('failed');
    await route.fulfill({ status: res.status, contentType:'application/json', body: JSON.stringify(res.body) });
  });
  console.log('\n' + name);
  await steps(p, seen);
  await b.close();
}

/* Use the real customer path — welcome screen -> "Enter your code" — not
   ?gate=expired, because that switch deliberately re-shows the expired screen
   on every gateInit and would mask a successful unlock. */
const unlock = async (p, key) => {
  await p.goto(F + '?gate=reset');
  await p.waitForSelector('#gHaveCode');
  await p.click('#gHaveCode');
  await p.waitForSelector('#gKey');
  await p.fill('#gKey', key);
  await p.click('#gUnlock');
  await p.waitForTimeout(450);                 // read before gateInit() at 700ms
  return (await p.textContent('#gMsg')).trim();
};

(async () => {

await run('1. valid key for this product', (prod)=>
  prod==='PROD_MKC' ? {status:200, body:P()} : {status:404, body:{success:false,message:'That license does not exist for the provided product.'}},
  async (p, seen) => {
    const m = await unlock(p, 'AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDDDDDD');
    t('unlocks', m.includes('Unlocked'), m);
    await p.waitForTimeout(900);
    t('gate hidden', !(await p.isVisible('#gateWrap')));
    t('increment_uses_count is false', seen.every(s=>s.inc==='false'), JSON.stringify(seen[0]));
    const lic = await p.evaluate(()=>JSON.parse(localStorage.getItem('mkc:lic')));
    t('stored against the right product', lic.product==='PROD_MKC', JSON.stringify(lic));
  });

await run('2. bundle key (404 on app, success on bundle)', (prod)=>
  prod==='PROD_BUNDLE' ? {status:200, body:P({product_name:'All Three'})} : {status:404, body:{success:false}},
  async (p, seen) => {
    const m = await unlock(p, 'BUNDLE-KEY-1234-5678');
    t('unlocks on the bundle', m.includes('Unlocked'), m);
    t('tried the app product first', seen[0].product==='PROD_MKC');
    const lic = await p.evaluate(()=>JSON.parse(localStorage.getItem('mkc:lic')));
    t('stored against the bundle', lic.product==='PROD_BUNDLE');
  });

await run('3. a Spelling Quest key (404 everywhere) — THE OLD BUG', ()=>({status:404, body:{success:false}}),
  async (p, seen) => {
    const m = await unlock(p, 'SPELLING-QUEST-KEY-9999');
    t('refused', !m.includes('Unlocked'), m);
    t('says it may be another app\'s code', /not another one|another one/.test(m), m);
    t('did NOT say network problem', !/connection/i.test(m));
    t('asked both products', seen.length===2);
    const lic = await p.evaluate(()=>localStorage.getItem('mkc:lic'));
    t('nothing stored', !lic);
  });

for (const [label, over, expect] of [
  ['4. refunded',      {refunded:true},                      /refunded/i],
  ['5. chargebacked',  {chargebacked:true},                  /reversed by the card issuer/i],
  ['6. disputed',      {disputed:true},                      /disputed/i],
  ['7. sub ended',     {subscription_ended_at:'2026-08-01'}, /subscription has ended/i],
  ['8. renewal failed',{subscription_failed_at:'2026-08-01'},/did not go through/i],
]) {
  await run(label, (prod)=> prod==='PROD_MKC' ? {status:200, body:P(over)} : {status:404, body:{success:false}},
    async (p) => {
      const m = await unlock(p, 'AAAA-BBBB-CCCC-DDDD');
      t('refused with the right reason', expect.test(m), m);
      const lic = await p.evaluate(()=>localStorage.getItem('mkc:lic'));
      t('nothing stored', !lic);
    });
}

await run('9. cancelled but paid through the period — MUST STILL WORK',
  (prod)=> prod==='PROD_MKC'
    ? {status:200, body:P({subscription_cancelled_at:'2026-08-10', subscription_ended_at:null})}
    : {status:404, body:{success:false}},
  async (p) => {
    const m = await unlock(p, 'AAAA-BBBB-CCCC-DDDD');
    t('still unlocks', m.includes('Unlocked'), m);
  });

await run('10. network failure at unlock', ()=>'abort',
  async (p) => {
    const m = await unlock(p, 'AAAA-BBBB-CCCC-DDDD');
    t('says connection, not "wrong code"', /connection/i.test(m), m);
    t('does not claim the code is unknown', !/recognize/i.test(m));
  });

/* ---- weekly re-check ---- */
await run('11. weekly refresh: refund revokes',
  (prod)=> prod==='PROD_MKC' ? {status:200, body:P({refunded:true})} : {status:404, body:{success:false}},
  async (p) => {
    await p.goto(F);
    await p.evaluate(()=>localStorage.setItem('mkc:lic', JSON.stringify({key:'K',product:'PROD_MKC',dead:null,checked:0})));
    await p.goto(F);                       // stale -> triggers refreshLic
    await p.waitForTimeout(1500);
    const lic = await p.evaluate(()=>JSON.parse(localStorage.getItem('mkc:lic')));
    t('marked dead', lic && lic.dead==='refunded', JSON.stringify(lic));
    await p.goto(F);
    await p.waitForTimeout(900);
    const card = await p.textContent('#gateCard');
    t('next open says the subscription ended', /subscription has ended/i.test(card), card.slice(0,90));
    t('explains why', /refunded/i.test(card));
    t('does NOT offer a fresh free trial', !/Start my 7 days free/.test(card));
    t('offers the buy button', /Unlock for a year|Buying opens shortly/.test(card));
  });

await run('12. weekly refresh: network failure keeps access', ()=>'abort',
  async (p) => {
    await p.goto(F);
    await p.evaluate(()=>localStorage.setItem('mkc:lic', JSON.stringify({key:'K',product:'PROD_MKC',dead:null,checked:0})));
    await p.goto(F);
    await p.waitForTimeout(1500);
    const lic = await p.evaluate(()=>JSON.parse(localStorage.getItem('mkc:lic')));
    t('still alive', lic && !lic.dead, JSON.stringify(lic));
    t('gate stays hidden', !(await p.isVisible('#gateWrap')));
  });

await run('13. weekly refresh: still-good key stays good',
  (prod)=> prod==='PROD_MKC' ? {status:200, body:P()} : {status:404, body:{success:false}},
  async (p) => {
    await p.goto(F);
    await p.evaluate(()=>localStorage.setItem('mkc:lic', JSON.stringify({key:'K',product:'PROD_MKC',dead:null,checked:0})));
    await p.goto(F);
    await p.waitForTimeout(1500);
    const lic = await p.evaluate(()=>JSON.parse(localStorage.getItem('mkc:lic')));
    t('alive and re-stamped', lic && !lic.dead && lic.checked>0);
    t('gate hidden', !(await p.isVisible('#gateWrap')));
  });

console.log('\n===== ' + pass + ' passed, ' + fail + ' failed =====');
process.exit(fail ? 1 : 0);
})();
