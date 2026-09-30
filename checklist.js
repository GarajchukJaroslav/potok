/* ==================================================================
   ЧЕКЛИСТ — авто-события + свои «не хочу делать» + merged
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
    mergedIntoId: null
  });
}

/* ---------- РУЧНЫЕ СОБЫТИЯ ---------- */
function openManualPicker(){
  const tasks = [];

  habits.forEach(h => {
    tasks.push({
      value: 'habit:' + h.id,
      group: 'ЗОЖ',
      title: h.name,
      crumb: null,
      refType: 'habit',
      refId: h.id
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
          refId: step.id
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
            refId: step.id + ':' + ss.id
          });
        });
      }
    });
  });

  const sel = document.getElementById('manualTaskSelect');
  if(!sel) return;

  if(tasks.length === 0){
    sel.innerHTML = `<option value="">— нет доступных задач —</option>`;
  } else {
    const byGroup = {};
    tasks.forEach(t => {
      if(!byGroup[t.group]) byGroup[t.group] = [];
      byGroup[t.group].push(t);
    });
    let html = '<option value="">— выбери задачу —</option>';
    Object.keys(byGroup).forEach(g => {
      html += `<optgroup label="${g}">`;
      byGroup[g].forEach(t => {
        const label = t.crumb ? `${t.title}  (${t.crumb})` : t.title;
        const escaped = escapeHtml(label);
        const crumbEsc = t.crumb ? escapeHtml(t.crumb) : '';
        html += `<option value="${t.value}" data-ref-type="${t.refType}" data-ref-id="${t.refId}" data-title="${escapeHtml(t.title)}" data-crumb="${crumbEsc}">${escaped}</option>`;
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

  if(!value){ alert('Выбери задачу'); sel.focus(); return; }
  if(!date){ alert('Укажи дату'); dateInp.focus(); return; }
  if(date < SYSTEM_START_DATE){ alert('Дата раньше старта системы'); return; }

  const opt = sel.options[sel.selectedIndex];
  const refType = opt.dataset.refType;
  const refId = opt.dataset.refId;
  const title = opt.dataset.title;
  const crumb = opt.dataset.crumb || null;

  const dup = checklistEvents.find(e =>
    e.source === 'manual' &&
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
    refType,
    refId,
    title,
    detail: 'не хочется делать',
    crumb,
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
  if(!autoList || !manualList) return;

  autoList.innerHTML = '';
  manualList.innerHTML = '';

  // дети merged не показываются отдельно
  const visible = checklistEvents.filter(e => e.status !== 'merged');

  const auto = visible.filter(e => e.source !== 'manual');
  const manual = visible.filter(e => e.source === 'manual');

  const sortFn = (a,b) => {
    const aDone = a.status === 'resolved' ? 1 : 0;
    const bDone = b.status === 'resolved' ? 1 : 0;
    if(aDone !== bDone) return aDone - bDone;
    return b.date.localeCompare(a.date);
  };
  auto.sort(sortFn);
  manual.sort(sortFn);

  if(auto.length === 0){
    autoList.innerHTML = `
      <div class="empty">
        <span class="empty-icon">✨</span>
        Пока чисто. Все привычки сделаны, задачи не просрочены.
      </div>`;
  } else {
    auto.forEach(e => autoList.appendChild(buildEventCard(e)));
  }

  if(manual.length === 0){
    manualList.innerHTML = `
      <div class="empty" style="padding:30px 20px;">
        <span class="empty-icon" style="font-size:24px;">💭</span>
        Пусто.<br>
        <span style="font-size:12px;">Жми + если что-то не хочется делать</span>
      </div>`;
  } else {
    manual.forEach(e => manualList.appendChild(buildEventCard(e, true)));
  }
}

function buildEventCard(e, isManual){
  const el = document.createElement('div');
  el.className = 'checklist-event';
  if(isManual) el.classList.add('manual');
  if(e.source === 'merged') el.classList.add('merged');
  if(e.status === 'resolved') el.classList.add('resolved');
  if(e.status === 'in_progress') el.classList.add('in-progress');

  let sourceLabel, sourceIcon, titleHtml;

  if(e.source === 'merged'){
    sourceLabel = 'Объединено';
    sourceIcon = '🔗';
    const kids = getMergedChildren(e);
    titleHtml = `${kids.length} ${plural(kids.length,'событие','события','событий')}`;
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
