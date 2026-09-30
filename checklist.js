/* ==================================================================
   ЧЕКЛИСТ — авто-события + свои события (дропдаун) + merged
================================================================== */

/* ---------- ГЕНЕРАЦИЯ АВТО-СОБЫТИЙ ---------- */
function generateChecklistEvents(){
  const before = checklistEvents.length;

  habits.forEach(h => {
    if(h.period === 'day'){
      const y = new Date(); y.setDate(y.getDate() - 1);
      const yStr = dayStr(y);
      if(yStr < SYSTEM_START_DATE) return;
      const done = (h.log[yStr] || 0);
      if(done < h.target){
        addEventIfMissing('habit', h.id, yStr, {
          title: h.name,
          detail: `${done}/${h.target} за день`,
          period: 'day'
        });
      }
    } else if(h.period === 'week'){
      const now = new Date();
      const thisMonday = getWeekDaysFrom(now)[0];
      const lastMonday = new Date(thisMonday + 'T12:00:00');
      lastMonday.setDate(lastMonday.getDate() - 7);
      const weekDays = [];
      for(let i=0;i<7;i++){
        const d = new Date(lastMonday);
        d.setDate(d.getDate() + i);
        weekDays.push(dayStr(d));
      }
      const lastSunday = weekDays[6];
      if(lastSunday < SYSTEM_START_DATE) return;
      const sum = weekDays.reduce((s,k) => s + ((h.log||{})[k] || 0), 0);
      if(sum < h.target){
        addEventIfMissing('habit', h.id, lastSunday, {
          title: h.name,
          detail: `${sum}/${h.target} за неделю`,
          period: 'week'
        });
      }
    }
  });

  goals.forEach(g => {
    if(g.done) return;
    (g.steps || []).forEach(step => {
      const subs = step.substeps || [];
      if(subs.length === 0){
        checkTaskOverdue(g.id, step.id, null, step, g.text);
      } else {
        subs.forEach(ss => checkTaskOverdue(g.id, step.id, ss.id, ss, g.text + ' → ' + step.text));
      }
    });
  });

  if(checklistEvents.length !== before){
    store.set('checklistEvents', checklistEvents);
  }
}

function checkTaskOverdue(goalId, stepId, substepId, task, crumb){
  if(task.status === 'done') return;
  if(!task.deadline) return;
  if(task.deadline >= todayStr()) return;
  if(task.deadline < SYSTEM_START_DATE) return;

  const refId = substepId ? (stepId + ':' + substepId) : stepId;
  addEventIfMissing('kanban', refId, task.deadline, {
    title: task.text,
    detail: 'не выполнено',
    goalId, stepId, substepId,
    crumb
  });
}

function addEventIfMissing(source, refId, date, info){
  const exists = checklistEvents.find(e =>
    e.source === source &&
    e.refId === refId &&
    e.date === date
  );
  if(exists) return;

  checklistEvents.push({
    id: uid(),
    date,
    source,
    refId,
    title: info.title,
    detail: info.detail,
    period: info.period || null,
    goalId: info.goalId || null,
    stepId: info.stepId || null,
    substepId: info.substepId || null,
    crumb: info.crumb || null,
    createdAt: Date.now(),
    status: 'new',
    analysisId: null,
    analysisStartedAt: null,
    analysisDeadline: null,
    resolvedAt: null,
    solution: null,
    childrenIds: null,
    mergedIntoId: null,
    manualType: null
  });
}

/* ---------- ПЕРЕКЛЮЧАТЕЛЬ КАТЕГОРИИ ---------- */
function switchManualType(type){
  currentManualType = type;
  store.set('manualCurrentType', type);
  renderChecklist();
}

