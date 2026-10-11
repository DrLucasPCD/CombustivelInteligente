import { parseDecimal } from './calculator.js';
import { MAINTENANCE_KEY, emptyGarage, localDate, validateCar, validateGarage,
  sortedRecords, saveRecord, mergeGarages, nextMaintenance } from './maintenance-model.js';

const $ = id => document.getElementById(id);
const money = number => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number);
const km = number => new Intl.NumberFormat('pt-BR').format(number);
const dateLabel = date => date.split('-').reverse().join('/');
let garage = emptyGarage();
let unavailable = false;
let editingCar = null;
let editingRecord = null;
let serviceCarId = '';
let pendingDeletion = null;
let carSubmitting = false;
let serviceSubmitting = false;

function node(tag, content, className = '') {
  const item = document.createElement(tag);
  if (content !== undefined) item.textContent = content;
  if (className) item.className = className;
  return item;
}
function message(content, error = false) {
  $('maintenance-status').hidden = !content;
  $('maintenance-status').textContent = content;
  $('maintenance-status').classList.toggle('is-error', error);
  $('maintenance-status').setAttribute('role', error ? 'alert' : 'status');
}
function readGarage() {
  const raw = localStorage.getItem(MAINTENANCE_KEY);
  return raw ? validateGarage(JSON.parse(raw)) : emptyGarage();
}
function load() {
  try { garage = readGarage(); unavailable = false; }
  catch {
    unavailable = true;
    message('Não foi possível ler seu histórico neste navegador. Nenhum registro será sobrescrito. Se houver dados salvos, use “Exportar backup” para recuperá-los.', true);
  }
}
async function commit(change) {
  const apply = () => {
    const current = readGarage();
    const changed = validateGarage(change(current) || current);
    try { localStorage.setItem(MAINTENANCE_KEY, JSON.stringify(changed)); }
    catch { throw new Error('Não foi possível salvar. O armazenamento pode estar cheio ou bloqueado. Seus registros anteriores foram preservados.'); }
    garage = changed;
    unavailable = false;
    render();
  };
  // Serialize read/modify/write operations between tabs when Web Locks is available.
  if (navigator.locks?.request) return navigator.locks.request(MAINTENANCE_KEY, apply);
  return apply();
}
function activeCar() { return garage.cars.find(car => car.id === garage.selectedCar); }
function showFormError(id, error) { $(id).hidden = !error; $(id).textContent = error || ''; }
function download(content, name) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = node('a'); link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function render() {
  const car = activeCar();
  $('garage-car').replaceChildren(...garage.cars.map(car => {
    const option = node('option', car.name); option.value = car.id; return option;
  }));
  if (!garage.cars.length) $('garage-car').append(node('option', 'Nenhum carro cadastrado'));
  $('garage-car').value = garage.selectedCar || '';
  $('garage-car').disabled = !car || unavailable;
  for (const id of ['add-car', 'empty-add-car', 'edit-car', 'delete-car', 'add-maintenance', 'import-maintenance']) $(id).disabled = unavailable;
  $('export-maintenance').disabled = !garage.cars.length && !unavailable;
  $('garage-empty').hidden = !!car;
  $('garage-content').hidden = !car;
  if (!car) return;
  const records = sortedRecords(garage, car.id);
  $('garage-name').textContent = car.name;
  $('garage-odometer').textContent = `Quilometragem atual: ${km(car.odometer)} km`;
  $('maintenance-total').textContent = money(records.reduce((total, record) => total + record.cost, 0));
  $('maintenance-count').textContent = `${records.length} ${records.length === 1 ? 'serviço registrado' : 'serviços registrados'}`;
  const next = nextMaintenance(garage, car.id, localDate());
  const panel = $('next-maintenance'); panel.className = `next-maintenance ${next.status}`;
  panel.replaceChildren(node('span', 'PRÓXIMA REVISÃO', 'overline'));
  if (next.status === 'unset') {
    panel.append(node('strong', 'Sem previsão cadastrada'), node('p', 'Informe a próxima data ou quilometragem ao registrar uma revisão.'));
  } else {
    const title = { due: 'A revisão atingiu o prazo informado', soon: 'A próxima revisão está chegando', scheduled: 'Sua próxima revisão está programada' }[next.status];
    const deadlines = [];
    if (next.record.nextDate) deadlines.push(`Até ${dateLabel(next.record.nextDate)}`);
    if (next.record.nextKm !== null) deadlines.push(`Ao atingir ${km(next.record.nextKm)} km`);
    const remaining = [];
    if (next.days !== null) remaining.push(next.days < 0 ? `${Math.abs(next.days)} dias após a data prevista` : next.days === 0 ? 'Data prevista para hoje' : `Faltam ${next.days} dias`);
    if (next.remainingKm !== null) remaining.push(next.remainingKm < 0 ? `${km(Math.abs(next.remainingKm))} km após a previsão` : next.remainingKm === 0 ? 'Quilometragem prevista atingida' : `Faltam ${km(next.remainingKm)} km`);
    panel.append(node('strong', title), node('p', deadlines.join(' · ')), node('small', remaining.join(' · ')), node('small', `Previsão do registro mais recente (${dateLabel(next.record.date)}). Vale o que ocorrer primeiro. Atualize a quilometragem para acompanhar.`));
  }
  const list = $('maintenance-list');
  list.replaceChildren();
  if (!records.length) list.append(node('p', 'Nenhuma revisão registrada ainda. Comece com o último serviço realizado no carro.', 'history-empty'));
  for (const record of records) {
    const article = node('article', undefined, 'service-record'); article.dataset.recordId = record.id;
    const top = node('div', undefined, 'service-record-top');
    const heading = node('h4', `${dateLabel(record.date)} · ${km(record.odometer)} km`);
    top.append(heading, node('strong', money(record.cost), 'service-record-cost'));
    article.append(top, node('p', record.services, 'service-description'));
    if (record.workshop) article.append(node('p', `Oficina: ${record.workshop}`, 'service-meta'));
    if (record.notes) article.append(node('p', record.notes, 'service-notes'));
    const actions = node('div', undefined, 'service-actions');
    for (const [action, label] of [['edit', 'Editar'], ['delete', 'Excluir']]) {
      const button = node('button', label, action === 'delete' ? 'button-text danger-text' : 'button-text');
      button.type = 'button'; button.dataset.action = action; button.disabled = unavailable;
      button.setAttribute('aria-label', `${label} revisão de ${dateLabel(record.date)}`);
      button.addEventListener('click', () => action === 'edit' ? openService(record) : confirmDeletion('record', record.id));
      actions.append(button);
    }
    article.append(actions); list.append(article);
  }
}

