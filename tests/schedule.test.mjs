import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceItems, intervalFor, addMonths, serviceSchedule } from '../src/maintenance-schedule.js';
import { emptyGarage, saveRecord, validateGarage } from '../src/maintenance-model.js';

const car = { id: 'a', name: 'Meu carro', odometer: 29000, usage: 'normal', intervals: {} };
const garage = () => ({ ...emptyGarage(), cars: [{ ...car, intervals: {} }], selectedCar: 'a' });
const record = overrides => ({ id: 'oil', carId: 'a', date: '2026-01-31', odometer: 20000, services: 'Óleo', cost: 100, workshop: '', notes: '', nextDate: '', nextKm: null, serviceItems: ['engine-oil'], ...overrides });
test('six calendar months clamp month-end and respect leap years', () => {
  assert.equal(addMonths('2026-01-31', 6), '2026-07-31');
  assert.equal(addMonths('2026-08-31', 6), '2027-02-28');
  assert.equal(addMonths('2023-08-31', 6), '2024-02-29');
});
test('the user plan has five oil/filter items with 10,000 km or six months', () => {
  for (const item of serviceItems.filter(item => item.group === 'Óleo e filtros')) assert.deepEqual(intervalFor(car, item), { km: 10000, months: 6 });
  assert.deepEqual(intervalFor(car, serviceItems.find(item => item.id === 'spark-plugs')), { km: 40000, months: 48 });
});
test('severe use changes the belt while explicit overrides are preserved', () => {
  const belt = serviceItems.find(item => item.id === 'timing-belt');
  assert.deepEqual(intervalFor(car, belt), { km: 120000, months: 60 });
  assert.deepEqual(intervalFor({ ...car, usage: 'severe' }, belt), { km: 60000, months: 36 });
  assert.deepEqual(intervalFor({ ...car, usage: 'severe', intervals: { 'timing-belt': { km: 50000, months: 24 } } }, belt), { km: 50000, months: 24 });
});
test('each service uses its own history and the first reached deadline', () => {
  let state = saveRecord(garage(), record());
  state = saveRecord(state, record({ id: 'plugs', date: '2026-04-01', odometer: 25000, serviceItems: ['spark-plugs'], services: 'Velas' }));
  let oil = serviceSchedule(state, 'a', '2026-04-01').find(row => row.item.id === 'engine-oil');
  assert.equal(oil.nextKm, 30000); assert.equal(oil.nextDate, '2026-07-31'); assert.equal(oil.status, 'soon');
  assert.equal(serviceSchedule(state, 'a', '2026-08-01').find(row => row.item.id === 'engine-oil').status, 'due');
  state.cars[0].odometer = 30000;
  assert.equal(serviceSchedule(state, 'a', '2026-04-01').find(row => row.item.id === 'engine-oil').status, 'due');
  assert.equal(serviceSchedule(state, 'a', '2026-04-01').find(row => row.item.id === 'spark-plugs').nextKm, 65000);
});
test('missing histories do not invent replacement dates; brake wear has no fixed due date', () => {
  const rows = serviceSchedule(garage(), 'a', '2026-10-13');
  assert.equal(rows.find(row => row.item.id === 'oil-filter').status, 'unknown');
  for (const id of ['brake-pads', 'brake-discs']) {
    assert.equal(rows.find(row => row.item.id === id).status, 'condition');
    assert.equal(rows.find(row => row.item.id === id).nextKm, null);
  }
});
test('old garage backups migrate without inferring completed service items', () => {
  const legacy = { schemaVersion: 1, selectedCar: 'a', cars: [{ id: 'a', name: 'Carro antigo', odometer: 29000 }], records: [record({ serviceItems: undefined })] };
  const updated = validateGarage(legacy);
  assert.equal(updated.schemaVersion, 2); assert.equal(updated.cars[0].usage, 'normal');
  assert.deepEqual(updated.records[0].serviceItems, []); assert.equal(updated.records[0].services, 'Óleo');
  assert.throws(() => validateGarage({ ...updated, records: [record({ serviceItems: ['unknown'] })] }));
  assert.throws(() => validateGarage({ ...updated, cars: [{ ...car, intervals: { 'engine-oil': { km: -1, months: 6 } } }] }));
});