/* ---------- РУЧНЫЕ СОБЫТИЯ ---------- */
function openManualPicker(){
  const type = currentManualType;

  const titleEl = document.getElementById('manualModalTitle');
  const labelEl = document.getElementById('manualTaskLabel');
  if(titleEl) titleEl.textContent = type === 'result'
    ? 'Результат не соответствует ожиданию'
    : 'Не хочу делать';
  if(labelEl) labelEl.textContent = type === 'result'
    ? 'Какой шаг не дал ожидаемого результата'
    : 'Что не хочется делать';

  const tasks = [];

  if(type === 'want'){
    habits.forEach(h => {
      tasks.push({
        value: 'habit:' + h.id,
        group: 'ЗОЖ',
        title: h.name,
        crumb: null,
        refType: 'habit',
        refId: h.id,
        disabled: false
      });
    });

    goals.forEach(g => {
      if(g.done) return;
      (g.steps || []).forEach(step => {
        const subs = step.substeps || [];
        if(subs.length === 0){
          if(step.status === 'done') return;
          tasks.push({
            value: 'kanban:' + g.id + ':' + step.id,
            group: 'Канбан',
            title: step.text,
            crumb: g.text,
            refType: 'kanban',
            refId: step.id,
            disabled: false
          });
        } else {
          subs.forEach(ss => {
            if(ss.status === 'done') return;
            tasks.push({
              value: 'kanban:' + g.id + ':' + step.id + ':' + ss.id,
              group: 'Канбан',
              title: ss.text,
              crumb: g.text + ' → ' + step.text,
              refType: 'kanban',
              refId: step.id + ':' + ss.id,
              disabled: false
            });
          });
        }
      });
    });
  } else {
    // result — только leaf-шаги (без подшагов), все: выполненные доступны, невыполненные disabled
    goals.forEach(g => {
      (g.steps || []).forEach(step => {
        const subs = step.substeps || [];
        if(subs.length > 0) return;

        const done = step.status === 'done';
        tasks.push({
          value: 'kanban:' + g.id + ':' + step.id,
          group: g.text,
          title: step.text,
          crumb: null,
          refType: 'kanban',
          refId: step.id,
          goalId: g.id,
          stepId: step.id,
          disabled: !done
        });
      });
    });
  }

  const sel = document.getElementById('manualTaskSelect');
  if(!sel) return;

  if(tasks.length === 0){
    sel.innerHTML = `<option value="">— нет доступных шагов —</option>`;
  } else {
    const byGroup = {};
    tasks.forEach(t => {
      if(!byGroup[t.group]) byGroup[t.group] = [];
      byGroup[t.group].push(t);
    });
    let html = `<option value="">— выбери ${type === 'result' ? 'шаг' : 'задачу'} —</option>`;
    Object.keys(byGroup).forEach(g => {
      html += `<optgroup label="${escapeHtml(g)}">`;
      byGroup[g].forEach(t => {
        const label = t.crumb ? `${t.title}  (${t.crumb})` : t.title;
        const escaped = escapeHtml(label);
        const crumbEsc = t.crumb ? escapeHtml(t.crumb) : '';
        const dis = t.disabled ? 'disabled' : '';
        const suffix = t.disabled ? ' — не выполнен' : '';
        html += `<option value="${t.value}" ${dis}
          data-ref-type="${t.refType}"
          data-ref-id="${t.refId}"
          data-title="${escapeHtml(t.title)}"
          data-crumb="${crumbEsc}"
          data-goal-id="${t.goalId || ''}"
          data-step-id="${t.stepId || ''}"
        >${escaped}${suffix}</option>`;
      });
      html += '</optgroup>';
    });
    sel.innerHTML = html;
  }

  const dateInp = document.getElementById('manualDate');
  if(dateInp){
    dateInp.value = todayStr();
    if(dateInp.min !== SYSTEM_START_DATE) dateInp.min = SYSTEM_START_DATE;
  }

  document.getElementById('manualOverlay').classList.add('open');
}

function closeManualPicker(){
  document.getElementById('manualOverlay').classList.remove('open');
}

function createManualEvent(){
  const sel = document.getElementById('manualTaskSelect');
  const dateInp = document.getElementById('manualDate');
  if(!sel || !dateInp) return;

  const value = sel.value;
  const date = dateInp.value;
  const type = currentManualType;

  if(!value){
    alert(type === 'result' ? 'Выбери выполненный шаг' : 'Выбери задачу');
    sel.focus(); return;
  }
  if(!date){ alert('Укажи дату'); dateInp.focus(); return; }
  if(date < SYSTEM_START_DATE){ alert('Дата раньше старта системы'); return; }

  const opt = sel.options[sel.selectedIndex];
  const refType = opt.dataset.refType;
  const refId = opt.dataset.refId;
  const title = opt.dataset.title;
  const crumb = opt.dataset.crumb || null;
  const goalId = opt.dataset.goalId || null;
  const stepId = opt.dataset.stepId || null;

  const dup = checklistEvents.find(e =>
    e.source === 'manual' &&
    e.manualType === type &&
    e.refType === refType &&
    e.refId === refId &&
    e.date === date &&
    e.status !== 'resolved'
  );
  if(dup){ alert('Такое событие уже есть'); return; }

  checklistEvents.push({
    id: uid(),
    date,
    source: 'manual',
    manualType: type,
    refType,
    refId,
    title,
    detail: type === 'result'
      ? 'результат не соответствует ожиданию'
      : 'не хочется делать',
    crumb,
    goalId,
    stepId,
    createdAt: Date.now(),
    status: 'new',
    analysisId: null,
    analysisStartedAt: null,
    analysisDeadline: null,
    resolvedAt: null,
    solution: null,
    childrenIds: null,
    mergedIntoId: null
  });
  store.set('checklistEvents', checklistEvents);
  closeManualPicker();
  renderChecklist();
}