function openCar(car) {
  editingCar = car ? { ...car } : null;
  $('car-form').reset();
  showFormError('car-error', '');
  $('car-dialog-title').textContent = car ? 'Editar carro' : 'Cadastrar carro';
  const brand = $('brand').value;
  const model = $('model').value;
  const catalogSelected = $('catalog-mode').getAttribute('aria-pressed') === 'true';
  $('car-name').value = car?.name || (catalogSelected ? `${brand} ${model}`.trim() : '');
  $('car-odometer').value = car?.odometer ?? 0;
  $('car-dialog').showModal();
  $('car-name').focus();
}
function openService(record) {
  const car = activeCar(); if (!car) return;
  editingRecord = record ? { ...record } : null;
  serviceCarId = car.id;
  $('maintenance-form').reset(); showFormError('service-error', '');
  $('maintenance-dialog-title').textContent = record ? 'Editar revisão' : 'Registrar revisão';
  $('maintenance-dialog-car').textContent = car.name;
  $('service-date').max = localDate();
  $('service-date').value = record?.date || localDate();
  $('service-odometer').value = record?.odometer ?? car.odometer;
  $('service-description').value = record?.services || '';
  $('service-cost').value = record ? record.cost.toFixed(2).replace('.', ',') : '0,00';
  $('service-workshop').value = record?.workshop || '';
  $('service-notes').value = record?.notes || '';
  $('service-next-date').value = record?.nextDate || '';
  $('service-next-km').value = record?.nextKm ?? '';
  $('maintenance-dialog').showModal();
}
function confirmDeletion(type, id) {
  pendingDeletion = { type, id };
  const car = activeCar();
  $('maintenance-confirm-title').textContent = type === 'car' ? 'Excluir carro e histórico?' : 'Excluir esta revisão?';
  $('maintenance-confirm-description').textContent = type === 'car'
    ? `O carro “${car.name}” e todas as suas ${garage.records.filter(r => r.carId === id).length} revisões serão excluídos deste navegador. Exporte um backup se quiser guardá-los.`
    : 'Esta revisão será excluída do histórico. As demais revisões serão mantidas.';
  $('maintenance-confirm').showModal();
}

