
/* ================= trial + license gate — GUMROAD =================
   Moved off Lemon Squeezy on 18 Aug 2026 after a second, final rejection.
   The shape of this file is unchanged: a 7-day local trial, then a license
   key the customer pastes in. Only the verification call is different.

   Phase 6 pattern: the buy button resolves its destination when tapped,
   so launch day is a one-line change, not a code change.               */

const BUY = {
  checkout : '',      // <- https://<handle>.gumroad.com/l/<permalink>   ($40/yr)
  bundle   : '',      // <- the all-three product                        ($89/yr)
  email    : 'muslimkidschecklist@gmail.com',
  price    : '$40',
  upgPrice : '$25',
  upgCode  : '',      // <- Gumroad offer code for returning customers. NOT shown on screen.
  siblings : 'Spelling Quest or One Ayah At A Time',
  trialDays: 7
};

/* ---------------------------------------------------------------
   WHICH PRODUCTS THIS APP ACCEPTS A KEY FOR.

   Gumroad's verify endpoint is product-scoped: you must name the
   product you are asking about. That is a real improvement over the
   old setup, where "is this key valid?" was answerable by any key
   from the same store — which meant a Spelling Quest key unlocked
   this app. Here that cannot happen: a key only verifies against a
   product it was actually issued for.

   So this list IS the entitlement rule. Two entries: this app, and
   the three-app bundle. Nothing else can ever unlock it.

   Find each id in Gumroad: Products → the product → Settings, the
   field labelled "Product ID" (a uuid-looking string, NOT the
   permalink in the URL).

   Empty ids are skipped, so the gate still runs before launch.
   It must NOT ship with both empty.
   --------------------------------------------------------------- */
const PRODUCTS = [
  { id: '', label: 'Muslim Kids Checklist' },   // <- fill at launch
  { id: '', label: 'All Three'            }     // <- fill at launch
];

const GUM_API = 'https://api.gumroad.com/v2/licenses/verify';
const TKEY='mkc:trial', LKEY='mkc:lic';
const DAY=86400000;

const lread=k=>{ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } };
const lwrite=(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} };

function buyHref(kind){
  const u=BUY[kind]||BUY.checkout;
  if(u) return {href:u, ext:true};
  if(BUY.email) return {href:'mailto:'+BUY.email+'?subject='+encodeURIComponent('Muslim Kids Checklist — I would like to buy'), ext:false};
  return null;
}
function buyButton(label, kind){
  const t=buyHref(kind);
  if(!t) return `<div class="gBtn" style="opacity:.6;cursor:default">Buying opens shortly</div>`;
  return `<a class="gBtn" href="${t.href}"${t.ext?' target="_blank" rel="noopener"':''}>${label}</a>`;
}

/* ---------------- license ----------------
   One call, one product. Two things about this endpoint matter:

   1. It answers "no" with HTTP 404, not with 200 + success:false.
      Treating 404 as a network error would turn "wrong code" into
      "we couldn't reach the server", which sends a confused customer
      to support instead of to the right buy button.

   2. increment_uses_count must be 'false'. It defaults to true, and
      this app re-checks weekly — leaving it on would inflate every
      customer's use count forever and make that number meaningless
      if it is ever used for device limits.                          */
