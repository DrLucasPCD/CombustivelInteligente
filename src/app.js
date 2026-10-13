import { vehicles, metadata } from './vehicles.js';
import { calculateTrip, compareFuels, parseDecimal, fuelNames } from './calculator.js';
import './maintenance.js';

const $ = id => document.getElementById(id);
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const decimal = (value, places = 1) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: places, maximumFractionDigits: places }).format(value);
const distanceLabel = value => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
const STORAGE_KEY = 'combustivel-inteligente-v1';
const inputIds = ['distance', 'return-distance', 'manual-city', 'manual-highway', 'gasoline-price', 'ethanol-price', 'diesel-price', 'people', 'trips', 'city-share'];
let returnEdited = false;
let mode = 'catalog';
let route = 'mixed';
let fuel = 'gasoline';
let lastResult = null;
let installPrompt = null;
let timer;

const defaultVehicle = vehicles.find(v => v.brand === 'Chevrolet' && v.model === 'ONIX' && v.version === 'MT' && v.engine === '1.0 - 12 V') || vehicles[0];
const sorted = items => [...new Set(items)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
function fillSelect(select, entries, selected) {
  select.replaceChildren(...entries.map(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  }));
  if (entries.some(([value]) => value === selected)) select.value = selected;
}
function chooseBrand(brand, model, id) {
  fillSelect($('brand'), sorted(vehicles.map(v => v.brand)).map(b => [b, b]), brand);
  chooseModel(model, id);
}
function chooseModel(model, id) {
  fillSelect($('model'), sorted(vehicles.filter(v => v.brand === $('brand').value).map(v => v.model)).map(m => [m, m]), model);
  chooseVersion(id);
}
function chooseVersion(id) {
  const versions = vehicles.filter(v => v.brand === $('brand').value && v.model === $('model').value);
  fillSelect($('version'), versions.map(v => [v.id, `${v.version} · ${v.engine} · ${v.transmission}${v.propulsion === 'Híbrido' ? ' · Híbrido' : ''}${Object.keys(v.fuels).length === 1 ? ` · ${fuelNames[Object.keys(v.fuels)[0]]}` : ''}`]), id);
  syncFuelOptions();
}
const currentVehicle = () => vehicles.find(v => v.id === $('version').value);
const cityShare = () => route === 'city' ? 1 : route === 'highway' ? 0 : Number($('city-share').value) / 100;
const currentConsumption = () => mode === 'catalog' ? currentVehicle().fuels[fuel] : {
  city: parseDecimal($('manual-city').value), highway: parseDecimal($('manual-highway').value)
};

function syncFuelOptions() {
  const fuels = mode === 'catalog' ? Object.keys(currentVehicle().fuels).sort((a, b) => ['gasoline', 'ethanol', 'diesel'].indexOf(a) - ['gasoline', 'ethanol', 'diesel'].indexOf(b)) : Object.keys(fuelNames);
  if (!fuels.includes(fuel)) fuel = fuels[0];
  $('fuel-options').replaceChildren(...fuels.map(key => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = fuelNames[key];
    button.setAttribute('aria-pressed', String(key === fuel));
    button.addEventListener('click', () => { fuel = key; syncFuelOptions(); render(); });
    return button;
  }));
  for (const key of Object.keys(fuelNames)) $(key + '-price-label').hidden = !fuels.includes(key) || (mode === 'manual' && key !== fuel);
  $('comparison-card').hidden = mode !== 'catalog' || !currentVehicle().fuels.gasoline || !currentVehicle().fuels.ethanol;
  if (mode === 'catalog') {
    const consumption = currentVehicle().fuels[fuel];
    $('vehicle-consumption').textContent = `${fuelNames[fuel]} · Cidade ${decimal(consumption.city)} km/l · Estrada ${decimal(consumption.highway)} km/l`;
    $('vehicle-source').textContent = `Consumo de referência · Inmetro / PBE ${metadata.cycle} · Página ${currentVehicle().sourcePage}`;
  }
}
function setMode(next) {
  mode = next;
  $('catalog-mode').setAttribute('aria-pressed', String(mode === 'catalog'));
  $('manual-mode').setAttribute('aria-pressed', String(mode === 'manual'));
  $('catalog-fields').hidden = mode !== 'catalog';
  $('manual-fields').hidden = mode !== 'manual';
  syncFuelOptions();
}
function setRoute(next) {
  route = next;
  document.querySelectorAll('[data-route]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.route === route)));
  $('mix-fields').hidden = route !== 'mixed';
}
function persist() {
  const settings = { mode, route, fuel, vehicle: $('version').value, roundTrip: $('round-trip').checked, returnEdited,
    inputs: Object.fromEntries(inputIds.map(id => [id, $(id).value])) };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* Private browsing or storage unavailable. */ }
}
function restore() {
  try {
    const settings = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!settings || typeof settings !== 'object') return;
    const vehicle = vehicles.find(v => v.id === settings.vehicle);
    if (vehicle) chooseBrand(vehicle.brand, vehicle.model, vehicle.id);
    for (const id of inputIds) if (typeof settings.inputs?.[id] === 'string' && settings.inputs[id].length < 24) $(id).value = settings.inputs[id];
    $('round-trip').checked = settings.roundTrip === true;
    returnEdited = settings.returnEdited === true;
    if (!settings.inputs?.['return-distance']) $('return-distance').value = $('distance').value;
    if (Object.hasOwn(fuelNames, settings.fuel)) fuel = settings.fuel;
    setMode(settings.mode === 'manual' ? 'manual' : 'catalog');
    setRoute(['city', 'mixed', 'highway'].includes(settings.route) ? settings.route : 'mixed');
  } catch { /* Ignore an old or malformed local preference. */ }
}

