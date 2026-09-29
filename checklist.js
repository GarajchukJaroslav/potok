/* ==================================================================
   ЧЕКЛИСТ — события из пропусков (привычки + канбан)
================================================================== */

/* ---------- ГЕНЕРАЦИЯ СОБЫТИЙ ---------- */
function generateChecklistEvents(){
  const before = checklistEvents.length;
  const today = todayStr();

  // Привычки
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

  // Канбан (leaf-задачи)
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
    solution: null
  });
}

/* ---------- РЕНДЕР ---------- */
function renderChecklist(){
  generateChecklistEvents();
  const list = document.getElementById('checklistList');
  if(!list) return;
  list.innerHTML = '';

  if(checklistEvents.length === 0){
    list.innerHTML = `
      <div class="empty">
        <span class="empty-icon">✨</span>
        Пока чисто. Все привычки сделаны, задачи не просрочены.
      </div>`;
    return;
  }

  // сортировка: новые наверх, потом по дате
  const sorted = [...checklistEvents].sort((a,b) => {
    const aDone = a.status === 'resolved' ? 1 : 0;
    const bDone = b.status === 'resolved' ? 1 : 0;
    if(aDone !== bDone) return aDone - bDone;
    return b.date.localeCompare(a.date);
  });

  sorted.forEach(e => {
    const el = document.createElement('div');
    el.className = 'checklist-event';
    if(e.status === 'resolved') el.classList.add('resolved');
    if(e.status === 'in_progress') el.classList.add('in-progress');

    const sourceLabel = e.source === 'habit' ? 'ЗОЖ' : 'Канбан';
    const sourceIcon = e.source === 'habit' ? '🎯' : '📋';

    let actionHtml = '';
    if(e.status === 'new'){
      actionHtml = `<button class="btn-take-action" onclick="startAnalysisFromEvent('${e.id}')">Принять меры</button>`;
    } else if(e.status === 'in_progress'){
      actionHtml = `<button class="btn-take-action in-progress" onclick="resumeAnalysisFromEvent('${e.id}')">Продолжить анализ →</button>`;
    } else {
      actionHtml = `<div class="event-resolved-badge">✓ Решено</div>`;
    }

    const crumbHtml = e.crumb ? `<div class="event-crumb">${escapeHtml(e.crumb)}</div>` : '';
    const solutionHtml = e.solution ? `<div class="event-solution">Решение: ${escapeHtml(e.solution)}</div>` : '';

    el.innerHTML = `
      <div class="event-head">
        <div class="event-date">${fmtEventDate(e.date)}</div>
        <div class="event-source ${e.source}">${sourceIcon} ${sourceLabel}</div>
      </div>
      <div class="event-title">${escapeHtml(e.title)}</div>
      ${crumbHtml}
      <div class="event-detail">${escapeHtml(e.detail)}</div>
      ${solutionHtml}
      <div class="event-foot">${actionHtml}</div>
    `;
    list.appendChild(el);
  });
}