async function gumVerify(productId, key){
  const r = await fetch(GUM_API, {
    method : 'POST',
    headers: {'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},
    body   : new URLSearchParams({
      product_id: productId,
      license_key: key,
      increment_uses_count: 'false'
    }).toString()
  });
  if(!r.ok && r.status !== 404) throw new Error('http '+r.status);   // a real failure
  try{ return await r.json(); }catch(e){ return {success:false}; }   // 404 body is JSON, but be safe
}

/* Keys are printed uppercase in Gumroad's emails but the API is
   case-insensitive. Strip what a parent retyping from paper adds. */
const normKey = s => (s||'').trim().replace(/\s+/g,'').replace(/[^A-Za-z0-9-]/g,'');

/* Ask each product we accept, in order, until one says yes.
   Returns {ok, data, product} — or {ok:false, reason:'network'|'unknown'}.
   'network' is never allowed to look like 'unknown': a customer whose
   wifi dropped must not be told their code is wrong. */
async function checkKey(rawKey){
  const key = normKey(rawKey);
  const live = PRODUCTS.filter(p => p.id);
  if(!live.length) return {ok:false, reason:'unconfigured', key};

  let networkFails = 0;
  for(const p of live){
    try{
      const d = await gumVerify(p.id, key);
      if(d && d.success) return {ok:true, data:d, product:p, key};
    }catch(e){ networkFails++; }
  }
  return {ok:false, reason: networkFails ? 'network' : 'unknown', key};
}

/* Is a verified purchase still entitled to access?
   Returns null when fine, or a short reason string when it is not.

   The subtle one is cancellation. Gumroad sets subscription_cancelled_at
   the moment a customer cancels, but they have already paid to the end of
   the period — and our terms promise exactly that. Revoking on
   `cancelled_at` would cut off paying customers early, so only
   `ended_at` (the period actually ran out) counts.

   Anything this function does not recognize is treated as fine. Guessing
   "dead" from an unfamiliar field is how you lock out someone who paid. */
function deadReason(pur){
  if(!pur) return null;
  if(pur.refunded === true)                        return 'refunded';
  if(pur.chargebacked === true)                    return 'chargebacked';
  if(pur.disputed === true && pur.dispute_won !== true) return 'disputed';
  if(pur.subscription_ended_at)                    return 'ended';
  if(pur.subscription_failed_at)                   return 'failed';
  return null;                                     // cancelled-but-not-ended is still active
}

function licState(){
  const l=lread(LKEY);
  if(!l||!l.key) return {state:'none'};
  if(l.dead)     return {state:'expired', lic:l};
  return {state:'ok', lic:l, stale:(Date.now()-(l.checked||0))>7*DAY};
}

/* Re-check weekly, never on every open — the app must work offline on a
   locked-down iPad. A failed check NEVER locks out a paying customer. */
async function refreshLic(l){
  const r = await checkKey(l.key);
  if(r.reason === 'network' || r.reason === 'unconfigured') return;   // leave access exactly as it was
  if(!r.ok){
    /* A definitive "this key is not valid for either product" — the key was
       disabled, or the product was deleted. Mark it, don't erase it, so the
       expired screen can still show the code they pasted. */
    lwrite(LKEY, {...l, dead:'unknown', checked:Date.now()});
    return;
  }
  const dead = deadReason(r.data.purchase);
  lwrite(LKEY, {...l, product:r.product.id, dead:dead||null, checked:Date.now()});
}

/* ---- trial ---- */
function trialInfo(){
  let t=lread(TKEY);
  if(!t){ return {started:false, left:BUY.trialDays}; }
  const used=Math.floor((Date.now()-t.start)/DAY);
  return {started:true, left:Math.max(0,BUY.trialDays-used)};
}
const startTrial=()=>lwrite(TKEY,{start:Date.now()});

const DEAD_COPY = {
  refunded    : 'That purchase was refunded, so the code no longer works.',
  chargebacked: 'That purchase was reversed by the card issuer, so the code no longer works.',
  disputed    : 'That purchase is disputed, so the code is on hold. Email us and we will sort it out.',
  ended       : 'That subscription has ended. Renew and the same code works again.',
  failed      : 'The last renewal payment did not go through. Update your card and the same code works again.',
  unknown     : 'That code is no longer active. Email us and we will sort it out.'
};

/* ---- screens ---- */
function showGate(html){ const w=$('gateWrap'); $('gateCard').innerHTML=html; w.classList.add('on'); wireGate(); }
function hideGate(){ $('gateWrap').classList.remove('on'); }

const CODEBOX = `<input class="gCode" id="gKey" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
  autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">`;

function screenWelcome(){
  return `<div class="gateLogo">Muslim Kids Checklist</div>
  <h2>A checklist your child can read — because it's pictures.</h2>
  <p class="lede">Salah, Qur'an, chores and homework in one place. Built for a child who can't read yet.</p>
  <ul class="gList">
    <li>Every task is a picture, not a word</li>
    <li>Fajr through Isha, each with its own artwork</li>
    <li>Works on a locked-down iPad, no browser needed</li>
    <li>Add as many children as you like</li>
  </ul>
  <a class="gBtn" id="gStart" href="#">Start my 7 days free</a>
  <p class="gSmall" style="text-align:center">No card. No account. Nothing to cancel.</p>
  <hr class="gDiv">
  <p class="gSmall">Already bought it? <a href="#" id="gHaveCode">Enter your code</a></p>`;
}
/* `dead` is set when a key that once worked has stopped working — refunded,
   ended, renewal failed. Those customers are NOT on a trial and must never be
   offered one, so this screen doubles as the end-of-subscription screen and
   says which of the two situations they are in. */
function screenExpired(dead){
  const head = dead
    ? `<h2>Your subscription has ended.</h2>
       <p class="lede">${DEAD_COPY[dead] || DEAD_COPY.unknown} Your setup is safe — nothing has been deleted.</p>`
    : `<h2>Your 7 days are up.</h2>
       <p class="lede">Your setup is safe — nothing has been deleted. Unlock to carry on where you left off.</p>`;
  return `<div class="gateLogo">Muslim Kids Checklist</div>
  ${head}
  <p class="gPrice">${BUY.price}<small> / year, whole family</small></p>
  <ul class="gList">
    <li>Every device in the house</li>
    <li>As many children as you need</li>
    <li>A year of updates</li>
  </ul>
  ${buyButton('Unlock for a year','checkout')}
  <p class="gSmall" style="text-align:center">Already have ${BUY.siblings}? It's ${BUY.upgPrice} to add
    this one — your code is in your welcome email, or <a href="mailto:${BUY.email}?subject=${
    encodeURIComponent('Second app, please')}">ask us</a> and we'll send it.</p>
  <hr class="gDiv">
  <p class="gSmall">Already bought it? Paste the code from your purchase email.</p>
  ${CODEBOX}
  <button class="gBtn sec" id="gUnlock">Unlock</button>
  <div class="gMsg" id="gMsg"></div>`;
}
function screenCode(){
  return `<div class="gateLogo">Muslim Kids Checklist</div>
  <h2>Enter your code</h2>
  <p>It's in the email you got when you bought it. Capitals and dashes don't matter.</p>
  ${CODEBOX}
  <button class="gBtn" id="gUnlock">Unlock</button>
  <div class="gMsg" id="gMsg"></div>
  <hr class="gDiv">
  <p class="gSmall">Lost it? Email <a href="mailto:${BUY.email}">${BUY.email}</a> and we'll resend it.</p>
  <p class="gSmall"><a href="#" id="gBack">Back</a></p>`;
}


function wireGate(){
  const s=id=>document.getElementById(id);
  const m=s('gMail'); if(m) m.href='mailto:'+BUY.email;
  if(s('gStart')) s('gStart').onclick=e=>{e.preventDefault();startTrial();gateInit();startTour();};
  if(s('gHaveCode')) s('gHaveCode').onclick=e=>{e.preventDefault();showGate(screenCode());};
  if(s('gBack')) s('gBack').onclick=e=>{e.preventDefault();gateInit();};
  if(s('gUnlock')) s('gUnlock').onclick=async()=>{
    const msg=s('gMsg'), typed=normKey(s('gKey').value);
    const fail=t=>{ msg.className='gMsg err'; msg.textContent=t; };
    if(typed.length<8) return fail('That code looks too short.');
    msg.className='gMsg'; msg.textContent='Checking…';

    const r = await checkKey(typed);

    if(r.reason === 'unconfigured')
      return fail("We're not selling yet — check back soon, or email " + BUY.email + ' and we’ll let you know when codes are ready.');
    if(r.reason === 'network')
      return fail('Could not reach us just now — check your connection and try again.');

    if(!r.ok)
      return fail("We don't recognize that code. Check the email it came in — and that it's the code for this app, not another one.");

    const dead = deadReason(r.data.purchase);
    if(dead) return fail(DEAD_COPY[dead] || DEAD_COPY.unknown);

    lwrite(LKEY, {
      key    : r.key,
      product: r.product.id,
      dead   : null,
      checked: Date.now()
    });
    msg.className='gMsg ok'; msg.textContent='Unlocked. Enjoy!';
    setTimeout(()=>{ gateInit(); startTour(); },700);
  };
}

/* ---------------------------------------------------------------
   TEST SWITCH.

   There is no console on an iPad, so without this there is no way to
   reach the expired screen or replay the walkthrough on the device
   that actually matters. Append to the URL:

     ?gate=reset    clear the trial and any stored code — back to the
                    welcome screen
     ?gate=trial    start the trial as if it began today
     ?gate=expired  jump straight to the expired screen (this one is
                    not stored; reload and it's gone)
     ?tour=1        replay the walkthrough

   None of these grant access. `reset` only takes access away, and it
   does nothing a parent couldn't already do from Settings → clear
   website data — which is also why the trial is a speed bump and not
   a lock, by design.
   --------------------------------------------------------------- */
function gateSwitch(){
  const q=new URLSearchParams((location.search||'')+'&'+(location.hash||'').replace(/^#/,''));
  const g=q.get('gate');
  if(g==='reset'){ try{ localStorage.removeItem(TKEY); localStorage.removeItem(LKEY); localStorage.removeItem(TOURKEY); }catch(e){} }
  if(g==='trial'){ startTrial(); }
  if(q.get('tour')==='1'){ setTimeout(()=>startTour(true),500); }
  return g;
}

function gateInit(){
  if(gateInit._sw===undefined) gateInit._sw=gateSwitch();
  if(gateInit._sw==='expired'){ $('trialBar').classList.remove('on'); showGate(screenExpired()); return; }
  const L=licState();
  if(L.state==='ok'){ hideGate(); $('trialBar').classList.remove('on'); if(L.stale) refreshLic(L.lic); return; }
  if(L.state==='expired'){
    /* They bought once and it lapsed. Without this they fall through to the
       trial branch and — having never started a trial — get offered seven
       free days, which is both wrong and a way to never renew.            */
    $('trialBar').classList.remove('on');
    showGate(screenExpired(L.lic.dead));
    return;
  }
  const t=trialInfo();
  if(!t.started){ showGate(screenWelcome()); return; }
  if(t.left>0){
    hideGate();
    const b=$('trialBar'); b.classList.add('on');
    b.innerHTML = t.left===1
      ? `Last day of your free trial · <a href="#" id="tbBuy">Unlock for a year</a>`
      : `${t.left} days left in your free trial · <a href="#" id="tbBuy">Unlock for a year</a>`;
    const tb=document.getElementById('tbBuy');
    if(tb) tb.onclick=e=>{e.preventDefault();showGate(screenExpired());};
    return;
  }
  $('trialBar').classList.remove('on');
  showGate(screenExpired());
}