/* ---------- РЕНДЕР ---------- */
function renderChecklist(){
  generateChecklistEvents();

  const autoList = document.getElementById('checklistList');
  const manualList = document.getElementById('checklistManualList');
  const select = document.getElementById('sideSelect');
  const addBtn = document.getElementById('sideAddBtn');

  // синхронизируем селект с текущим типом
  if(select && select.value !== currentManualType){
    select.value = currentManualType;
  }
  // перекрашиваем кнопку + под тему
  if(addBtn){
    addBtn.classList.toggle('result', currentManualType === 'result');
  }

  if(autoList){
    autoList.innerHTML = '';
    const auto = checklistEvents
      .filter(e => e.status !== 'merged' && e.source !== 'manual')
      .sort((a,b) => {
        const aDone = a.status === 'resolved' ? 1 : 0;
        const bDone = b.status === 'resolved' ? 1 : 0;
        if(aDone !== bDone) return aDone - bDone;
        return b.date.localeCompare(a.date);
      });

    if(auto.length === 0){
      autoList.innerHTML = `
        <div class="empty">
          <span class="empty-icon">✨</span>
          Пока чисто. Все привычки сделаны, задачи не просрочены.
        </div>`;
    } else {
      auto.forEach(e => autoList.appendChild(buildEventCard(e)));
    }
  }

  if(manualList){
    manualList.innerHTML = '';
    const items = checklistEvents
      .filter(e => e.status !== 'merged'
        && e.source === 'manual'
        && e.manualType === currentManualType)
      .sort((a,b) => {
        const aDone = a.status === 'resolved' ? 1 : 0;
        const bDone = b.status === 'resolved' ? 1 : 0;
        if(aDone !== bDone) return aDone - bDone;
        return b.date.localeCompare(a.date);
      });

    if(items.length === 0){
      const icon = currentManualType === 'result' ? '🎯' : '💭';
      const hint = currentManualType === 'result'
        ? 'Результат шага не оправдал ожиданий? Жми +'
        : 'Что-то не хочется делать? Жми +';
      manualList.innerHTML = `
        <div class="empty" style="padding:30px 20px;">
          <span class="empty-icon" style="font-size:24px;">${icon}</span>
          Пусто.<br>
          <span style="font-size:12px;">${hint}</span>
        </div>`;
    } else {
      items.forEach(e => manualList.appendChild(buildEventCard(e)));
    }
  }
}

function buildEventCard(e){
  const el = document.createElement('div');
  el.className = 'checklist-event';
  if(e.source === 'manual') el.classList.add('manual');
  if(e.source === 'manual' && e.manualType === 'result') el.classList.add('manual-result');
  if(e.source === 'merged') el.classList.add('merged');
  if(e.status === 'resolved') el.classList.add('resolved');
  if(e.status === 'in_progress') el.classList.add('in-progress');

  let sourceLabel, sourceIcon, titleHtml;

  if(e.source === 'merged'){
    sourceLabel = 'Объединено';
    sourceIcon = '🔗';
    const kids = getMergedChildren(e);
    titleHtml = `${kids.length} ${plural(kids.length,'событие','события','событий')}`;
  } else if(e.source === 'manual' && e.manualType === 'result'){
    sourceLabel = 'Результат';
    sourceIcon = '🎯';
    titleHtml = escapeHtml(e.title);
  } else {
    sourceLabel = e.source === 'habit' ? 'ЗОЖ' : (e.source === 'kanban' ? 'Канбан' : 'Своё');
    sourceIcon = e.source === 'habit' ? '🎯' : (e.source === 'kanban' ? '📋' : '💭');
    titleHtml = escapeHtml(e.title);
  }

  let actionHtml = '';
  if(e.status === 'new'){
    actionHtml = `<button class="btn-take-action" onclick="startAnalysisFromEvent('${e.id}')">Принять меры</button>`;
  } else if(e.status === 'in_progress'){
    actionHtml = `<button class="btn-take-action in-progress" onclick="resumeAnalysisFromEvent('${e.id}')">Продолжить анализ →</button>`;
  } else {
    actionHtml = `<div class="event-resolved-badge">✓ Решено</div>`;
  }

  const crumbHtml = e.crumb && e.source !== 'merged'
    ? `<div class="event-crumb">${escapeHtml(e.crumb)}</div>` : '';
  const solutionHtml = e.solution
    ? `<div class="event-solution">Решение: ${escapeHtml(e.solution)}</div>` : '';

  let childrenHtml = '';
  if(e.source === 'merged'){
    const kids = getMergedChildren(e);
    childrenHtml = `<div class="event-children">${kids.map(k => {
      const icon = k.source === 'habit' ? '🎯' : (k.source === 'kanban' ? '📋' : '💭');
      const label = k.source === 'habit' ? 'ЗОЖ' : (k.source === 'kanban' ? 'Канбан' : 'Своё');
      return `<div class="event-child"><span class="event-child-icon">${icon}</span><span class="event-child-label">${label}</span><span class="event-child-title">${escapeHtml(k.title)}</span></div>`;
    }).join('')}</div>`;
  }

  el.innerHTML = `
    <div class="event-head">
      <div class="event-date">${fmtEventDate(e.date)}</div>
      <div class="event-source ${e.source}">${sourceIcon} ${sourceLabel}</div>
    </div>
    <div class="event-title">${titleHtml}</div>
    ${crumbHtml}
    ${childrenHtml}
    ${e.source !== 'merged' ? `<div class="event-detail">${escapeHtml(e.detail)}</div>` : ''}
    ${solutionHtml}
    <div class="event-foot">${actionHtml}</div>
  `;
  return el;
}
