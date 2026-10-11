export const MAINTENANCE_KEY = 'combustivel-inteligente-revisoes-v1';
export const emptyGarage = () => ({ schemaVersion: 1, cars: [], records: [], selectedCar: '' });

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function text(value, label, max, required = false) {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) throw new Error(`${label}: informe ${required ? 'um texto de 1 a' : 'até'} ${max} caracteres.`);
  return value.trim();
}
function id(value) {
  if (typeof value !== 'string' || !/^[\w-]{1,80}$/.test(value)) throw new Error('Identificador de registro inválido.');
  return value;
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) < '1900') return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function odometer(value, label = 'Quilometragem') {
  if (!Number.isInteger(value) || value < 0 || value > 10000000) throw new Error(`${label}: informe um número inteiro de 0 a 10.000.000 km.`);
  return value;
}
export function validateCar(car) {
  if (!car || typeof car !== 'object') throw new Error('Cadastro de carro inválido.');
  return { id: id(car.id), name: text(car.name, 'Nome do carro', 100, true), odometer: odometer(car.odometer) };
}
export function validateRecord(record, today) {
  if (!record || typeof record !== 'object') throw new Error('Revisão inválida.');
  if (!validDate(record.date) || (today && record.date > today)) throw new Error('Informe uma data válida de revisão, até hoje.');
  if (record.nextDate !== '' && (!validDate(record.nextDate) || record.nextDate <= record.date)) throw new Error('A próxima revisão deve ter data posterior à revisão registrada.');
  const km = odometer(record.odometer, 'Quilometragem da revisão');
  const nextKm = record.nextKm === null ? null : odometer(record.nextKm, 'Quilometragem da próxima revisão');
  if (nextKm !== null && nextKm <= km) throw new Error('A próxima revisão deve ter quilometragem maior que a revisão registrada.');
  if (!Number.isFinite(record.cost) || record.cost < 0 || record.cost > 10000000) throw new Error('Custo: informe um valor de R$ 0 a R$ 10.000.000.');
  return { id: id(record.id), carId: id(record.carId), date: record.date, odometer: km,
    services: text(record.services, 'Serviços realizados', 1500, true), cost: record.cost,
    workshop: text(record.workshop, 'Oficina', 150), notes: text(record.notes, 'Observações', 1500),
    nextDate: record.nextDate, nextKm };
}
export function validateGarage(raw, today) {
  if (!raw || raw.schemaVersion !== 1 || !Array.isArray(raw.cars) || !Array.isArray(raw.records)) throw new Error('Arquivo de revisões inválido ou de uma versão não compatível.');
  if (raw.cars.length > 100 || raw.records.length > 5000) throw new Error('Limite do histórico: 100 carros e 5.000 revisões.');
  const cars = raw.cars.map(validateCar);
  const records = raw.records.map(record => validateRecord(record, today));
  if (new Set(cars.map(car => car.id)).size !== cars.length || new Set(records.map(record => record.id)).size !== records.length) throw new Error('O arquivo contém identificadores duplicados.');
  for (const record of records) {
    const car = cars.find(car => car.id === record.carId);
    if (!car) throw new Error('Há uma revisão sem carro correspondente no arquivo.');
    if (car.odometer < record.odometer) throw new Error('A quilometragem atual do carro é menor que uma revisão registrada.');
  }
  return { schemaVersion: 1, cars, records, selectedCar: cars.some(car => car.id === raw.selectedCar) ? raw.selectedCar : (cars[0]?.id || '') };
}
export function sortedRecords(garage, carId) {
  return garage.records.filter(record => record.carId === carId).sort((a, b) => b.date.localeCompare(a.date) || b.odometer - a.odometer || b.id.localeCompare(a.id));
}
export function saveRecord(garage, rawRecord, today) {
  const record = validateRecord(rawRecord, today);
  const car = garage.cars.find(car => car.id === record.carId);
  if (!car) throw new Error('Cadastre ou selecione o carro antes de registrar a revisão.');
  const index = garage.records.findIndex(item => item.id === record.id);
  if (index >= 0 && garage.records[index].carId !== record.carId) throw new Error('Esta revisão pertence a outro carro.');
  if (index >= 0) garage.records[index] = record;
  else garage.records.push(record);
  car.odometer = Math.max(car.odometer, record.odometer);
  return validateGarage(garage);
}
export function mergeGarages(current, incoming) {
  const merged = validateGarage(current);
  const backup = validateGarage(incoming);
  const addedCars = backup.cars.filter(car => !merged.cars.some(item => item.id === car.id));
  const addedRecords = backup.records.filter(record => !merged.records.some(item => item.id === record.id));
  merged.cars.push(...addedCars);
  merged.records.push(...addedRecords);
  // Existing names and records win conflicts; new records can advance odometers.
  for (const car of merged.cars) car.odometer = Math.max(car.odometer, backup.cars.find(item => item.id === car.id)?.odometer ?? 0, ...merged.records.filter(r => r.carId === car.id).map(r => r.odometer));
  if (!merged.selectedCar) merged.selectedCar = backup.selectedCar;
  return { garage: validateGarage(merged), addedCars: addedCars.length, addedRecords: addedRecords.length };
}
export function nextMaintenance(garage, carId, today) {
  const car = garage.cars.find(car => car.id === carId);
  const record = sortedRecords(garage, carId)[0];
  if (!car || !record || (!record.nextDate && record.nextKm === null)) return { status: 'unset', record };
  const days = record.nextDate ? Math.round((Date.parse(`${record.nextDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000) : null;
  const remainingKm = record.nextKm === null ? null : record.nextKm - car.odometer;
  const due = (days !== null && days <= 0) || (remainingKm !== null && remainingKm <= 0);
  const soon = (days !== null && days <= 30) || (remainingKm !== null && remainingKm <= 1000);
  return { status: due ? 'due' : soon ? 'soon' : 'scheduled', days, remainingKm, record };
}
