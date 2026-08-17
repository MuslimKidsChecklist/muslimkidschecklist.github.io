
/* ================= trial + licence gate =================
   Phase 6 pattern: the buy button resolves its destination when tapped,
   so launch day is a one-line change, not a code change.            */
const BUY = {
  checkout : '',      // <- Lemon Squeezy checkout URL, $40/year
  upgrade  : '',      // <- $25 upgrade for existing customers
  bundle   : '',      // <- $89 all three
  email    : 'MuslimeenMarket@gmail.com',
  price    : '$40',
  trialDays: 7
};
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

/* ---- licence ---- */
async function checkKey(key){
  const r=await fetch('https://api.lemonsqueezy.com/v1/licenses/validate',{
    method:'POST',
    headers:{'Accept':'application/json','Content-Type':'application/x-www-form-urlencoded'},
    body:'license_key='+encodeURIComponent(key)
  });
  if(!r.ok) throw new Error('http '+r.status);
  return r.json();
}
const normKey=s=>(s||'').toUpperCase().replace(/[^A-Z0-9-]/g,'');

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
    if(d && d.valid===false && st && st!=='active'){
      lwrite(LKEY,{...l,status:st,expires:(d.license_key.expires_at||l.expires),checked:Date.now()});
    }else{
      lwrite(LKEY,{...l,status:st||'active',expires:(d.license_key&&d.license_key.expires_at)||l.expires,checked:Date.now()});
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
  <p class="gSmall" style="text-align:center">Already have Spelling Quest or One Ayah? It's $25 to add this one — just ask.</p>
  <hr class="gDiv">
  <p class="gSmall">Already bought it? Paste the code from your purchase email.</p>
  <input class="gCode" id="gKey" placeholder="XXXXXXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false">
  <button class="gBtn sec" id="gUnlock">Unlock</button>
  <div class="gMsg" id="gMsg"></div>`;
}
function screenCode(){
  return `<div class="gateLogo">Muslim Kids Checklist</div>
  <h2>Enter your code</h2>
  <p>It's in the email you got when you bought it. Capitals and dashes don't matter.</p>
  <input class="gCode" id="gKey" placeholder="XXXXXXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false">
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
    const msg=s('gMsg'), key=normKey(s('gKey').value);
    if(key.length<8){ msg.className='gMsg err'; msg.textContent='That code looks too short.'; return; }
    msg.className='gMsg'; msg.textContent='Checking…';
    try{
      const d=await checkKey(key);
      const st=d && d.license_key && d.license_key.status;
      if(d && d.valid){
        lwrite(LKEY,{key,status:st||'active',expires:(d.license_key&&d.license_key.expires_at)||null,checked:Date.now()});
        msg.className='gMsg ok'; msg.textContent='Unlocked. Enjoy!';
        setTimeout(gateInit,700);
      }else if(st==='expired'){
        msg.className='gMsg err'; msg.textContent='That code has expired. Renew and it will work again.';
      }else{
        msg.className='gMsg err'; msg.textContent="We don't recognise that code. Check the email it came in.";
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
