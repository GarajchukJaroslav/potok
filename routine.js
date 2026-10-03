/* ==================================================================
   ЭКРАН «РУТИНА / ЗОЖ» (привычки) + МОДАЛКА ИСТОРИИ + режим СТАРТ
================================================================== */

let habitDraft = { target: 1, period: 'day' };

/* ============ ПРИВЫЧКИ ============ */
function addHabit(){
  if(!canPlan()){ blockedAfterStart(); return; }
  const inp = document.getElementById('habitInput');
  const v = inp.value.trim();
  if(!v) return;
  habits.push({
    id: uid(),
    name: v,
    target: habitDraft.target,
    period: habitDraft.period,
    createdAt: todayStr(),
    log: {},
    slots: {}
  });
  inp.value = '';
  store.set('habits', habits);
  renderHabits();
  inp.focus();
}

function clickHabit(id){
  if(!canExecute()){ blockedBeforeStart(); return; }
  const h = habits.find(x => x.id === id);
  if(!h) return;
  const t = todayStr();

  if(h.period === 'day' && h.target > 1){
    const slots = ensureSlots(h, t);
    const firstFalse = slots.indexOf(false);
    if(firstFalse === -1){
      slots.fill(false);
    } else {
      slots[firstFalse] = true;
    }
    syncLogFromSlots(h, t);
    store.set('habits', habits);
    renderHabits();
    return;
  }

  const cur = h.log[t] || 0;
  if(h.target === 1 && h.period === 'day'){
    h.log[t] = cur >= 1 ? 0 : 1;
  } else {
    if(cur >= h.target) h.log[t] = 0;
    else h.log[t] = cur + 1;
  }
  store.set('habits', habits);
  renderHabits();
}

function decHabit(id){
  if(!canExecute()){ blockedBeforeStart(); return; }
  const h = habits.find(x => x.id === id);
  if(!h) return;
  const t = todayStr();

  if(h.period === 'day' && h.target > 1){
    const slots = ensureSlots(h, t);
    let lastTrue = -1;
    for(let i = slots.length - 1; i >= 0; i--){
      if(slots[i]){ lastTrue = i; break; }
    }
    if(lastTrue === -1) return;
    slots[lastTrue] = false;
    syncLogFromSlots(h, t);
    store.set('habits', habits);
    renderHabits();
    return;
  }

  const cur = h.log[t] || 0;
  if(cur <= 0) return;
  h.log[t] = cur - 1;
  store.set('habits', habits);
  renderHabits();
}

function delHabit(id){
  if(!canPlan()){ blockedAfterStart(); return; }
  if(!confirm('Удалить привычку и всю её историю?')) return;
  habits = habits.filter(x => x.id !== id);
  store.set('habits', habits);
  renderHabits();
}

function habitProgress(h){
  if(h.period === 'day'){
    return { current: h.log[todayStr()] || 0, target: h.target };
  }
  const week = getWeekDays();
  const sum = week.reduce((s,d) => s + (h.log[d] || 0), 0);
  return { current: sum, target: h.target };
}