function readTrip() {
  const fields = [{ id: 'distance', label: 'Quilômetros de ida por dia', max: 100000 },
    { id: `${fuel}-price`, label: 'Preço do combustível', max: 1000 },
    { id: 'people', label: 'Pessoas para dividir', max: 100, integer: true },
    { id: 'trips', label: 'Dias de uso por mês', max: 31, integer: true }];
  if ($('round-trip').checked) fields.push({ id: 'return-distance', label: 'Quilômetros de volta por dia', max: 100000, zero: true });
  if (mode === 'manual') fields.push({ id: 'manual-city', label: 'Consumo na cidade', max: 1000 }, { id: 'manual-highway', label: 'Consumo na estrada', max: 1000 });
  for (const id of inputIds) { $(id).removeAttribute('aria-invalid'); $(id).removeAttribute('aria-describedby'); }
  for (const field of fields) {
    const value = parseDecimal($(field.id).value);
    if (!Number.isFinite(value) || value < 0 || (!field.zero && value === 0) || value > field.max || (field.integer && !Number.isInteger(value))) {
      $(field.id).setAttribute('aria-invalid', 'true');
      $(field.id).setAttribute('aria-describedby', 'form-error');
      return { error: `${field.label}: informe ${field.integer ? 'um número inteiro' : 'um valor'} ${field.zero ? 'de zero' : 'maior que zero'}, até ${decimal(field.max, 0)}. Use vírgula ou ponto para decimais, sem separador de milhar.`, field: field.id };
    }
  }
  return { input: { distance: parseDecimal($('distance').value), roundTrip: $('round-trip').checked,
    returnDistance: parseDecimal($('return-distance').value),
    price: parseDecimal($(`${fuel}-price`).value), people: parseDecimal($('people').value),
    trips: parseDecimal($('trips').value), cityShare: cityShare(), consumption: currentConsumption() } };
}
function clearResult(message) {
  lastResult = null;
  for (const id of ['total-cost', 'liters', 'fuel-price-value', 'cost-per-km', 'effective-consumption', 'per-person', 'monthly-cost', 'daily-km', 'monthly-km', 'monthly-liters']) $(id).textContent = '—';
  $('daily-distance-note').textContent = 'Informe os quilômetros de ida e volta para calcular o total diário.';
  $('result-route').textContent = message;
  $('monthly-caption').textContent = 'Projeção mensal de combustível';
  $('copy-result').disabled = true;
  $('comparison-content').replaceChildren(Object.assign(document.createElement('p'), { className: 'compare-limit', textContent: 'Complete os campos para comparar os combustíveis.' }));
}
function renderComparison(result) {
  if ($('comparison-card').hidden) return;
  const gasolinePrice = parseDecimal($('gasoline-price').value);
  const ethanolPrice = parseDecimal($('ethanol-price').value);
  if (![gasolinePrice, ethanolPrice].every(n => Number.isFinite(n) && n > 0 && n <= 1000)) {
    $('comparison-content').replaceChildren(Object.assign(document.createElement('p'), { className: 'compare-limit', textContent: 'Informe preços válidos de gasolina e etanol para ver qual compensa.' }));
    return;
  }
  const comparison = compareFuels({ ...currentVehicle().fuels, gasolinePrice, ethanolPrice, cityShare: cityShare() });
  const container = $('comparison-content');
  // Only trusted labels and Intl-formatted numeric results appear in this markup.
  container.innerHTML = `<p class="comparison-verdict">${comparison.winner === 'tie' ? '<strong>Os dois combustíveis estão empatados.</strong>' : `<strong>${fuelNames[comparison.winner]} compensa neste trajeto.</strong><br>Economia de ${money(comparison.savingsPerKm * result.totalDistance)} em ${decimal(result.totalDistance, 0)} km.`}</p>
    <div class="compare-prices"><div class="compare-item ${comparison.winner === 'gasoline' ? 'winner' : ''}"><span>Gasolina</span><strong>${money(comparison.gasCostPerKm)} <small>/ km</small></strong></div><div class="compare-item ${comparison.winner === 'ethanol' ? 'winner' : ''}"><span>Etanol</span><strong>${money(comparison.ethanolCostPerKm)} <small>/ km</small></strong></div></div>
    <p class="compare-limit">Com a gasolina a ${money(gasolinePrice)}, o etanol compensa abaixo de ${money(comparison.ethanolBreakEvenPrice)}/l. Calculado pelo consumo desta versão.</p>`;
}
function render({ save = true } = {}) {
  clearTimeout(timer);
  $('return-distance').disabled = !$('round-trip').checked;
  $('city-share-label').textContent = `${$('city-share').value}% cidade · ${100 - Number($('city-share').value)}% estrada`;
  $('city-share').setAttribute('aria-valuetext', $('city-share-label').textContent);
  $('copy-status').textContent = '';
  const trip = readTrip();
  $('form-error').hidden = !trip.error;
  $('form-error').textContent = trip.error || '';
  if (trip.error) {
    clearResult('Complete os campos destacados para atualizar a estimativa.');
    if (save) persist();
    return trip;
  }
  try {
    const result = calculateTrip(trip.input);
    const vehicleLabel = mode === 'catalog' ? `${currentVehicle().brand} ${currentVehicle().model} · ${currentVehicle().version}` : 'Consumo informado por você';
    const routeLabel = route === 'city' ? 'cidade' : route === 'highway' ? 'estrada' : 'trajeto misto';
    $('total-cost').textContent = money(result.cost);
    $('result-route').textContent = `${distanceLabel(result.totalDistance)} km · ${trip.input.roundTrip ? 'ida e volta' : 'somente ida'} · ${routeLabel} · ${fuelNames[fuel]}\n${vehicleLabel}`;
    $('liters').textContent = `${decimal(result.liters, 2)} litros`;
    $('fuel-price-value').textContent = `${money(trip.input.price)} / litro`;
    $('cost-per-km').textContent = `${money(result.costPerKm)} / km`;
    $('effective-consumption').textContent = `${decimal(result.kmPerLiter, 2)} km/l`;
    $('per-person').textContent = money(result.costPerPerson);
    $('monthly-cost').textContent = money(result.monthlyCost);
    $('monthly-caption').textContent = `${trip.input.trips} ${trip.input.trips === 1 ? 'dia de uso' : 'dias de uso'} por mês · apenas combustível`;
    $('daily-km').textContent = `${distanceLabel(result.totalDistance)} km`;
    $('monthly-km').textContent = `${distanceLabel(result.monthlyDistance)} km`;
    $('monthly-liters').textContent = `${decimal(result.monthlyLiters, 2)} litros`;
    $('daily-distance-note').textContent = `Total por dia: ${distanceLabel(result.totalDistance)} km (${distanceLabel(trip.input.distance)} km de ida + ${distanceLabel(trip.input.roundTrip ? trip.input.returnDistance : 0)} km de volta).`;
    $('copy-result').disabled = false;
    lastResult = `Combustível Inteligente\n${vehicleLabel}\n${$('result-route').textContent}\nCusto por dia: ${money(result.cost)}\nConsumo: ${decimal(result.kmPerLiter, 2)} km/l\nCombustível por dia: ${decimal(result.liters, 2)} l\nPor pessoa (${trip.input.people}): ${money(result.costPerPerson)}\nPor mês (${trip.input.trips} dias): ${distanceLabel(result.monthlyDistance)} km · ${decimal(result.monthlyLiters, 2)} litros · ${money(result.monthlyCost)}\nEstimativa com ${fuelNames[fuel]} a ${money(trip.input.price)}/l. Pedágios e outros gastos não incluídos.`;
    renderComparison(result);
    if (save) persist();
    return trip;
  } catch (error) {
    $('form-error').hidden = false;
    $('form-error').textContent = error.message;
    clearResult('Revise os campos para atualizar a estimativa.');
    return { error: error.message };
  }
}

