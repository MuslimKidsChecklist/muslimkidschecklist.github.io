
/* ================= first-run walkthrough =================
   Runs once, after the trial starts or a code is entered. Five steps, each
   one anchored to a real control. It is skippable at every step and it
   never blocks the app — if a step's target is missing (a different child
   count, a narrow screen), that step is dropped rather than pointing at
   nothing.

   Deliberately no confirm()/alert()/window.open(): a Home Screen web app
   on iOS swallows all three silently.                                     */

const TOURKEY = 'mkc:tour';

const TOUR_STEPS = [
  { sel : null,
    title: 'Twenty seconds and you know the whole thing',
    body : "Every job here is a picture. That is the whole idea — your child can use this before they can read a word of it." },

  { sel : '#board .tile',
    title: 'Tap a picture to check it off',
    body : 'Tap it again to undo. Checks clear on their own each week, so nothing needs resetting.' },

  { sel : '#btnWeek',
    title: 'Whole week, or one day',
    body : 'One day is the calm view for a young child. Whole week shows the full grid — better for you, and for older children.' },

  { sel : '#btnParent',
    title: 'Make it yours in here',
    body : 'Everything on screen right now is just an example. Grown-ups is where you add your own children and pick their tasks.' },

  { sel : null,
    title: 'Add this to your Home Screen',
    body : 'Please do this one. iPads clear website data after about a week of not visiting, and the Home Screen copy is what keeps your setup safe. Share → Add to Home Screen.' }
];

let tourAt = 0, tourList = [], tourOnResize = null;

const tourSeen  = () => { try { return localStorage.getItem(TOURKEY) === '1'; } catch (e) { return false; } };
const tourMark  = () => { try { localStorage.setItem(TOURKEY, '1'); } catch (e) {} };

function tourEls(){
  let b = document.getElementById('tourBlock');
  if (!b){
    b = document.createElement('div'); b.id = 'tourBlock'; document.body.appendChild(b);
    const s = document.createElement('div'); s.id = 'tourSpot'; document.body.appendChild(s);
    const c = document.createElement('div'); c.id = 'tourCard'; document.body.appendChild(c);
  }
  return {
    block: document.getElementById('tourBlock'),
    spot : document.getElementById('tourSpot'),
    card : document.getElementById('tourCard')
  };
}

function tourPlace(step){
  const { spot, card } = tourEls();
  const vw = window.innerWidth, vh = window.innerHeight;
  const target = step.sel ? document.querySelector(step.sel) : null;

  if (target){
    const r = target.getBoundingClientRect();
    const pad = 8;
    spot.classList.remove('noTarget');
    spot.style.top    = Math.max(4, r.top  - pad) + 'px';
    spot.style.left   = Math.max(4, r.left - pad) + 'px';
    spot.style.width  = Math.min(vw - 8, r.width  + pad * 2) + 'px';
    spot.style.height = Math.min(vh - 8, r.height + pad * 2) + 'px';

    /* Put the card on whichever side of the target has more room. */
    const below = vh - r.bottom, above = r.top;
    card.style.left = Math.min(Math.max(12, r.left), vw - card.offsetWidth - 12) + 'px';
    card.style.top  = (below >= above)
      ? Math.min(r.bottom + 16, vh - card.offsetHeight - 12) + 'px'
      : Math.max(12, r.top - card.offsetHeight - 16) + 'px';
  } else {
    spot.classList.add('noTarget');
    spot.style.top = '50%'; spot.style.left = '50%';
    spot.style.width = '0px'; spot.style.height = '0px';
    card.style.left = Math.max(12, (vw - card.offsetWidth) / 2) + 'px';
    card.style.top  = Math.max(12, (vh - card.offsetHeight) / 2) + 'px';
  }
}

function tourShow(){
  const { block, spot, card } = tourEls();
  const step = tourList[tourAt];
  if (!step){ tourEnd(); return; }

  const last = tourAt === tourList.length - 1;
  card.innerHTML =
    '<h3>' + step.title + '</h3><p>' + step.body + '</p>' +
    '<div class="tourFoot"><div class="tourDots">' +
      tourList.map((_, i) => '<i class="' + (i === tourAt ? 'on' : '') + '"></i>').join('') +
    '</div>' +
    (last ? '' : '<button class="tourSkip" id="tourSkip">Skip</button>') +
    '<button class="tourBtn" id="tourNext">' + (last ? 'Got it' : 'Next') + '</button></div>';

  block.classList.add('on'); spot.classList.add('on'); card.classList.add('on');

  const t = step.sel ? document.querySelector(step.sel) : null;
  if (t && t.scrollIntoView) t.scrollIntoView({ block: 'center', behavior: 'auto' });
  tourPlace(step);
  requestAnimationFrame(() => tourPlace(step));

  const next = document.getElementById('tourNext');
  if (next) next.onclick = () => { tourAt++; tourShow(); };
  const skip = document.getElementById('tourSkip');
  if (skip) skip.onclick = tourEnd;
}

function tourEnd(){
  const { block, spot, card } = tourEls();
  block.classList.remove('on'); spot.classList.remove('on'); card.classList.remove('on');
  if (tourOnResize){
    window.removeEventListener('resize', tourOnResize);
    window.removeEventListener('scroll', tourOnResize);
    tourOnResize = null;
  }
  tourMark();
}

/* force = the "Show me around again" button, which ignores the seen flag. */
function startTour(force){
  if (!force && tourSeen()) return;

  /* Wait for the board to actually contain tiles before measuring anything.
     load() is async, so on a slow device the trial can start before a single
     task has been drawn — and a step whose target does not exist yet gets
     dropped, which is how the most important step in the tour ("tap a
     picture") silently went missing the first time this was built.          */
  let tries = 0;
  (function ready(){
    if (!document.querySelector('#board .tile') && tries++ < 40){
      setTimeout(ready, 150); return;
    }
    /* Drop any step whose target is still absent rather than spotlighting nothing. */
    tourList = TOUR_STEPS.filter(s => !s.sel || document.querySelector(s.sel));
    if (!tourList.length) return;
    tourAt = 0;
    tourOnResize = () => tourPlace(tourList[tourAt]);
    window.addEventListener('resize', tourOnResize);
    window.addEventListener('scroll', tourOnResize, { passive: true });
    tourShow();
  })();
}