function habitStreak(h){
  if(h.period !== 'day') return 0;
  let streak = 0;
  const d = new Date();
  if((h.log[dayStr(d)] || 0) < h.target) d.setDate(d.getDate() - 1);
  let guard = 0;
  while(guard++ < 2000){
    const key = dayStr(d);
    if((h.log[key] || 0) >= h.target){ streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

function weekSum(h, anyDate){
  const weekDays = getWeekDaysFrom(anyDate);
  return weekDays.reduce((s,k) => s + ((h.log||{})[k] || 0), 0);
}

function isWeekClosed(h, anyDate){
  if(h.period !== 'week') return false;
  return weekSum(h, anyDate) >= h.target;
}

function weekStreak(h){
  if(h.period !== 'week' || !h.log) return 0;
  let streak = 0;
  const now = new Date();
  const startMonday = getWeekDaysFrom(now)[0];
  let cursor = new Date(startMonday + 'T12:00:00');
  if(!isWeekClosed(h, now)) cursor.setDate(cursor.getDate() - 7);
  let guard = 0;
  while(guard++ < 500){
    const weekKeys = getWeekDaysFrom(cursor);
    const sum = weekKeys.reduce((s,k) => s + ((h.log||{})[k] || 0), 0);
    if(sum >= h.target){ streak++; cursor.setDate(cursor.getDate() - 7); }
    else break;
  }
  return streak;
}

function renderMiniCal(h){
  const today = new Date();
  today.setHours(0,0,0,0);
  const todayWd = (today.getDay() + 6) % 7;
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - (21 + todayWd));
  let html = '';
  for(let i = 0; i < 28; i++){
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const key = dayStr(d);
    const isFuture = d > today;
    const val = (h.log || {})[key] || 0;
    let cls = 'mc';
    if(isFuture) cls += ' future';
    else if(h.period === 'week'){ if(val > 0) cls += ' partial'; }
    else {
      if(val >= h.target) cls += ' done';
      else if(val > 0) cls += ' partial';
    }
    html += `<div class="${cls}"></div>`;
  }
  return html;
}

function renderHabits(){
  const list = document.getElementById('habitList');
  if(!list) return;
  list.innerHTML = '';
  const locked = isStarted();

  if(habits.length === 0){
    list.innerHTML = '<div class="empty"><span class="empty-icon">🌱</span>Пока пусто.<br>Добавь первую привычку и выбери периодичность.</div>';
  }
  habits.forEach(h => {
    const p = habitProgress(h);
    const done = p.current >= p.target;
    const streak = habitStreak(h);
    const isSingle = (h.target === 1 && h.period === 'day');
    const isWeek = (h.period === 'week');

    const el = document.createElement('div');
    el.className = 'habit' + (done ? ' done' : '');

    const checkClass = isSingle ? 'habit-check single' : 'habit-check counter';
    const checkContent = isSingle ? '' : `${p.current}/${p.target}`;

    let metaBadges = '';
    if(streak > 0) metaBadges += `<span class="streak-mini">🔥 ${streak}</span>`;
    if(isWeek){
      const ws = weekStreak(h);
      if(ws > 0) metaBadges += `<span class="week-mini ok">🔥 ${ws} ${plural(ws,'неделя','недели','недель')} подряд</span>`;
      else metaBadges += `<span class="week-mini zero">📅 0 недель подряд</span>`;
    }

    const decBtn = (!isSingle && !locked)
      ? `<button class="icon-btn" onclick="decHabit('${h.id}')" title="минус">−</button>`
      : '';
    const delBtn = locked
      ? ''
      : `<button class="icon-btn danger" onclick="delHabit('${h.id}')" title="удалить">✕</button>`;

    el.innerHTML = `
      <button class="${checkClass}${done ? ' done' : ''}" onclick="clickHabit('${h.id}')">${checkContent}</button>
      <div class="habit-info">
        <div class="habit-name">${escapeHtml(h.name)}</div>
        <div class="habit-meta">
          <span>${fmtFreq(h.target, h.period)}</span>
          ${metaBadges}
        </div>
      </div>
      <div class="mini-cal" onclick="openHabitModal('${h.id}')" title="Открыть историю">${renderMiniCal(h)}</div>
      <div class="habit-actions">
        ${decBtn}
        ${delBtn}
      </div>`;
    list.appendChild(el);
  });

  const total = habits.length;
  const doneCount = habits.filter(h => {
    const p = habitProgress(h);
    return p.current >= p.target;
  }).length;
  const sub = document.getElementById('habitSub');
  if(sub) sub.textContent = total === 0 ? '' : `выполнено ${doneCount} из ${total}`;

  // Прячем инпут и пресеты после старта
  const inpRow = document.querySelector('#habitInput')?.closest('.input-row');
  const presetsEl = document.getElementById('presets');
  if(inpRow) inpRow.style.display = locked ? 'none' : 'flex';
  if(presetsEl) presetsEl.style.display = locked ? 'none' : 'flex';
}

/* ---------- СЛОТЫ ---------- */
function ensureSlots(h, date){
  if(!h.slots) h.slots = {};
  if(!h.slots[date]){
    h.slots[date] = new Array(h.target).fill(false);
  }
  while(h.slots[date].length < h.target) h.slots[date].push(false);
  if(h.slots[date].length > h.target) h.slots[date].length = h.target;
  return h.slots[date];
}

function syncLogFromSlots(h, date){
  const slots = h.slots[date] || [];
  const n = slots.filter(Boolean).length;
  if(n === 0) delete h.log[date];
  else h.log[date] = n;
}

function toggleSlot(habitId, date, slotIndex){
  if(!canExecute()){ blockedBeforeStart(); return; }
  const h = habits.find(x => x.id === habitId);
  if(!h) return;
  if(date > todayStr()) return;
  const slots = ensureSlots(h, date);
  slots[slotIndex] = !slots[slotIndex];
  syncLogFromSlots(h, date);
  store.set('habits', habits);
  renderHabits();
  renderHabitModal();
}

/* ============ МОДАЛКА ============ */
let detailHabitId = null;
let detailYear = null;
let detailMonth = null;
let detailSelectedDay = null;
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

function openHabitModal(id){
  detailHabitId = id;
  const now = new Date();
  detailYear = now.getFullYear();
  detailMonth = now.getMonth();
  detailSelectedDay = todayStr();
  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderHabitModal();
}

function closeHabitModal(){
  document.getElementById('modal').classList.remove('open');
  document.body.style.overflow = '';
  detailHabitId = null;
}

function changeMonth(delta){
  detailMonth += delta;
  if(detailMonth > 11){ detailMonth = 0; detailYear++; }
  if(detailMonth < 0){ detailMonth = 11; detailYear--; }
  renderHabitModal();
}

function renderHabitModal(){
  const h = habits.find(x => x.id === detailHabitId);
  if(!h){ closeHabitModal(); return; }

  const isWeek = h.period === 'week';
  const t = todayStr();
  const created = h.createdAt || '0000-01-01';

  let sub = fmtFreq(h.target, h.period);
  const activeDays = Object.entries(h.log || {}).filter(([d,v]) => v > 0).length;
  if(isWeek){
    const ws = weekStreak(h);
    sub += ` · 🔥 недель подряд: <b>${ws}</b> · активных дней: <b>${activeDays}</b>`;
  } else {
    const streak = habitStreak(h);
    const completedDays = Object.entries(h.log || {}).filter(([d, v]) => v >= h.target).length;
    sub += ` · 🔥 streak <b>${streak}</b> · закрыто дней <b>${completedDays}</b> · активных <b>${activeDays}</b>`;
  }
  document.getElementById('modalTitle').textContent = h.name;
  document.getElementById('modalSub').innerHTML = sub;
  document.getElementById('monthLabel').textContent = `${MONTHS[detailMonth]} ${detailYear}`;

  const cal = document.getElementById('calendar');
  cal.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'cal-head';
  ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-wd'; el.textContent = d;
    head.appendChild(el);
  });
  cal.appendChild(head);

  const first = new Date(detailYear, detailMonth, 1);
  const lastDay = new Date(detailYear, detailMonth + 1, 0);
  const gridStart = new Date(first);
  const firstWd = (gridStart.getDay() + 6) % 7;
  gridStart.setDate(gridStart.getDate() - firstWd);

  const cursor = new Date(gridStart);
  while(cursor <= lastDay){
    const weekEl = document.createElement('div');
    weekEl.className = 'cal-week';
    const weekDates = [];
    for(let i = 0; i < 7; i++){
      const d = new Date(cursor);
      d.setDate(cursor.getDate() + i);
      weekDates.push(d);
    }
    if(isWeek){
      const weekKeys = weekDates.map(d => dayStr(d));
      const sum = weekKeys.reduce((s,k) => s + ((h.log||{})[k] || 0), 0);
      if(sum >= h.target) weekEl.classList.add('closed');
    }
    weekDates.forEach(d => {
      const dateStr = dayStr(d);
      const el = document.createElement('div');
      el.className = 'cal-day';
      if(d.getMonth() !== detailMonth || d.getFullYear() !== detailYear) el.classList.add('outside');
      const val = (h.log || {})[dateStr] || 0;
      if(dateStr > t){
        el.classList.add('future');
      } else if(isWeek){
        if(val > 0) el.classList.add('partial');
        else if(dateStr < created) el.classList.add('before');
        else el.classList.add('missed');
      } else {
        if(val >= h.target) el.classList.add('done');
        else if(val > 0) el.classList.add('partial');
        else if(dateStr < created) el.classList.add('before');
        else el.classList.add('missed');
      }
      if(dateStr === t) el.classList.add('today');
      if(dateStr === detailSelectedDay) el.classList.add('selected');
      el.textContent = d.getDate();
      el.onclick = () => {
        if(dateStr > t) return;
        detailSelectedDay = dateStr;
        renderHabitModal();
      };
      weekEl.appendChild(el);
    });
    cal.appendChild(weekEl);
    cursor.setDate(cursor.getDate() + 7);
  }
  renderHabitDayDetail(h);
}

