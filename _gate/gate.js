
/* ================= trial + license gate =================
   Phase 6 pattern: the buy button resolves its destination when tapped,
   so launch day is a one-line change, not a code change.            */
const BUY = {
  checkout : '',      // <- Lemon Squeezy checkout URL, $40/year
  upgrade  : '',      // <- same checkout + ?checkout[discount_code]=RETURNING  ($25)
  bundle   : '',      // <- $89 all three
  email    : 'MuslimeenMarket@gmail.com',
  price    : '$40',
  upgPrice : '$25',
  upgCode  : 'RETURNING',
  trialDays: 7
};

/* ---------------------------------------------------------------
   WHICH KEYS THIS APP ACCEPTS.

   One Lemon Squeezy store will hold three products. Asking the API
   "is this key valid?" and nothing else means a Spelling Quest key
   unlocks this app, because it IS a valid key from this store.

   /v1/licenses/validate returns meta.product_id and meta.variant_id.
   List the LIVE product ids this app is entitled to: itself, and the
   three-app bundle. Live and test mode issue DIFFERENT ids — put the
   LIVE ones here, or paying customers get turned away.

   Leave the array empty and the check is skipped, so the gate still
   works before launch. It must NOT ship empty.
   --------------------------------------------------------------- */
const ALLOWED_PRODUCTS = [
  // <- Muslim Kids Checklist — Family Access   (live product_id)
  // <- Muslimeen Market — All Three            (live product_id)
];
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

/* ---- license ---- */
async function checkKey(key){
  const r=await fetch('https://api.lemonsqueezy.com/v1/licenses/validate',{
    method:'POST',
    headers:{'Accept':'application/json','Content-Type':'application/x-www-form-urlencoded'},
    body:'license_key='+encodeURIComponent(key)
  });
  if(!r.ok) throw new Error('http '+r.status);
  return r.json();
}

/* Lemon Squeezy keys are lowercase UUIDs. iOS autocapitalization and a parent
   retyping from a printout both mangle case, so try the sensible variants
   rather than telling a paying customer their code is wrong. */
const normKey=s=>(s||'').trim().replace(/\s+/g,'').replace(/[^A-Za-z0-9-]/g,'');
async function checkKeyLoose(raw){
  const k=normKey(raw);
  const tries=[...new Set([k, k.toLowerCase(), k.toUpperCase()])];
  let last=null;
  for(const t of tries){
    const d=await checkKey(t);
    if(d && d.valid) return {data:d, key:t};
    last=d;
  }
  return {data:last, key:k};
}

/* Does this key belong to THIS app? */
function productOK(d){
  if(!ALLOWED_PRODUCTS.length) return true;          // pre-launch escape hatch
  const pid = d && d.meta && d.meta.product_id;
  if(pid==null) return false;                        // can't prove it — don't grant
  return ALLOWED_PRODUCTS.some(a=>String(a)===String(pid));
}

function licState(){
  const l=lread(LKEY);
  if(!l||!l.key) return {state:'none'};
  if(l.expires && Date.now() > Date.parse(l.expires)) return {state:'expired', lic:l};
  return {state:'ok', lic:l, stale:(Date.now()-(l.checked||0))>7*DAY};
}
/* Re-check weekly, never on every open — the app must work offline on a
   locked-down iPad. A failed check NEVER locks out a paying customer.   */
async function refreshLic(l){
  try{
    const d=await checkKey(l.key);
    const st=d && d.license_key && d.license_key.status;
    const pid=(d && d.meta && d.meta.product_id)||null;
    /* Only a definitive wrong-product answer revokes. A network failure,
       a 5xx, or a response with no meta leaves access exactly as it was. */
    if(d && d.valid && pid!=null && !productOK(d)){
      lwrite(LKEY,null);
      return;
    }
    if(d && d.valid===false && st && st!=='active'){
      lwrite(LKEY,{...l,status:st,expires:(d.license_key.expires_at||l.expires),product:pid||l.product,checked:Date.now()});
    }else{
      lwrite(LKEY,{...l,status:st||'active',expires:(d.license_key&&d.license_key.expires_at)||l.expires,product:pid||l.product,checked:Date.now()});
    }
  }catch(e){ /* offline or blocked — keep existing access */ }
}

/* ---- trial ---- */
function trialInfo(){
  let t=lread(TKEY);
  if(!t){ return {started:false, left:BUY.trialDays}; }
  const used=Math.floor((Date.now()-t.start)/DAY);
  return {started:true, left:Math.max(0,BUY.trialDays-used)};
}
const startTrial=()=>lwrite(TKEY,{start:Date.now()});

