import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from './calc.js';

test('remainder of the period goes to me', () => {
  const s = C.periodSplit({
    prevOdo: 1000, odo: 1200, cpm: 0.3,
    trips: [{ driverId: 'a', miles: 50 }, { driverId: 'b', miles: 30 }, { driverId: 'a', miles: 20 }],
  });
  assert.equal(s.period, 200);
  assert.deepEqual(s.drivers.a, { miles: 70, amount: 21 });
  assert.deepEqual(s.drivers.b, { miles: 30, amount: 9 });
  assert.deepEqual(s.me, { miles: 100, amount: 30 });
  assert.equal(s.over, 0);
});

test('all miles logged to drivers leaves me at zero', () => {
  const s = C.periodSplit({ prevOdo: 0, odo: 40, cpm: 0.25, trips: [{ driverId: 'a', miles: 40 }] });
  assert.equal(s.me.miles, 0);
  assert.equal(s.drivers.a.amount, 10);
});

test('over-logged miles are flagged', () => {
  const s = C.periodSplit({ prevOdo: 100, odo: 150, cpm: 0.3, trips: [{ driverId: 'a', miles: 62 }] });
  assert.equal(s.over, 12);
  assert.equal(s.me.miles, 0);
});

test('first fill with no baseline bills only logged miles', () => {
  const s = C.periodSplit({ prevOdo: null, odo: 5000, cpm: 0.3, trips: [{ driverId: 'a', miles: 10 }] });
  assert.equal(s.period, 10);
  assert.equal(s.me.miles, 0);
});

test('open trips (no miles) are ignored', () => {
  const s = C.periodSplit({ prevOdo: 0, odo: 10, cpm: 1, trips: [{ driverId: 'a', miles: null }] });
  assert.equal(s.logged, 0);
});

test('mpg learned across a partial fill', () => {
  const fills = [
    { odo: 1000, gallons: 18, full: true },
    { odo: 1100, gallons: 6, full: false },
    { odo: 1280, gallons: 14, full: true },
  ];
  const m = C.learnedMpg(fills, 14);
  assert.equal(m.learned, true);
  assert.equal(m.mpg, 280 / 20);
});

test('mpg falls back without two full fills', () => {
  assert.deepEqual(C.learnedMpg([{ odo: 1, gallons: 5, full: true }], 14), { mpg: 14, learned: false, segments: 0 });
  assert.equal(C.learnedMpg([{ odo: 1, gallons: 5, full: false }, { odo: 99, gallons: 5, full: false }], 14).learned, false);
});

test('mpg ignores absurd segments', () => {
  const fills = [{ odo: 0, gallons: 10, full: true }, { odo: 1000, gallons: 2, full: true }];
  assert.equal(C.learnedMpg(fills, 14).learned, false);
});

test('balances: billed minus paid plus pending estimate', () => {
  const state = {
    drivers: [{ id: 'a' }, { id: 'b' }],
    fills: [{ odo: 100, split: { drivers: { a: { miles: 50, amount: 15 } } } }],
    payments: [{ driverId: 'a', amount: 10 }],
    trips: [
      { driverId: 'a', miles: 50, fillId: 'f1' },
      { driverId: 'a', miles: 10 },
      { driverId: 'b', miles: null },
    ],
  };
  const b = C.balances(state, 0.3);
  assert.equal(b.a.billed, 15);
  assert.equal(b.a.paid, 10);
  assert.equal(b.a.pending, 3);
  assert.equal(b.a.owed, 8);
  assert.equal(b.b.owed, 0);
});

test('lastOdo looks at fills and trips', () => {
  assert.equal(C.lastOdo({ fills: [{ odo: 100 }], trips: [{ odoStart: 120, odoEnd: 150 }, { miles: 3 }] }), 150);
  assert.equal(C.lastOdo({ fills: [], trips: [] }), null);
});

test('sms link strips phone formatting and encodes body', () => {
  assert.equal(C.smsHref('(520) 555-0101', 'a b'), 'sms:5205550101&body=a%20b');
});