$('brand').addEventListener('change', () => { chooseModel(); render(); });
$('model').addEventListener('change', () => { chooseVersion(); render(); });
$('version').addEventListener('change', () => { syncFuelOptions(); render(); });
$('catalog-mode').addEventListener('click', () => { setMode('catalog'); render(); });
$('manual-mode').addEventListener('click', () => { setMode('manual'); render(); });
document.querySelectorAll('[data-route]').forEach(button => button.addEventListener('click', () => { setRoute(button.dataset.route); render(); }));
for (const id of inputIds) $(id).addEventListener('input', () => {
  if (id === 'return-distance') returnEdited = true;
  if (id === 'distance' && !returnEdited) $('return-distance').value = $('distance').value;
  clearTimeout(timer); timer = setTimeout(render, 150);
});
$('round-trip').addEventListener('change', () => render());
$('trip-form').addEventListener('submit', event => {
  event.preventDefault();
  const trip = render();
  if (trip.error) { if (trip.field) $(trip.field).focus(); return; }
  if (matchMedia('(max-width: 700px)').matches) $('resultado').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
});
$('reset-example').addEventListener('click', () => {
  $('trip-form').reset();
  returnEdited = false;
  fuel = 'gasoline';
  chooseBrand(defaultVehicle.brand, defaultVehicle.model, defaultVehicle.id);
  setMode('catalog'); setRoute('mixed'); render();
});
$('copy-result').addEventListener('click', async () => {
  if (!lastResult) return;
  try {
    await navigator.clipboard.writeText(lastResult);
    $('copy-status').textContent = 'Copiado!';
  } catch {
    // Accessible fallback when the clipboard API is unavailable or denied.
    const dialog = document.createElement('dialog');
    const label = document.createElement('label'); label.textContent = 'Selecione e copie seu resultado';
    const textarea = document.createElement('textarea'); textarea.value = lastResult; textarea.readOnly = true;
    textarea.style.cssText = 'width:100%;min-height:240px;margin:14px 0'; label.append(textarea);
    const close = document.createElement('button'); close.textContent = 'Fechar'; close.className = 'button-primary';
    close.addEventListener('click', () => { dialog.close(); dialog.remove(); });
    dialog.append(label, close); document.body.append(dialog); dialog.showModal(); textarea.select();
    dialog.addEventListener('close', () => dialog.remove());
  }
});

window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });
$('install').addEventListener('click', async () => {
  if (installPrompt) { await installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; }
  else $('install-dialog').showModal();
});
for (const id of ['close-install', 'install-confirm']) $(id).addEventListener('click', () => $('install-dialog').close());
window.addEventListener('appinstalled', () => { $('install').hidden = true; installPrompt = null; });
if (matchMedia('(display-mode: standalone)').matches) $('install').hidden = true;

chooseBrand(defaultVehicle.brand, defaultVehicle.model, defaultVehicle.id);
restore();
syncFuelOptions();
$('source-summary').textContent = `${metadata.brandCount} marcas e ${metadata.vehicleCount} versões com consumo disponível na base importada. Fonte: ${metadata.name}, ciclo ${metadata.cycle}. Atualização indicada no PDF: 14/08/2026. Base consultada em 11/10/2026. Os dados ficam no app; os campos e a última seleção são salvos somente neste navegador.`;
$('source-link').href = metadata.url;
render({ save: false });
if ('serviceWorker' in navigator && window.isSecureContext) window.addEventListener('load', () => {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* Calculator continues online when offline caching is unavailable. */ });
});