/* ---- screens ---- */
function showGate(html){ const w=$('gateWrap'); $('gateCard').innerHTML=html; w.classList.add('on'); wireGate(); }
function hideGate(){ $('gateWrap').classList.remove('on'); }

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
function screenExpired(){
  return `<div class="gateLogo">Muslim Kids Checklist</div>
  <h2>Your 7 days are up.</h2>
  <p class="lede">Your setup is safe — nothing has been deleted. Unlock to carry on where you left off.</p>
  <p class="gPrice">${BUY.price}<small> / year, whole family</small></p>
  <ul class="gList">
    <li>Every device in the house</li>
    <li>As many children as you need</li>
    <li>A year of updates</li>
  </ul>
  ${buyButton('Unlock for a year','checkout')}
  <p class="gSmall" style="text-align:center">Already have another Muslimeen Market app? Use code
    <strong>${BUY.upgCode}</strong> at checkout and it's ${BUY.upgPrice}.</p>
  <hr class="gDiv">
  <p class="gSmall">Already bought it? Paste the code from your purchase email.</p>
  <input class="gCode" id="gKey" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">
  <button class="gBtn sec" id="gUnlock">Unlock</button>
  <div class="gMsg" id="gMsg"></div>`;
}
function screenCode(){
  return `<div class="gateLogo">Muslim Kids Checklist</div>
  <h2>Enter your code</h2>
  <p>It's in the email you got when you bought it. Capitals and dashes don't matter.</p>
  <input class="gCode" id="gKey" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">
  <button class="gBtn" id="gUnlock">Unlock</button>
  <div class="gMsg" id="gMsg"></div>
  <hr class="gDiv">
  <p class="gSmall">Lost it? Email <a href="mailto:${BUY.email}">${BUY.email}</a> and we'll resend it.</p>
  <p class="gSmall"><a href="#" id="gBack">Back</a></p>`;
}

function wireGate(){
  const s=id=>document.getElementById(id);
  const m=s('gMail'); if(m) m.href='mailto:'+BUY.email;
  if(s('gStart')) s('gStart').onclick=e=>{e.preventDefault();startTrial();gateInit();};
  if(s('gHaveCode')) s('gHaveCode').onclick=e=>{e.preventDefault();showGate(screenCode());};
  if(s('gBack')) s('gBack').onclick=e=>{e.preventDefault();gateInit();};
  if(s('gUnlock')) s('gUnlock').onclick=async()=>{
    const msg=s('gMsg'), typed=normKey(s('gKey').value);
    if(typed.length<8){ msg.className='gMsg err'; msg.textContent='That code looks too short.'; return; }
    msg.className='gMsg'; msg.textContent='Checking…';
    try{
      const {data:d, key}=await checkKeyLoose(typed);
      const st=d && d.license_key && d.license_key.status;
      if(d && d.valid && !productOK(d)){
        /* A real, paid, active key — for one of the other apps. Say so plainly;
           a confused customer who is told "invalid" emails support, and a
           customer who is told the truth clicks the right buy button. */
        const other=(d.meta && d.meta.product_name) ? d.meta.product_name : 'another app';
        msg.className='gMsg err';
        msg.innerHTML='That code is for '+String(other).replace(/[<>&]/g,'')+
          ', not Muslim Kids Checklist. Each app has its own code — '+
          'or get all three together.';
      }else if(d && d.valid){
        lwrite(LKEY,{
          key,
          status : st||'active',
          expires: (d.license_key&&d.license_key.expires_at)||null,
          product: (d.meta&&d.meta.product_id)||null,
          checked: Date.now()
        });
        msg.className='gMsg ok'; msg.textContent='Unlocked. Enjoy!';
        setTimeout(gateInit,700);
      }else if(st==='expired'){
        msg.className='gMsg err'; msg.textContent='That code has expired. Renew and it will work again.';
      }else{
        msg.className='gMsg err'; msg.textContent="We don't recognize that code. Check the email it came in.";
      }
    }catch(e){
      msg.className='gMsg err';
      msg.textContent='Could not reach us just now — check your connection and try again.';
    }
  };
}

function gateInit(){
  const L=licState();
  if(L.state==='ok'){ hideGate(); $('trialBar').classList.remove('on'); if(L.stale) refreshLic(L.lic); return; }
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
