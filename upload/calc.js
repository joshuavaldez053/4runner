// Pure math for the gas split. No DOM, no storage — tested by calc.test.js.

export const round2 = n => Math.round(n * 100) / 100;

const byOdo = fills => [...fills].sort((a, b) => a.odo - b.odo);

export const lastFill = fills => (fills.length ? byOdo(fills).at(-1) : null);

export const pricePerGallon = fill => (fill && fill.gallons > 0 ? fill.total / fill.gallons : 0);

// MPG from full-to-full segments; gallons from partial fills in between count toward the next full one.
export function learnedMpg(fills, fallback, maxSegments = 6) {
  const s = byOdo(fills);
  const segs = [];
  let lastFullIdx = -1;
  let gal = 0;
  for (let i = 0; i < s.length; i++) {
    if (lastFullIdx >= 0) gal += s[i].gallons;
    if (s[i].full) {
      if (lastFullIdx >= 0 && gal > 0) {
        const miles = s[i].odo - s[lastFullIdx].odo;
        const mpg = miles / gal;
        if (mpg >= 5 && mpg <= 40) segs.push({ miles, gal });
      }
      lastFullIdx = i;
      gal = 0;
    }
  }
  const recent = segs.slice(-maxSegments);
  const miles = recent.reduce((a, x) => a + x.miles, 0);
  const g = recent.reduce((a, x) => a + x.gal, 0);
  if (!g || miles <= 0) return { mpg: fallback, learned: false, segments: 0 };
  return { mpg: miles / g, learned: true, segments: recent.length };
}

export const costPerMile = (price, mpg) => (mpg > 0 ? price / mpg : 0);

// Split the miles driven since the previous fill between logged drivers and "me" (the remainder).
export function periodSplit({ prevOdo, odo, trips, cpm }) {
  const drivers = {};
  let logged = 0;
  for (const t of trips) {
    if (t.miles == null) continue;
    drivers[t.driverId] ??= { miles: 0, amount: 0 };
    drivers[t.driverId].miles += t.miles;
    logged += t.miles;
  }
  for (const d of Object.values(drivers)) d.amount = round2(d.miles * cpm);
  const period = prevOdo == null ? logged : Math.max(0, odo - prevOdo);
  const meMiles = Math.max(0, period - logged);
  return {
    period,
    logged,
    over: Math.max(0, logged - period),
    drivers,
    me: { miles: meMiles, amount: round2(meMiles * cpm) },
    cpm,
  };
}

// Per-driver ledger: billed at fill-ups, minus payments, plus an estimate for miles not yet billed.
export function balances(state, estCpm) {
  const out = {};
  for (const d of state.drivers) out[d.id] = { billed: 0, paid: 0, pendingMiles: 0, pending: 0, owed: 0 };
  for (const f of state.fills) {
    for (const [id, s] of Object.entries(f.split?.drivers ?? {})) if (out[id]) out[id].billed += s.amount;
  }
  for (const p of state.payments) if (out[p.driverId]) out[p.driverId].paid += p.amount;
  for (const t of state.trips) {
    if (!t.fillId && t.miles != null && out[t.driverId]) out[t.driverId].pendingMiles += t.miles;
  }
  for (const b of Object.values(out)) {
    b.billed = round2(b.billed);
    b.paid = round2(b.paid);
    b.pending = round2(b.pendingMiles * estCpm);
    b.owed = round2(b.billed - b.paid + b.pending);
  }
  return out;
}

// Highest odometer value we know about from fills and trips.
export function lastOdo(state) {
  let max = null;
  const see = v => { if (v != null && (max == null || v > max)) max = v; };
  state.fills.forEach(f => see(f.odo));
  state.trips.forEach(t => { see(t.odoStart); see(t.odoEnd); });
  return max;
}

export const requestText = amount =>
  `⛽ 4Runner gas — $${amount.toFixed(2)}\nApple Cash or Zelle me when you can 🙏`;

// iOS Messages deep link with a prefilled body.
export const smsHref = (phone, body) =>
  `sms:${(phone || '').replace(/[^\d+]/g, '')}&body=${encodeURIComponent(body)}`;
