import * as C from './calc.js';
import * as S from './store.js';

let st = S.load();
let sheet = null; // { name, ...sheet-local state }

const $ = s => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const initials = n => (n || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const money = n => `${n < 0 ? '−' : ''}<span class="cur">$</span>${Math.abs(n).toFixed(2)}`;
const short$ = n => `$${Math.abs(n) >= 100 ? Math.round(Math.abs(n)) : Math.abs(n).toFixed(2)}`;
const num = s => (s === '' || s == null ? null : Number(s));
const fmtMi = n => `${Math.round(n).toLocaleString()} mi`;
const day = ts => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const driver = id => st.drivers.find(d => d.id === id);
const COLORS = ['#3ec1d3', '#f6c343', '#7bd389', '#f25f5c', '#9d8df1', '#e8e8e8', '#f08bb4', '#c9a26b'];
const ME = { id: 'me', name: 'Me', color: 'var(--me)' };

const I = {
  trip: '<svg viewBox="0 0 24 24"><path d="M4 20h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h9"/><path d="M15 3l3 3-3 3"/></svg>',
  pump: '<svg viewBox="0 0 24 24"><path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M4 10h10"/><path d="M14 8l3 1.2a2 2 0 0 1 1.3 1.9V17a1.5 1.5 0 0 0 3 0V8.5L18.5 5"/></svg>',
  sliders: '<svg viewBox="0 0 24 24"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  msg: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 8l5-5 5 5M5 13v7h14v-7"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  del: '<svg viewBox="0 0 24 24"><path d="M9 6h11v12H9l-6-6z"/><path d="M13 10l4 4M17 10l-4 4"/></svg>',
  gauge: '<svg viewBox="0 0 24 24"><path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/><path d="M4 21h16"/></svg>',
  me: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  cash: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>',
  alert: '<svg viewBox="0 0 24 24"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h0"/></svg>',
  crew: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.5a6.5 6.5 0 0 1 3 5.5"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
};

/* ---------- derived numbers ---------- */

function derived() {
  const mpgInfo = C.learnedMpg(st.fills, st.settings.mpg);
  const last = C.lastFill(st.fills);
  const price = last ? C.pricePerGallon(last) : st.settings.price;
  const cpm = C.costPerMile(price, mpgInfo.mpg);
  const bal = C.balances(st, cpm);
  const odo = C.lastOdo(st);
  const unbilled = st.trips.filter(t => !t.fillId);
  const since = C.periodSplit({ prevOdo: last?.odo ?? null, odo: odo ?? 0, trips: unbilled, cpm });
  const totalOwed = C.round2(Object.values(bal).reduce((a, b) => a + Math.max(0, b.owed), 0));
  return { mpgInfo, price, cpm, bal, odo, last, since, totalOwed };
}

const openTrip = id => st.trips.find(t => t.driverId === id && t.miles == null && !t.fillId);

/* ---------- home ---------- */

function render() {
  const D = derived();
  const chips = st.drivers.map(d => {
    const b = D.bal[d.id];
    return `<button class="chip" data-act="driver" data-id="${d.id}">
      <span class="av" style="--c:${d.color}">${esc(initials(d.name))}</span>
      <span class="chip-amt ${b.owed > 0 ? '' : 'zero'}">${short$(b.owed)}</span>
      ${openTrip(d.id) ? '<span class="out">OUT</span>' : ''}
    </button>`;
  }).join('');

  const segs = [
    ...Object.entries(D.since.drivers).map(([id, s]) => ({ c: driver(id)?.color ?? '#555', mi: s.miles, name: driver(id)?.name ?? '?' })),
    { c: ME.color, mi: D.since.me.miles, name: 'Me' },
  ].filter(s => s.mi > 0);

  $('#app').innerHTML = `
    <header class="top">
      <div class="mark"><span class="stripe"></span>4RUNNER</div>
      <button class="icon-btn" data-act="settings" aria-label="Settings">${I.sliders}</button>
    </header>

    <button class="hero" data-act="stats">
      <div class="label">Owed to you</div>
      <div class="big ${D.totalOwed > 0 ? 'accent' : ''}">${money(D.totalOwed)}</div>
      <div class="sub mono">
        <span>${D.odo != null ? fmtMi(D.odo).toUpperCase() : '— MI'}</span><i>/</i>
        <span>${D.mpgInfo.mpg.toFixed(1)} MPG${D.mpgInfo.learned ? '' : '*'}</span><i>/</i>
        <span>${(D.cpm * 100).toFixed(1)}¢/MI</span>
      </div>
    </button>

    <section class="chips">
      ${chips}
      <button class="chip" data-act="stats">
        <span class="av" style="--c:var(--me)">${I.me}</span>
        <span class="chip-amt zero">${short$(D.since.me.amount)}</span>
      </button>
      <button class="chip" data-act="addDriver" aria-label="Add driver">
        <span class="av add">${I.plus}</span><span class="chip-amt zero">&nbsp;</span>
      </button>
    </section>

    <section class="card tank">
      <div class="row"><span class="label">Since last fill</span><span class="mono">${fmtMi(D.since.period)}</span></div>
      <div class="bar">${segs.map(s => `<span style="flex:${s.mi};background:${s.c}"></span>`).join('')}</div>
      <div class="legend">${segs.length ? segs.map(s => `<span><b style="background:${s.c}"></b>${esc(s.name)} ${Math.round(s.mi)}</span>`).join('') : '<span>No miles yet</span>'}</div>
      ${D.since.over ? `<div class="warn">${I.alert}+${Math.round(D.since.over)} mi over odometer</div>` : ''}
      ${!D.last && st.trips.length ? `<div class="warn">${I.pump}Log a fill-up to set the baseline</div>` : ''}
    </section>

    <div class="label section-label">Recent</div>
    ${feed(8, null, D)}

    <nav class="dock">
      <button class="dock-btn" data-act="trip">${I.trip}<span>TRIP</span></button>
      <button class="dock-btn primary" data-act="fuel">${I.pump}<span>FUEL</span></button>
    </nav>`;
}

// Combined activity list; driverId filters to one person.
function feed(limit, driverId, D) {
  const items = [];
  for (const t of st.trips) {
    if (driverId && t.driverId !== driverId) continue;
    const d = driver(t.driverId) ?? { name: '?', color: '#555' };
    const v = t.miles == null ? '<span class="v" style="color:var(--warn)">OUT</span>' : `<span class="v">${Math.round(t.miles)} mi</span>`;
    items.push({ ts: t.date, html: `<span class="dot c" style="--c:${d.color}">${esc(initials(d.name))}</span>
      <span class="t">${esc(d.name)}<small>${day(t.date)}${t.fillId ? ' · billed' : ''}</small></span>${v}
      ${t.fillId ? '' : `<button class="x" data-act="delTrip" data-id="${t.id}" aria-label="Delete">${I.x}</button>`}` });
  }
  for (const p of st.payments) {
    if (driverId && p.driverId !== driverId) continue;
    const d = driver(p.driverId) ?? { name: '?' };
    items.push({ ts: p.date, html: `<span class="dot" style="color:var(--good)">${I.check}</span>
      <span class="t">${driverId ? 'Paid' : esc(d.name)}<small>${day(p.date)}</small></span><span class="v good">+${short$(p.amount)}</span>
      <button class="x" data-act="delPay" data-id="${p.id}" aria-label="Delete">${I.x}</button>` });
  }
  if (!driverId) {
    for (const f of st.fills) {
      items.push({ ts: f.date, html: `<span class="dot">${I.pump}</span>
        <span class="t">${f.gallons.toFixed(1)} gal${f.full ? '' : ' · partial'}<small>${day(f.date)} · ${fmtMi(f.odo)}</small></span><span class="v">${short$(f.total)}</span>` });
    }
  } else {
    for (const f of st.fills) {
      const s = f.split?.drivers?.[driverId];
      if (!s) continue;
      items.push({ ts: f.date, html: `<span class="dot">${I.pump}</span>
        <span class="t">Fill-up<small>${day(f.date)} · ${Math.round(s.miles)} mi</small></span><span class="v">${short$(s.amount)}</span>` });
    }
  }
  items.sort((a, b) => b.ts - a.ts);
  if (!items.length) return `<div class="empty">NOTHING YET</div>`;
  return `<ul class="feed">${items.slice(0, limit).map(i => `<li>${i.html}</li>`).join('')}</ul>`;
}

/* ---------- sheets ---------- */

function openSheet(s) {
  sheet = s;
  renderSheet();
  $('#sheet').classList.add('open');
  $('#sheet').setAttribute('aria-hidden', 'false');
}
function closeSheet() {
  sheet = null;
  $('#sheet').classList.remove('open');
  $('#sheet').setAttribute('aria-hidden', 'true');
}
function renderSheet() {
  if (!sheet) return;
  const D = derived();
  $('#sheet .panel').innerHTML = SHEETS[sheet.name](D);
}
const head = (label, extra = '') => `<div class="sheet-head"><span class="label">${label}</span><div class="row">${extra}<button class="icon-btn" data-act="close" aria-label="Close">${I.x}</button></div></div>`;
const keypad = () => `<div class="keypad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del']
  .map(k => `<button data-act="key" data-k="${k}">${k === 'del' ? I.del : k}</button>`).join('')}</div>`;
const field = (key, label, ph = '0') => {
  const v = sheet.f[key];
  const locked = sheet.locked?.includes(key);
  return `<button class="field ${sheet.focus === key ? 'on' : ''} ${locked ? 'locked' : ''}" data-act="focus" data-f="${key}">
    <span class="label">${label}</span><span class="fval ${v === '' ? 'ph' : ''}">${v === '' ? ph : esc(v)}</span></button>`;
};
const picker = (sel, showAmt, D) => `<div class="pick">${st.drivers.map(d => `
  <button class="chip ${sel === d.id ? 'sel' : ''}" data-act="pick" data-id="${d.id}">
    <span class="av" style="--c:${d.color}">${esc(initials(d.name))}</span>
    <span class="chip-amt">${openTrip(d.id) ? 'OUT' : showAmt ? short$(D.bal[d.id].owed) : esc(d.name.split(' ')[0])}</span>
  </button>`).join('')}</div>`;

const SHEETS = {
  trip(D) {
    if (!st.drivers.length) {
      return head('Trip') + `<div class="empty">ADD A DRIVER FIRST</div><button class="go" data-act="addDriver">${I.plus}DRIVER</button>`;
    }
    const s = sheet;
    let body, miles = null;
    if (s.mode === 'mi') {
      body = `<div class="fields">${field('mi', 'Miles')}</div>`;
      miles = num(s.f.mi);
    } else {
      body = `<div class="fields">${field('start', 'Odo out', D.odo ?? '0')}${field('end', 'Odo in', '—')}</div>`;
      if (num(s.f.start) != null && num(s.f.end) != null) miles = num(s.f.end) - num(s.f.start);
    }
    const ok = s.driverId && (s.mode === 'mi' ? miles > 0 : num(s.f.start) != null && (s.f.end === '' || miles > 0));
    const startOnly = s.mode === 'odo' && s.f.end === '' && num(s.f.start) != null;
    return head('Trip') + picker(s.driverId, false, D) + `
      <div class="seg"><button class="${s.mode === 'mi' ? 'on' : ''}" data-act="mode" data-v="mi">MILES</button><button class="${s.mode === 'odo' ? 'on' : ''}" data-act="mode" data-v="odo">ODOMETER</button></div>
      ${body}
      <div class="result"><span>${miles > 0 ? fmtMi(miles) : startOnly ? 'LEAVING NOW' : '&nbsp;'}</span><b>${miles > 0 ? '≈ ' + money(miles * D.cpm) : ''}</b></div>
      ${keypad()}
      <button class="go" data-act="saveTrip" ${ok ? '' : 'disabled'}>${I.check}${startOnly ? 'CHECK OUT' : ''}</button>`;
  },

  fuel(D) {
    const s = sheet;
    const odo = num(s.f.odo), gal = num(s.f.gal), total = num(s.f.total);
    let preview = '';
    if (odo != null && gal > 0 && total > 0) {
      const p = previewFill(odo, gal, total, s.full);
      if (p.error) preview = `<div class="warn">${I.alert}${p.error}</div>`;
      else {
        const rows = Object.entries(p.split.drivers).map(([id, x]) => {
          const d = driver(id) ?? { name: '?', color: '#555' };
          return `<div class="row"><span><i class="sw" style="background:${d.color}"></i>${esc(d.name)}<small>${Math.round(x.miles)} mi</small></span><span>${money(x.amount)}</span></div>`;
        }).join('');
        const owed = Object.values(p.split.drivers).reduce((a, x) => a + x.amount, 0);
        preview = `<div class="card split">
          ${rows}
          <div class="row"><span><i class="sw" style="background:var(--me)"></i>Me<small>${Math.round(p.split.me.miles)} mi</small></span><span>${money(p.split.me.amount)}</span></div>
          <div class="row tot"><span>+ OWED</span><span>${money(owed)}</span></div>
        </div>
        <div class="result"><span>$${(total / gal).toFixed(3)}/GAL</span><span>${p.mpg.toFixed(1)} MPG${p.learned ? '' : '*'}</span></div>
        ${p.split.over ? `<div class="warn">${I.alert}+${Math.round(p.split.over)} mi logged over odometer</div>` : ''}`;
      }
    }
    const out = st.trips.filter(t => t.miles == null && !t.fillId).length;
    return head('Fill-up') + `
      <div class="fields three">${field('odo', 'Odo', D.odo ?? '0')}${field('gal', 'Gal')}${field('total', '$')}</div>
      <button class="toggle" data-act="full" style="width:100%"><span class="label">Full tank</span><span class="switch ${s.full ? 'on' : ''}"></span></button>
      ${out ? `<div class="warn" style="margin:0 0 10px">${I.alert}${out} still out — not billed</div>` : ''}
      ${preview}
      ${keypad()}
      <button class="go" data-act="saveFuel" ${preview && !preview.startsWith('<div class="warn"') ? '' : 'disabled'}>${I.check}</button>`;
  },

  driver(D) {
    const d = driver(sheet.id);
    if (!d) return head('Driver');
    const b = D.bal[d.id];
    const sub = `<div class="sub mono"><span>BILLED ${short$(b.billed)}</span><i>/</i><span>PAID ${short$(b.paid)}</span>${b.pending ? `<i>/</i><span>~${short$(b.pending)} NEW</span>` : ''}</div>`;
    let actions;
    if (sheet.view === 'request') {
      const text = C.requestText(Math.max(0, b.owed));
      actions = `<div class="btns">
        <a class="go" href="${C.smsHref(d.phone, text)}">${I.msg}TEXT</a>
        <button class="go ghost" data-act="share">${I.share}SHARE</button></div>
        ${d.phone ? '' : `<div class="result"><span>No phone saved — pick contact in Messages</span></div>`}`;
    } else if (sheet.view === 'pay') {
      actions = `<div class="fields">${field('amt', 'Paid $')}</div>${keypad()}
        <button class="go" data-act="savePay" ${num(sheet.f.amt) > 0 ? '' : 'disabled'}>${I.check}</button>`;
    } else {
      actions = `<div class="btns">
        <button class="go" data-act="view" data-v="request" ${b.owed > 0 ? '' : 'disabled'}>${I.msg}REQUEST</button>
        <button class="go ghost" data-act="view" data-v="pay">${I.cash}PAID</button></div>`;
    }
    return head(esc(d.name), `<button class="icon-btn" data-act="editDriver" data-id="${d.id}" aria-label="Edit">${I.edit}</button>`) + `
      <div class="who">
        <span class="av lg" style="--c:${d.color}">${esc(initials(d.name))}</span>
        <div class="big ${b.owed > 0 ? 'accent' : ''}">${money(b.owed)}</div>
        ${sub}
      </div>
      <div style="margin:18px 0 6px">${actions}</div>
      <div class="label section-label">History</div>
      ${feed(30, d.id, D)}`;
  },

  editDriver() {
    const d = sheet;
    return head(d.id ? 'Edit driver' : 'New driver') + `
      <label class="inp"><span class="label">Name</span><input id="dName" value="${esc(d.name)}" autocomplete="off" placeholder="Alex"></label>
      <label class="inp"><span class="label">Phone · for Apple Cash texts</span><input id="dPhone" type="tel" value="${esc(d.phone)}" placeholder="520 555 0101"></label>
      <div class="label" style="margin-bottom:10px">Color</div>
      <div class="swatches">${COLORS.map(c => `<button class="${d.color === c ? 'on' : ''}" style="--c:${c}" data-act="color" data-c="${c}"></button>`).join('')}</div>
      <button class="go" data-act="saveDriver">${I.check}</button>
      ${d.id ? `<button class="go danger" data-act="delDriver">${I.trash}REMOVE</button>` : ''}`;
  },

  stats(D) {
    const meBilled = st.fills.reduce((a, f) => a + (f.split?.me?.amount ?? 0), 0);
    const meMiles = st.fills.reduce((a, f) => a + (f.split?.me?.miles ?? 0), 0) + D.since.me.miles;
    const spent = st.fills.reduce((a, f) => a + f.total, 0);
    const received = st.payments.reduce((a, p) => a + p.amount, 0);
    const latest = D.last;
    const fills = [...st.fills].sort((a, b) => b.odo - a.odo).map(f => `<li>
      <span class="dot">${I.pump}</span>
      <span class="t">${f.gallons.toFixed(1)} gal · $${C.pricePerGallon(f).toFixed(2)}${f.full ? '' : ' · partial'}<small>${day(f.date)}</small></span>
      <span class="v">${short$(f.total)}</span>
      ${f === latest ? `<button class="x" data-act="delFill" data-id="${f.id}" aria-label="Undo">${I.x}</button>` : ''}</li>`).join('');
    return head('Me') + `
      <div class="grid2">
        <div class="stat"><div class="label">My miles</div><div class="n">${Math.round(meMiles).toLocaleString()}</div></div>
        <div class="stat"><div class="label">My gas</div><div class="n">${money(meBilled + D.since.me.amount)}</div></div>
        <div class="stat"><div class="label">Spent total</div><div class="n">${money(spent)}</div></div>
        <div class="stat"><div class="label">Paid back</div><div class="n" style="color:var(--good)">${money(received)}</div></div>
        <div class="stat"><div class="label">MPG</div><div class="n">${D.mpgInfo.mpg.toFixed(1)}<small>${D.mpgInfo.learned ? 'LEARNED' : 'DEFAULT'}</small></div></div>
        <div class="stat"><div class="label">Per mile</div><div class="n">${(D.cpm * 100).toFixed(1)}<small>¢</small></div></div>
      </div>
      <div class="label section-label">Fill-ups</div>
      ${fills ? `<ul class="feed">${fills}</ul>` : '<div class="empty">NONE YET</div>'}`;
  },

  settings() {
    const drivers = st.drivers.map(d => `<button class="list-btn" data-act="editDriver" data-id="${d.id}">
      <span class="av" style="--c:${d.color}">${esc(initials(d.name))}</span>
      <span class="t">${esc(d.name)}<small>${esc(d.phone || 'no phone')}</small></span>${I.edit}</button>`).join('');
    return head('Settings') + `
      <div class="label section-label" style="margin-top:4px">Crew</div>
      ${drivers}
      <button class="list-btn" data-act="addDriver"><span class="av add">${I.plus}</span><span class="t">Add driver</span></button>
      <div class="label section-label">Estimates</div>
      <div class="grid2" style="margin-top:10px">
        <label class="inp"><span class="label">$/gal default</span><input id="sPrice" type="number" inputmode="decimal" step="0.01" value="${st.settings.price}"></label>
        <label class="inp"><span class="label">MPG default</span><input id="sMpg" type="number" inputmode="decimal" step="0.1" value="${st.settings.mpg}"></label>
      </div>
      <div class="result" style="padding-top:0"><span>Used until real fill-ups take over</span></div>
      <div class="label section-label">Backup</div>
      <div class="btns" style="margin-top:10px">
        <button class="go ghost" data-act="export">${I.share}EXPORT</button>
        <button class="go ghost" data-act="import">${I.plus}IMPORT</button>
      </div>
      <button class="go ghost" data-act="tour">${I.gauge}HOW IT WORKS</button>`;
  },
};

// What a fill-up would do, without saving.
function previewFill(odo, gal, total, full) {
  const last = C.lastFill(st.fills);
  if (last && odo < last.odo) return { error: `Odo below last fill (${last.odo.toLocaleString()})` };
  const draft = { id: 'draft', odo, gallons: gal, total, full };
  const m = C.learnedMpg([...st.fills, draft], st.settings.mpg);
  const cpm = C.costPerMile(total / gal, m.mpg);
  const trips = st.trips.filter(t => !t.fillId && t.miles != null);
  const split = C.periodSplit({ prevOdo: last?.odo ?? null, odo, trips, cpm });
  return { split, mpg: m.mpg, learned: m.learned, cpm, trips };
}

/* ---------- actions ---------- */

function commit(msg) {
  S.save(st);
  render();
  if (sheet) renderSheet();
  if (msg) toast(msg);
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('show'), 1600);
}