function renderHabitDayDetail(h){
  const detail = document.getElementById('dayDetail');
  if(!detailSelectedDay){ detail.innerHTML = ''; return; }

  const day = detailSelectedDay;
  const val = (h.log || {})[day] || 0;
  const d = new Date(day + 'T12:00:00');
  const dateFmt = d.toLocaleDateString('ru-RU', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const created = h.createdAt || '0000-01-01';
  const isFuture = day > todayStr();
  const isWeek = h.period === 'week';
  const isDailyMulti = h.period === 'day' && h.target > 1;
  const locked = !canExecute();

  if(isFuture){
    detail.innerHTML = `
      <div class="dd-date">${dateFmt}</div>
      <div class="dd-row" style="border-top:none; margin-top:0; padding-top:0;">🔒 Будущее — отметить нельзя</div>`;
    return;
  }

  if(isWeek){
    const weekKeys = getWeekDaysFrom(d);
    const ws = weekKeys.reduce((s,k) => s + ((h.log||{})[k] || 0), 0);
    const closed = ws >= h.target;
    let segs = '';
    for(let i = 0; i < h.target; i++) segs += `<div class="wb-seg${i < ws ? ' on' : ''}"></div>`;
    const dayStatus = val > 0 ? '✅ день отмечен' : '⚪ не отмечено';
    const beforeHint = (day < created) ? `<div class="dd-hint">💡 В приложении привычки тогда ещё не было</div>` : '';

    if(locked){
      detail.innerHTML = `
        <div class="dd-date">${dateFmt}</div>
        <div class="dd-row" style="border-top:none; margin-top:0;">${dayStatus}</div>
        <div class="week-block">
          <div class="week-block-title">Прогресс недели</div>
          <div class="week-bar">${segs}</div>
          <div class="week-bar-label">
            <span><b>${ws}</b> / ${h.target} за эту неделю</span>
            ${closed ? '<span class="week-closed-badge">✅ неделя закрыта</span>' : ''}
          </div>
        </div>
        ${beforeHint}`;
      return;
    }

    const canDec = val > 0;
    const canInc = val < h.target;
    detail.innerHTML = `
      <div class="dd-date">${dateFmt}</div>
      <div class="dd-edit">
        <button class="dd-round" onclick="habitChangeDay('${h.id}','${day}',-1)" ${canDec?'':'disabled'}>−</button>
        <div class="dd-big">${val}<small>раз</small></div>
        <button class="dd-round" onclick="habitChangeDay('${h.id}','${day}',+1)" ${canInc?'':'disabled'}>+</button>
      </div>
      <div class="dd-row">${dayStatus}</div>
      <div class="week-block">
        <div class="week-block-title">Прогресс недели (Пн–Вс)</div>
        <div class="week-bar">${segs}</div>
        <div class="week-bar-label">
          <span><b>${ws}</b> / ${h.target} за эту неделю</span>
          ${closed ? '<span class="week-closed-badge">✅ неделя закрыта</span>' : ''}
        </div>
      </div>
      ${beforeHint}
      <div class="dd-quick">
        <button onclick="habitSetDay('${h.id}','${day}',0)" ${val>0?'':'disabled'}>Сбросить день</button>
        <button class="accent" onclick="habitSetDay('${h.id}','${day}',1)" ${canInc?'':'disabled'}>Отметить</button>
      </div>`;
    return;
  }

  if(isDailyMulti){
    const slots = ensureSlots(h, day);
    const doneCount = slots.filter(Boolean).length;
    const allDone = doneCount >= h.target;

    let slotsHtml = '';
    for(let i = 0; i < h.target; i++){
      const on = slots[i];
      slotsHtml += `<button class="slot-check${on ? ' done' : ''}" ${locked ? 'disabled' : ''} onclick="toggleSlot('${h.id}','${day}',${i})" title="Раз ${i+1}">${i+1}</button>`;
    }

    let status;
    if(allDone) status = '✅ закрыто полностью';
    else if(doneCount > 0) status = '⏳ частично';
    else status = '❌ не отмечено';

    const beforeHint = (day < created)
      ? `<div class="dd-hint">💡 В приложении привычки тогда ещё не было</div>`
      : '';

    if(locked){
      detail.innerHTML = `
        <div class="dd-date">${dateFmt}</div>
        <div class="slot-checks">${slotsHtml}</div>
        <div class="slot-status">${status} · ${doneCount} / ${h.target}</div>
        ${beforeHint}`;
      return;
    }

    detail.innerHTML = `
      <div class="dd-date">${dateFmt}</div>
      <div class="slot-checks">${slotsHtml}</div>
      <div class="slot-status">${status} · ${doneCount} / ${h.target}</div>
      ${beforeHint}
      <div class="dd-quick">
        <button onclick="habitSetDay('${h.id}','${day}',0)" ${doneCount>0?'':'disabled'}>Сбросить день</button>
        <button class="accent" onclick="habitSetDay('${h.id}','${day}',${h.target})" ${!allDone?'':'disabled'}>Отметить всё</button>
      </div>`;
    return;
  }

  let status;
  if(val >= h.target) status = '✅ закрыто полностью';
  else if(val > 0) status = '⏳ частично';
  else status = '❌ не отмечено';
  const beforeHint = (day < created) ? `<div class="dd-hint">💡 В приложении привычки тогда ещё не было</div>` : '';

  if(locked){
    detail.innerHTML = `
      <div class="dd-date">${dateFmt}</div>
      <div class="dd-big" style="text-align:left; margin:10px 0;">${val}<small>/ ${h.target}</small></div>
      <div class="dd-row" style="border-top:none; margin-top:0;">${status}</div>
      ${beforeHint}`;
    return;
  }

  const canDec = val > 0;
  const canInc = val < h.target;
  detail.innerHTML = `
    <div class="dd-date">${dateFmt}</div>
    <div class="dd-edit">
      <button class="dd-round" onclick="habitChangeDay('${h.id}','${day}',-1)" ${canDec?'':'disabled'}>−</button>
      <div class="dd-big">${val}<small>/ ${h.target}</small></div>
      <button class="dd-round" onclick="habitChangeDay('${h.id}','${day}',+1)" ${canInc?'':'disabled'}>+</button>
    </div>
    <div class="dd-row">${status}</div>
    ${beforeHint}
    <div class="dd-quick">
      <button onclick="habitSetDay('${h.id}','${day}',0)" ${val>0?'':'disabled'}>Сбросить день</button>
      <button class="accent" onclick="habitSetDay('${h.id}','${day}',${h.target})" ${canInc?'':'disabled'}>Отметить всё</button>
    </div>`;
}

function habitChangeDay(habitId, dateStr, delta){
  if(!canExecute()){ blockedBeforeStart(); return; }
  const h = habits.find(x => x.id === habitId);
  if(!h) return;
  if(dateStr > todayStr()) return;

  if(h.period === 'day' && h.target > 1){
    const slots = ensureSlots(h, dateStr);
    if(delta > 0){
      const firstFalse = slots.indexOf(false);
      if(firstFalse === -1) return;
      slots[firstFalse] = true;
    } else {
      let lastTrue = -1;
      for(let i = slots.length - 1; i >= 0; i--){
        if(slots[i]){ lastTrue = i; break; }
      }
      if(lastTrue === -1) return;
      slots[lastTrue] = false;
    }
    syncLogFromSlots(h, dateStr);
    store.set('habits', habits);
    renderHabits();
    renderHabitModal();
    return;
  }

  if(!h.log) h.log = {};
  const cur = h.log[dateStr] || 0;
  let next = cur + delta;
  if(next < 0) next = 0;
  if(next > h.target) next = h.target;
  if(next === 0) delete h.log[dateStr];
  else h.log[dateStr] = next;
  store.set('habits', habits);
  renderHabits();
  renderHabitModal();
}

function habitSetDay(habitId, dateStr, value){
  if(!canExecute()){ blockedBeforeStart(); return; }
  const h = habits.find(x => x.id === habitId);
  if(!h) return;
  if(dateStr > todayStr()) return;

  if(h.period === 'day' && h.target > 1){
    const slots = ensureSlots(h, dateStr);
    const target = Math.min(value, h.target);
    for(let i = 0; i < slots.length; i++) slots[i] = i < target;
    syncLogFromSlots(h, dateStr);
    store.set('habits', habits);
    renderHabits();
    renderHabitModal();
    return;
  }

  if(!h.log) h.log = {};
  if(value <= 0) delete h.log[dateStr];
  else h.log[dateStr] = Math.min(value, h.target);
  store.set('habits', habits);
  renderHabits();
  renderHabitModal();
}
