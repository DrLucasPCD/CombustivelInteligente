import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTrip, compareFuels, effectiveConsumption, parseDecimal } from '../src/calculator.js';
import { vehicles, metadata } from '../src/vehicles.js';

const nearly = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const trip = { distance: 100, price: 6, consumption: { city: 10, highway: 20 }, cityShare: .5 };
test('mixed routes add liters for each part of the journey', () => {
  const result = calculateTrip(trip);
  nearly(result.liters, 7.5); nearly(result.cost, 45); nearly(result.kmPerLiter, 100 / 7.5);
});
test('round trip, division and monthly projection use the same total', () => {
  const result = calculateTrip({ ...trip, roundTrip: true, people: 3, trips: 22 });
  assert.equal(result.totalDistance, 200); nearly(result.cost, 90);
  nearly(result.costPerPerson, 30); nearly(result.monthlyCost, 1980);
});
test('city and highway endpoints use their respective consumption', () => {
  assert.equal(effectiveConsumption(trip.consumption, 1), 10);
  assert.equal(effectiveConsumption(trip.consumption, 0), 20);
});
test('daily return distance can differ from outbound distance and monthly liters are explicit', () => {
  const result = calculateTrip({ ...trip, distance: 20, returnDistance: 25, roundTrip: true, consumption: { city: 10, highway: 10 }, price: 6, trips: 22 });
  nearly(result.totalDistance, 45); nearly(result.monthlyDistance, 990);
  nearly(result.monthlyLiters, 99); nearly(result.monthlyCost, 594);
  assert.throws(() => calculateTrip({ ...trip, roundTrip: true, returnDistance: -1 }), RangeError);
});
test('fuel choice uses vehicle-specific ratio, including ties', () => {
  const input = { gasoline: { city: 10, highway: 10 }, ethanol: { city: 8, highway: 8 }, gasolinePrice: 6, ethanolPrice: 4.5, cityShare: .5 };
  assert.equal(compareFuels(input).winner, 'ethanol');
  nearly(compareFuels(input).ethanolBreakEvenPrice, 4.8);
  assert.equal(compareFuels({ ...input, ethanolPrice: 5 }).winner, 'gasoline');
  assert.equal(compareFuels({ ...input, ethanolPrice: 4.8 }).winner, 'tie');
});
test('Brazilian decimal input is accepted without interpreting invalid text as zero', () => {
  assert.equal(parseDecimal('6,20'), 6.2); assert.equal(parseDecimal(' 6.20 '), 6.2);
  for (const value of ['', ' ', '-1', '1.000,00', 'abc', 'Infinity', '1e3', '1,2,3']) assert.ok(Number.isNaN(parseDecimal(value)));
});
test('invalid and nonfinite values never produce estimates', () => {
  for (const distance of [0, -1, NaN, Infinity, 100001]) assert.throws(() => calculateTrip({ ...trip, distance }), RangeError);
  for (const price of [0, -1, NaN, Infinity]) assert.throws(() => calculateTrip({ ...trip, price }), RangeError);
  for (const people of [0, 1.5, NaN, 101]) assert.throws(() => calculateTrip({ ...trip, people }), RangeError);
  assert.throws(() => calculateTrip({ ...trip, trips: .5 }), RangeError);
  assert.throws(() => effectiveConsumption({ city: 0, highway: 10 }, .5), RangeError);
  assert.throws(() => effectiveConsumption(trip.consumption, 1.1), RangeError);
  assert.throws(() => calculateTrip({ ...trip, consumption: { city: Number.MIN_VALUE, highway: 10 } }), RangeError);
});
test('catalog has unique identifiers and coherent fuel/consumption data', () => {
  assert.equal(vehicles.length, metadata.vehicleCount);
  assert.equal(new Set(vehicles.map(v => v.brand)).size, metadata.brandCount);
  assert.equal(new Set(vehicles.map(v => v.id)).size, vehicles.length);
  for (const v of vehicles) {
    assert.ok(v.brand && v.model && v.version && v.engine && v.transmission);
    assert.ok(['Combustão', 'Híbrido'].includes(v.propulsion));
    assert.ok(Object.keys(v.fuels).length > 0);
    for (const [fuel, consumption] of Object.entries(v.fuels)) {
      assert.ok(['gasoline', 'ethanol', 'diesel'].includes(fuel));
      assert.ok(consumption.city > 0 && consumption.city < 60);
      assert.ok(consumption.highway > 0 && consumption.highway < 60);
    }
  }
});
test('reference records preserve verified city/highway columns from the PDF', () => {
  const mobi = vehicles.find(v => v.brand === 'Fiat' && v.model === 'MOBI' && v.version === 'TREKKING');
  assert.deepEqual(mobi.fuels, { ethanol: { city: 9.8, highway: 10.6 }, gasoline: { city: 14, highway: 15.1 } });
  const hb20 = vehicles.find(v => v.brand === 'Hyundai' && v.model === 'HB20' && v.version === 'Sense');
  assert.deepEqual(hb20.fuels.gasoline, { city: 13.3, highway: 15.4 });
});