$('add-car').addEventListener('click', () => openCar());
$('empty-add-car').addEventListener('click', () => openCar());
$('edit-car').addEventListener('click', () => openCar(activeCar()));
$('delete-car').addEventListener('click', () => confirmDeletion('car', garage.selectedCar));
$('add-maintenance').addEventListener('click', () => openService());
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => $(button.dataset.closeDialog).close()));
$('garage-car').addEventListener('change', async () => {
  const selected = $('garage-car').value;
  try { await commit(current => { current.selectedCar = selected; }); message(''); }
  catch { message('Não foi possível salvar a seleção do carro neste navegador.', true); }
});
$('car-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (carSubmitting) return;
  carSubmitting = true;
  const submit = $('car-form').querySelector('[type=submit]'); submit.disabled = true;
  try {
    const car = validateCar({ id: editingCar?.id || crypto.randomUUID(), name: $('car-name').value, odometer: parseDecimal($('car-odometer').value) });
    await commit(current => {
      if (editingCar) {
        const index = current.cars.findIndex(item => item.id === car.id);
        if (index < 0 || JSON.stringify(current.cars[index]) !== JSON.stringify(editingCar)) throw new Error('Este carro foi alterado em outra aba. Reabra o cadastro antes de editar.');
        current.cars[index] = car;
      } else current.cars.push(car);
      current.selectedCar = car.id;
    });
    $('car-dialog').close(); message('Carro salvo neste navegador.');
  } catch (error) { showFormError('car-error', error.message); }
  finally { carSubmitting = false; submit.disabled = false; }
});
$('maintenance-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (serviceSubmitting) return;
  serviceSubmitting = true;
  const submit = $('maintenance-form').querySelector('[type=submit]'); submit.disabled = true;
  try {
    const record = { id: editingRecord?.id || crypto.randomUUID(), carId: serviceCarId,
      date: $('service-date').value, odometer: parseDecimal($('service-odometer').value),
      services: $('service-description').value, cost: parseDecimal($('service-cost').value),
      workshop: $('service-workshop').value, notes: $('service-notes').value,
      nextDate: $('service-next-date').value,
      nextKm: $('service-next-km').value.trim() === '' ? null : parseDecimal($('service-next-km').value) };
    await commit(current => {
      if (editingRecord && JSON.stringify(current.records.find(item => item.id === record.id)) !== JSON.stringify(editingRecord)) throw new Error('Esta revisão foi alterada em outra aba. Reabra o registro antes de editar.');
      const changed = saveRecord(current, record, localDate()); changed.selectedCar = serviceCarId; return changed;
    });
    $('maintenance-dialog').close(); message('Revisão salva neste navegador.');
  } catch (error) { showFormError('service-error', error.message); }
  finally { serviceSubmitting = false; submit.disabled = false; }
});
$('confirm-maintenance-delete').addEventListener('click', async () => {
  if (!pendingDeletion) return;
  const { type, id } = pendingDeletion;
  try {
    await commit(current => {
      if (type === 'car') { current.cars = current.cars.filter(car => car.id !== id); current.records = current.records.filter(record => record.carId !== id); }
      else current.records = current.records.filter(record => record.id !== id);
    });
    $('maintenance-confirm').close(); pendingDeletion = null; message(type === 'car' ? 'Carro e histórico excluídos.' : 'Revisão excluída.');
  } catch (error) { $('maintenance-confirm').close(); message(error.message, true); }
});
$('export-maintenance').addEventListener('click', () => {
  try {
    const current = readGarage();
    download(JSON.stringify({ ...current, exportedAt: new Date().toISOString() }, null, 2), `revisoes-carro-${localDate()}.json`);
    message('Backup exportado. Guarde o arquivo para restaurar o histórico em outro navegador.');
  } catch {
    try {
      const raw = localStorage.getItem(MAINTENANCE_KEY);
      if (!raw) throw new Error();
      download(raw, `recuperacao-revisoes-${localDate()}.json`);
      message('Arquivo original exportado para recuperação. Ele precisa ser revisado antes de uma importação.', true);
    } catch { message('Não foi possível acessar os registros para exportar o backup.', true); }
  }
});
$('import-maintenance').addEventListener('click', () => $('backup-file').click());
$('backup-file').addEventListener('change', async () => {
  const file = $('backup-file').files[0]; if (!file) return;
  try {
    if (file.size > 5000000) throw new Error('O backup deve ter no máximo 5 MB.');
    const incoming = validateGarage(JSON.parse(await file.text()), localDate());
    let added;
    await commit(current => { added = mergeGarages(current, incoming); return added.garage; });
    message(`Backup importado: ${added.addedCars} ${added.addedCars === 1 ? 'carro adicionado' : 'carros adicionados'} e ${added.addedRecords} ${added.addedRecords === 1 ? 'revisão adicionada' : 'revisões adicionadas'}. Registros já existentes foram preservados.`);
  } catch (error) { message(`Não foi possível importar. ${error instanceof SyntaxError ? 'Escolha um arquivo JSON de backup válido.' : error.message} Seu histórico atual foi preservado.`, true); }
  finally { $('backup-file').value = ''; }
});
window.addEventListener('storage', event => { if (event.key === MAINTENANCE_KEY || event.key === null) { load(); render(); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { load(); render(); } });
load(); render();
