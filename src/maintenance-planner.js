import { parseDecimal } from './calculator.js';
import { serviceItems, routineServiceIds, intervalFor, serviceSchedule } from './maintenance-schedule.js';
import { localDate, validateCar } from './maintenance-model.js';

const $ = id => document.getElementById(id);
const km = value => new Intl.NumberFormat('pt-BR').format(value);
const dateLabel = value => value.split('-').reverse().join('/');
function element(tag, content, className) {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  if (className) node.className = className;
  return node;
}
export function selectedServiceItems() {
  return [...document.querySelectorAll('[data-service-item]:checked')].map(input => input.dataset.serviceItem);
}
export function setServiceItems(ids = []) {
  document.querySelectorAll('[data-service-item]').forEach(input => { input.checked = ids.includes(input.dataset.serviceItem); });
}
function intervalLabel(interval) {
  const parts = [];
  if (interval.km !== null) parts.push(`${km(interval.km)} km`);
  if (interval.months !== null) parts.push(interval.months % 12 === 0 ? `${interval.months / 12} ${interval.months === 12 ? 'ano' : 'anos'}` : `${interval.months} meses`);
  return parts.length ? `A cada ${parts.join(' ou ')}` : 'Conforme condição / sem intervalo definido';
}
export function createPlanner({ getGarage, commit, message, openService, isUnavailable }) {
  const checklist = $('service-item-options');
  for (const group of [...new Set(serviceItems.map(item => item.group))]) {
    const fieldset = element('fieldset', undefined, 'checklist-group');
    fieldset.append(element('legend', group));
    for (const item of serviceItems.filter(item => item.group === group)) {
      const label = element('label', undefined, 'service-item-check');
      const input = element('input'); input.type = 'checkbox'; input.dataset.serviceItem = item.id;
      label.append(input, element('span', item.name)); fieldset.append(label);
    }
    checklist.append(fieldset);
  }
  $('select-routine-services').addEventListener('click', () => setServiceItems([...new Set([...selectedServiceItems(), ...routineServiceIds])]));
  const dialog = element('dialog', undefined, 'maintenance-dialog'); dialog.id = 'plan-dialog'; dialog.setAttribute('aria-labelledby', 'plan-dialog-title');
  const top = element('div', undefined, 'dialog-top');
  const title = element('h2', 'Ajustar seu plano'); title.id = 'plan-dialog-title';
  const close = element('button', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Fechar plano de manutenção'); close.addEventListener('click', () => dialog.close());
  top.append(title, close);
  dialog.append(top, element('p', 'Intervalos do plano que você informou. Ajuste de acordo com o manual e o uso do carro. Deixe um prazo vazio quando ele não se aplica.', 'field-note'));
  const form = element('form'); form.id = 'plan-form'; form.noValidate = true;
  const fields = element('div'); fields.id = 'plan-interval-fields';
  const error = element('p', undefined, 'form-error'); error.id = 'plan-error'; error.setAttribute('role', 'alert'); error.hidden = true;
  const submit = element('button', 'Salvar intervalos', 'button-primary'); submit.type = 'submit';
  form.append(fields, error, submit); dialog.append(form); document.body.append(dialog);
  let originalCar;
  $('edit-maintenance-plan').addEventListener('click', () => {
    const garage = getGarage(); originalCar = garage.cars.find(car => car.id === garage.selectedCar);
    if (!originalCar) return;
    fields.replaceChildren(); error.hidden = true;
    for (const item of serviceItems.filter(item => !item.wear)) {
      const interval = intervalFor(originalCar, item);
      const row = element('div', undefined, 'plan-edit-row'); row.append(element('h3', item.name));
      const grid = element('div', undefined, 'form-grid');
      for (const [kind, labelText] of [['km', 'Intervalo em km'], ['months', 'Intervalo em meses']]) {
        const label = element('label', labelText); const input = element('input');
        input.inputMode = 'numeric'; input.value = interval[kind] ?? ''; input.dataset.planItem = item.id; input.dataset.planKind = kind;
        label.append(input); grid.append(label);
      }
      row.append(grid); fields.append(row);
    }
    dialog.showModal();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (submit.disabled) return; submit.disabled = true;
    try {
      const intervals = {};
      for (const item of serviceItems.filter(item => !item.wear)) {
        const interval = {};
        for (const kind of ['km', 'months']) {
          const value = fields.querySelector(`[data-plan-item="${item.id}"][data-plan-kind="${kind}"]`).value;
          interval[kind] = value.trim() === '' ? null : parseDecimal(value);
        }
        const preset = intervalFor({ usage: originalCar.usage }, item);
        if (interval.km !== preset.km || interval.months !== preset.months) intervals[item.id] = interval;
      }
      const car = validateCar({ ...originalCar, intervals });
      await commit(garage => {
        const index = garage.cars.findIndex(current => current.id === car.id);
        if (index < 0 || JSON.stringify(garage.cars[index]) !== JSON.stringify(originalCar)) throw new Error('Este carro foi alterado em outra aba. Reabra o plano para editar.');
        garage.cars[index] = car;
      });
      dialog.close(); message('Intervalos salvos para este carro.');
    } catch (failure) { error.hidden = false; error.textContent = failure.message; }
    finally { submit.disabled = false; }
  });
  return { render(car) {
    $('usage-summary').textContent = car.usage === 'severe' ? 'Uso severo selecionado · correia: 60.000 km ou 3 anos, salvo ajuste manual no plano.' : 'Uso normal selecionado · correia: 120.000 km ou 5 anos, salvo ajuste manual no plano.';
    const list = $('service-plan-list'); list.replaceChildren();
    for (const planned of serviceSchedule(getGarage(), car.id, localDate())) {
      const { item, interval, last, status, nextKm, nextDate } = planned;
      const card = element('article', undefined, `service-plan-item ${status}`); card.dataset.planId = item.id;
      const heading = element('div', undefined, 'service-plan-heading');
      heading.append(element('h4', item.name), element('span', { due: 'Prazo atingido', soon: 'Em breve', scheduled: 'Programado', unknown: 'Registrar última execução', condition: 'Por desgaste' }[status], 'plan-status'));
      card.append(heading, element('p', intervalLabel(interval), 'plan-interval'));
      if (last) card.append(element('p', `Última execução: ${dateLabel(last.date)} · ${km(last.odometer)} km`, 'service-meta'));
      else card.append(element('p', 'Sem última execução associada. Registre o serviço ou marque o item ao editar uma revisão antiga.', 'service-meta'));
      if (nextKm !== null || nextDate) card.append(element('p', `Próxima: ${[nextKm !== null ? `${km(nextKm)} km` : '', nextDate ? dateLabel(nextDate) : ''].filter(Boolean).join(' ou ')}`, 'plan-deadline'));
      if (status === 'due' || status === 'soon' || status === 'scheduled') {
        const remaining = [];
        if (planned.remainingKm !== null) remaining.push(planned.remainingKm <= 0 ? 'Quilometragem atingida' : `Faltam ${km(planned.remainingKm)} km`);
        if (planned.days !== null) remaining.push(planned.days <= 0 ? 'Data atingida' : `Faltam ${planned.days} dias`);
        card.append(element('p', remaining.join(' · '), 'service-meta'));
      }
      if (item.note) card.append(element('p', item.note, 'field-note'));
      const button = element('button', item.wear ? 'Registrar troca' : 'Registrar execução', 'button-text');
      button.setAttribute('aria-label', `${item.wear ? 'Registrar troca' : 'Registrar execução'}: ${item.name}`);
      button.type = 'button'; button.disabled = isUnavailable(); button.addEventListener('click', () => openService(undefined, item.id));
      card.append(button); list.append(card);
    }
  } };
}
