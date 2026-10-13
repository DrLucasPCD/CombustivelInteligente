// Plano fornecido pelo usuário. Não representa intervalos universais de fabricante.
export const serviceItems = [
  { id: 'engine-oil', name: 'Troca de óleo', group: 'Óleo e filtros', km: 10000, months: 6 },
  { id: 'fuel-filter', name: 'Filtro de combustível', group: 'Óleo e filtros', km: 10000, months: 6 },
  { id: 'oil-filter', name: 'Filtro de óleo', group: 'Óleo e filtros', km: 10000, months: 6 },
  { id: 'cabin-filter', name: 'Filtro de cabine', group: 'Óleo e filtros', km: 10000, months: 6 },
  { id: 'air-filter', name: 'Filtro de ar do motor', group: 'Óleo e filtros', km: 10000, months: 6 },
  { id: 'spark-plugs', name: 'Velas de ignição', group: 'Motor, correia e arrefecimento', km: 40000, months: 48 },
  { id: 'timing-belt', name: 'Correia dentada e tensor', group: 'Motor, correia e arrefecimento', km: 120000, months: 60, note: 'Uso severo: 60.000 km ou 3 anos no plano informado.' },
  { id: 'coolant', name: 'Troca do líquido de arrefecimento', group: 'Motor, correia e arrefecimento', km: 60000, months: null, note: 'Faixa informada: 40.000–60.000 km. Verificar em toda revisão e antecipar se houver contaminação. Ajuste o intervalo para seu carro.' },
  { id: 'brake-inspection', name: 'Inspeção de pastilhas e discos', group: 'Freios', km: 10000, months: 6, note: 'Inspecionar em toda revisão; trocar conforme desgaste e avaliação da oficina.' },
  { id: 'brake-pads', name: 'Troca de pastilhas de freio', group: 'Freios', km: null, months: null, wear: true, note: 'Troca por desgaste, sem prazo fixo. Referência urbana informada: 20.000–30.000 km; não substitui inspeção.' },
  { id: 'brake-discs', name: 'Troca de discos de freio', group: 'Freios', km: null, months: null, wear: true, note: 'Troca por condição e espessura mínima. Referência informada: 50.000–60.000 km ou cerca de duas trocas de pastilhas; não é limite obrigatório.' }
];
export const routineServiceIds = serviceItems.filter(item => item.group === 'Óleo e filtros' || item.id === 'brake-inspection').map(item => item.id);

export function intervalFor(car, item) {
  const preset = item.id === 'timing-belt' && car.usage === 'severe' ? { km: 60000, months: 36 } : { km: item.km, months: item.months };
  return car.intervals?.[item.id] || preset;
}
export function addMonths(date, months) {
  const [year, month, day] = date.split('-').map(Number);
  const result = new Date(Date.UTC(year, month - 1 + months, 1, 12));
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0, 12)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result.toISOString().slice(0, 10);
}
export function serviceSchedule(garage, carId, today) {
  const car = garage.cars.find(car => car.id === carId);
  if (!car) return [];
  const records = garage.records.filter(record => record.carId === carId).sort((a, b) => b.date.localeCompare(a.date) || b.odometer - a.odometer || b.id.localeCompare(a.id));
  return serviceItems.map(item => {
    const interval = intervalFor(car, item);
    const last = records.find(record => record.serviceItems?.includes(item.id));
    if (item.wear || (interval.km === null && interval.months === null)) return { item, interval, last, status: 'condition', nextKm: null, nextDate: '' };
    if (!last) return { item, interval, status: 'unknown', nextKm: null, nextDate: '' };
    const nextKm = interval.km === null ? null : last.odometer + interval.km;
    const nextDate = interval.months === null ? '' : addMonths(last.date, interval.months);
    const remainingKm = nextKm === null ? null : nextKm - car.odometer;
    const days = nextDate ? Math.round((Date.parse(`${nextDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000) : null;
    const due = (remainingKm !== null && remainingKm <= 0) || (days !== null && days <= 0);
    const soon = (remainingKm !== null && remainingKm <= 1000) || (days !== null && days <= 30);
    return { item, interval, last, nextKm, nextDate, remainingKm, days, status: due ? 'due' : soon ? 'soon' : 'scheduled' };
  });
}
