import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyGarage, localDate, validDate, validateGarage, validateRecord, saveRecord, mergeGarages, nextMaintenance, sortedRecords } from '../src/maintenance-model.js';

const car = () => ({ id: 'car-a', name: 'Meu Onix', odometer: 50000 });
const record = (extra = {}) => ({ id: 'service-a', carId: 'car-a', date: '2026-01-10', odometer: 45000,
  services: 'Troca de óleo e filtro', cost: 450.5, workshop: 'Minha oficina', notes: '', nextDate: '2026-12-10', nextKm: 55000, ...extra });
const garage = () => ({ ...emptyGarage(), cars: [car()], selectedCar: 'car-a' });
test('dates reject rollover dates and use the device local calendar', () => {
  assert.equal(validDate('2026-02-30'), false); assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('2026-13-01'), false); assert.equal(validDate('11/10/2026'), false);
  assert.equal(localDate(new Date(2026, 9, 11, 23, 59)), '2026-10-11');
});
test('saving a service advances the odometer and editing replaces the record', () => {
  let state = saveRecord(garage(), record({ odometer: 51000 }), '2026-10-11');
  assert.equal(state.cars[0].odometer, 51000); assert.equal(state.records.length, 1);
  state = saveRecord(state, record({ cost: 600 }), '2026-10-11');
  assert.equal(state.records.length, 1); assert.equal(state.records[0].cost, 600); assert.equal(state.cars[0].odometer, 51000);
});
test('completed services, costs, future reminders and odometers are validated', () => {
  for (const change of [{ date: '2026-02-30' }, { date: '2027-01-01' }, { services: ' ' }, { cost: NaN }, { cost: -1 }, { odometer: 1.5 }, { nextKm: 44000 }, { nextDate: '2026-01-09' }]) {
    assert.throws(() => validateRecord(record(change), '2026-10-11'));
  }
  assert.equal(validateRecord(record({ cost: 0, nextKm: null, nextDate: '' })).cost, 0);
});
test('records remain isolated for physical cars of the same model', () => {
  const state = garage(); state.cars.push({ ...car(), id: 'car-b' });
  const saved = saveRecord(state, record());
  assert.equal(sortedRecords(saved, 'car-a').length, 1); assert.equal(sortedRecords(saved, 'car-b').length, 0);
  assert.throws(() => saveRecord(saved, record({ carId: 'car-b' })));
});
test('first reached date or mileage determines reminders', () => {
  const state = saveRecord(garage(), record());
  assert.equal(nextMaintenance(state, 'car-a', '2026-10-11').status, 'scheduled');
  state.cars[0].odometer = 54500; assert.equal(nextMaintenance(state, 'car-a', '2026-10-11').status, 'soon');
  state.cars[0].odometer = 55000; assert.equal(nextMaintenance(state, 'car-a', '2026-10-11').status, 'due');
  state.cars[0].odometer = 50000; assert.equal(nextMaintenance(state, 'car-a', '2026-12-10').status, 'due');
});
test('the latest completed revision supersedes the previous general reminder', () => {
  let state = saveRecord(garage(), record({ nextDate: '2026-02-01' }));
  state = saveRecord(state, record({ id: 'service-b', date: '2026-10-01', odometer: 50000, nextDate: '2027-01-01', nextKm: 60000 }));
  assert.equal(nextMaintenance(state, 'car-a', '2026-10-11').status, 'scheduled');
  assert.equal(sortedRecords(state, 'car-a')[0].id, 'service-b');
});
test('backup merging is idempotent and preserves newer existing records', () => {
  const incoming = saveRecord(garage(), record());
  let merged = mergeGarages(emptyGarage(), incoming);
  assert.equal(merged.addedCars, 1); assert.equal(merged.addedRecords, 1);
  merged.garage.records[0].cost = 999;
  merged = mergeGarages(merged.garage, incoming);
  assert.equal(merged.addedCars, 0); assert.equal(merged.addedRecords, 0); assert.equal(merged.garage.records[0].cost, 999);
  incoming.cars[0].odometer = 60000;
  assert.equal(mergeGarages(merged.garage, incoming).garage.cars[0].odometer, 60000);
});
test('invalid backups, missing cars and duplicate IDs fail before persistence', () => {
  assert.throws(() => validateGarage({ schemaVersion: 2, cars: [], records: [] }));
  assert.throws(() => validateGarage({ ...garage(), records: [record({ carId: 'unknown' })] }));
  assert.throws(() => validateGarage({ ...garage(), records: [record(), record()] }));
  assert.throws(() => validateGarage({ ...garage(), cars: [{ ...car(), odometer: 40000 }], records: [record()] }));
  const incoming = saveRecord(garage(), record());
  assert.deepEqual(validateGarage(JSON.parse(JSON.stringify(incoming))), incoming);
});
