export const fuelNames = { gasoline: 'Gasolina', ethanol: 'Etanol', diesel: 'Diesel' };

/** Accept decimal comma or point, without ambiguous thousands separators. */
export function parseDecimal(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const normalized = String(value).trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return NaN;
  return Number(normalized);
}

export function effectiveConsumption({ city, highway }, cityShare = 0.5) {
  if (![city, highway].every(n => Number.isFinite(n) && n > 0)) throw new RangeError('Informe um consumo maior que zero.');
  if (!Number.isFinite(cityShare) || cityShare < 0 || cityShare > 1) throw new RangeError('A proporção de cidade deve ficar entre 0 e 1.');
  // Weight liters consumed over each part of the distance, not arithmetic km/l.
  return 1 / (cityShare / city + (1 - cityShare) / highway);
}

export function calculateTrip({ distance, roundTrip = false, cityShare, consumption, price, people = 1, trips = 1 }) {
  if (!Number.isFinite(distance) || distance <= 0 || distance > 100000) throw new RangeError('Informe uma distância entre 0 e 100.000 km, maior que zero.');
  if (!Number.isFinite(price) || price <= 0 || price > 1000) throw new RangeError('Informe um preço por litro maior que zero, até R$ 1.000.');
  if (!Number.isInteger(people) || people < 1 || people > 100) throw new RangeError('Informe de 1 a 100 pessoas.');
  if (!Number.isInteger(trips) || trips < 1 || trips > 1000) throw new RangeError('Informe de 1 a 1.000 trajetos por mês.');
  const kmPerLiter = effectiveConsumption(consumption, cityShare);
  const totalDistance = distance * (roundTrip ? 2 : 1);
  const liters = totalDistance / kmPerLiter;
  const cost = liters * price;
  if (![kmPerLiter, liters, cost, cost * trips].every(n => Number.isFinite(n) && n > 0)) {
    throw new RangeError('Esses valores excedem o limite de cálculo. Revise o consumo, a distância e o preço.');
  }
  return { totalDistance, kmPerLiter, liters, cost, costPerKm: price / kmPerLiter,
    costPerPerson: cost / people, monthlyCost: cost * trips };
}

export function compareFuels({ gasoline, ethanol, gasolinePrice, ethanolPrice, cityShare }) {
  const gasKm = effectiveConsumption(gasoline, cityShare);
  const ethanolKm = effectiveConsumption(ethanol, cityShare);
  if (![gasolinePrice, ethanolPrice].every(n => Number.isFinite(n) && n > 0)) throw new RangeError('Informe os dois preços para comparar.');
  const gasCostPerKm = gasolinePrice / gasKm;
  const ethanolCostPerKm = ethanolPrice / ethanolKm;
  const tie = Math.abs(gasCostPerKm - ethanolCostPerKm) < 0.000001;
  return { winner: tie ? 'tie' : gasCostPerKm < ethanolCostPerKm ? 'gasoline' : 'ethanol',
    gasCostPerKm, ethanolCostPerKm, ethanolBreakEvenPrice: gasolinePrice * ethanolKm / gasKm,
    savingsPerKm: Math.abs(gasCostPerKm - ethanolCostPerKm) };
}