function selectTripDriver(id) {
  const open = openTrip(id);
  sheet.driverId = id;
  if (open) {
    sheet.mode = 'odo';
    sheet.editing = open.id;
    sheet.f.start = String(open.odoStart);
    sheet.f.end = '';
    sheet.locked = ['start'];
    sheet.focus = 'end';
  } else if (sheet.editing) {
    sheet.editing = null;
    sheet.locked = [];
    sheet.f.start = '';
    sheet.focus = sheet.mode === 'mi' ? 'mi' : 'start';
  }
}

const ACT = {
  close: closeSheet,
  settings: () => openSheet({ name: 'settings' }),
  stats: () => openSheet({ name: 'stats' }),
  driver: el => openSheet({ name: 'driver', id: el.dataset.id, view: null, f: { amt: '' }, focus: 'amt' }),
  addDriver: () => openSheet({ name: 'editDriver', id: null, name_: '', phone: '', color: COLORS[st.drivers.length % COLORS.length] }),
  editDriver: el => {
    const d = driver(el.dataset.id);
    openSheet({ name: 'editDriver', id: d.id, phone: d.phone, color: d.color, ...{ name_: d.name } });
  },
  trip: () => {
    openSheet({ name: 'trip', driverId: null, mode: 'mi', f: { mi: '', start: '', end: '' }, focus: 'mi', locked: [] });
    if (st.drivers.length === 1) { selectTripDriver(st.drivers[0].id); renderSheet(); }
  },
  fuel: () => openSheet({ name: 'fuel', f: { odo: '', gal: '', total: '' }, focus: 'odo', full: true }),

  pick: el => { selectTripDriver(el.dataset.id); renderSheet(); },
  mode: el => {
    if (sheet.editing) return;
    sheet.mode = el.dataset.v;
    if (sheet.mode === 'odo' && sheet.f.start === '') {
      const odo = C.lastOdo(st);
      if (odo != null) sheet.f.start = String(odo);
    }
    sheet.focus = sheet.mode === 'mi' ? 'mi' : sheet.f.start === '' ? 'start' : 'end';
    renderSheet();
  },
  focus: el => {
    if (sheet.locked?.includes(el.dataset.f)) return;
    sheet.focus = el.dataset.f;
    renderSheet();
  },
  key: el => {
    const k = el.dataset.k, f = sheet.focus;
    let v = sheet.f[f];
    const intOnly = ['odo', 'start', 'end'].includes(f);
    if (k === 'del') v = v.slice(0, -1);
    else if (k === '.') { if (!intOnly && !v.includes('.')) v = (v || '0') + '.'; }
    else if (v.length < 8 && !(v.includes('.') && v.split('.')[1].length >= (f === 'gal' ? 3 : 2))) v = v === '0' ? k : v + k;
    sheet.f[f] = v;
    renderSheet();
  },
  full: () => { sheet.full = !sheet.full; renderSheet(); },
  view: el => {
    sheet.view = el.dataset.v;
    if (sheet.view === 'pay') {
      const owed = derived().bal[sheet.id].owed;
      sheet.f.amt = owed > 0 ? owed.toFixed(2) : '';
    }
    renderSheet();
  },

  saveTrip: () => {
    const s = sheet;
    const now = Date.now();
    if (s.editing) {
      const t = st.trips.find(x => x.id === s.editing);
      t.odoEnd = num(s.f.end);
      t.miles = t.odoEnd - t.odoStart;
      t.date = now;
    } else if (s.mode === 'mi') {
      st.trips.push({ id: uid(), driverId: s.driverId, miles: num(s.f.mi), date: now });
    } else {
      const start = num(s.f.start), end = num(s.f.end);
      st.trips.push({ id: uid(), driverId: s.driverId, odoStart: start, odoEnd: end, miles: end == null ? null : end - start, date: now });
    }
    const out = s.mode === 'odo' && s.f.end === '';
    closeSheet();
    commit(out ? 'CHECKED OUT' : 'TRIP LOGGED');
  },
  saveFuel: () => {
    const s = sheet;
    const p = previewFill(num(s.f.odo), num(s.f.gal), num(s.f.total), s.full);
    if (p.error) return;
    const fill = { id: uid(), odo: num(s.f.odo), gallons: num(s.f.gal), total: num(s.f.total), full: s.full, date: Date.now(), split: p.split, mpg: p.mpg };
    st.fills.push(fill);
    for (const t of p.trips) t.fillId = fill.id;
    closeSheet();
    const owed = Object.values(p.split.drivers).reduce((a, x) => a + x.amount, 0);
    commit(owed > 0 ? `+$${owed.toFixed(2)} OWED` : 'FILL LOGGED');
  },
  savePay: () => {
    st.payments.push({ id: uid(), driverId: sheet.id, amount: num(sheet.f.amt), date: Date.now() });
    sheet.view = null;
    commit('PAID ✓');
  },
  share: async () => {
    const b = derived().bal[sheet.id];
    const text = C.requestText(Math.max(0, b.owed));
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast('COPIED'); }
    } catch { /* user cancelled */ }
  },

  color: el => { sheet.color = el.dataset.c; readDriverInputs(); renderSheet(); },
  saveDriver: () => {
    readDriverInputs();
    const name = sheet.name_.trim();
    if (!name) return $('#dName').focus();
    if (sheet.id) Object.assign(driver(sheet.id), { name, phone: sheet.phone.trim(), color: sheet.color });
    else st.drivers.push({ id: uid(), name, phone: sheet.phone.trim(), color: sheet.color });
    closeSheet();
    commit('SAVED');
  },
  delDriver: () => {
    if (!confirm(`Remove ${driver(sheet.id).name}? Their history stays in fill-ups.`)) return;
    st.drivers = st.drivers.filter(d => d.id !== sheet.id);
    closeSheet();
    commit('REMOVED');
  },

  delTrip: el => {
    if (!confirm('Delete this trip?')) return;
    st.trips = st.trips.filter(t => t.id !== el.dataset.id);
    commit();
  },
  delPay: el => {
    if (!confirm('Delete this payment?')) return;
    st.payments = st.payments.filter(p => p.id !== el.dataset.id);
    commit();
  },
  delFill: el => {
    if (!confirm('Undo this fill-up? Its trips go back to unbilled.')) return;
    st.fills = st.fills.filter(f => f.id !== el.dataset.id);
    for (const t of st.trips) if (t.fillId === el.dataset.id) delete t.fillId;
    commit('UNDONE');
  },

  export: () => S.exportFile(st),
  import: () => $('#importInput').click(),
  tour: () => { closeSheet(); showOnboarding(); },
};

function readDriverInputs() {
  if ($('#dName')) sheet.name_ = $('#dName').value;
  if ($('#dPhone')) sheet.phone = $('#dPhone').value;
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el); }
});
// Let the Messages link through — it's an <a> with no data-act.

document.addEventListener('change', e => {
  if (e.target.id === 'sPrice' && Number(e.target.value) > 0) { st.settings.price = Number(e.target.value); commit(); }
  if (e.target.id === 'sMpg' && Number(e.target.value) > 0) { st.settings.mpg = Number(e.target.value); commit(); }
});

$('#importInput').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = await S.importFile(file);
    if (!confirm('Replace everything with this backup?')) return;
    st = data;
    closeSheet();
    commit('RESTORED');
  } catch (err) {
    toast('BAD FILE');
  }
});

/* ---------- onboarding ---------- */

function showOnboarding() {
  const slides = [
    [I.crew, 'ADD YOUR CREW', 'Tap ＋ and add each person who borrows the truck.'],
    [I.trip, 'LOG EVERY TRIP', 'TRIP → tap their face → type miles, or odometer out & in.'],
    [I.pump, 'FUEL SETTLES UP', 'At the pump: odometer, gallons, $. Their share is added. The rest is you.'],
    [I.msg, 'GET PAID', 'Tap their face → REQUEST → Messages opens with the amount for Apple Cash.'],
  ];
  const ob = $('#onboard');
  ob.innerHTML = `<div class="slides">${slides.map(([g, h, p], i) => `
    <div class="slide"><span class="n">0${i + 1}</span><span class="glyph">${g}</span><h2>${h}</h2><p>${p}</p></div>`).join('')}</div>
    <div class="foot"><div class="pips">${slides.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>
    <button class="go" id="obGo">NEXT</button></div>`;
  ob.hidden = false;
  const track = ob.querySelector('.slides');
  const idx = () => Math.round(track.scrollLeft / track.clientWidth);
  track.addEventListener('scroll', () => {
    ob.querySelectorAll('.pips i').forEach((p, i) => p.classList.toggle('on', i === idx()));
    $('#obGo').textContent = idx() === slides.length - 1 ? 'START' : 'NEXT';
  });
  $('#obGo').onclick = () => {
    if (idx() < slides.length - 1) track.scrollTo({ left: (idx() + 1) * track.clientWidth, behavior: 'smooth' });
    else {
      ob.hidden = true;
      st.onboarded = true;
      S.save(st);
      if (!st.drivers.length) ACT.addDriver();
    }
  };
}

render();
if (!st.onboarded) showOnboarding();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
