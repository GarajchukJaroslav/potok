/* ==================================================================
   ЭКРАН «ЦЕЛИ» — цель → шаг (с результатом) → подшаг
   Полностью без запретов. Все изменения — в журнал.
================================================================== */

let expandedGoals = new Set(store.get('expandedGoals', []));
let expandedSteps = new Set(store.get('expandedSteps', []));
let pendingResultCheck = null;
let promptedThisSession = new Set();

/* ---------- ЦЕЛЬ ---------- */
function addGoal(){
  const inp = document.getElementById('goalInput');
  const dlInp = document.getElementById('goalDeadline');
  const v = inp.value.trim();
  const deadline = dlInp ? dlInp.value : '';
  if(!v) return;
  if(!deadline){
    alert('Укажи дедлайн цели');
    if(dlInp) dlInp.focus();
    return;
  }
  const goal = {
    id: uid(), text: v, done: false, deadline,
    steps: [], date: new Date().toISOString()
  };
  goals.push(goal);
  logAction('goal_created', {
    kind: 'goal', id: goal.id, name: goal.text
  }, { deadline });
  inp.value = '';
  if(dlInp) dlInp.value = '';
  store.set('goals', goals);
  renderGoalList();
  inp.focus();
}

function toggleGoalDone(id){
  const g = goals.find(x => x.id === id);
  if(!g) return;
  g.done = !g.done;
  store.set('goals', goals);
  renderGoalList();
}

function delGoal(id){
  const g = goals.find(x => x.id === id);
  if(!g) return;
  if(!confirm('Удалить цель со всеми шагами и подшагами?')) return;
  logAction('goal_deleted', {
    kind: 'goal', id: g.id, name: g.text
  });
  goals = goals.filter(x => x.id !== id);
  store.set('goals', goals);
  renderGoalList();
}

function setGoalDeadline(goalId, value){
  const g = goals.find(x => x.id === goalId);
  if(!g) return;
  if(!value){ renderGoalList(); return; }
  const before = g.deadline;
  g.deadline = value;
  logAction('goal_deadline_changed', {
    kind: 'goal', id: g.id, name: g.text
  }, { before, after: value });
  store.set('goals', goals);
  renderGoalList();
}

function toggleExpandGoal(id){
  if(expandedGoals.has(id)) expandedGoals.delete(id);
  else expandedGoals.add(id);
  store.set('expandedGoals', [...expandedGoals]);
  renderGoalList();
  setTimeout(() => {
    const inp = document.querySelector(`[data-step-input="${id}"]`);
    if(inp && expandedGoals.has(id)) inp.focus();
  }, 30);
}

/* ---------- ШАГ ---------- */
function addStep(goalId){
  const inp = document.querySelector(`[data-step-input="${goalId}"]`);
  const dlInp = document.querySelector(`[data-step-deadline="${goalId}"]`);
  const resInp = document.querySelector(`[data-step-result="${goalId}"]`);
  if(!inp) return;
  const v = inp.value.trim();
  const deadline = dlInp ? dlInp.value : '';
  const result = resInp ? resInp.value.trim() : '';
  if(!v) return;
  if(!result){
    alert('Укажи результат шага');
    if(resInp) resInp.focus();
    return;
  }
  if(!deadline){
    alert('Укажи дедлайн шага');
    if(dlInp) dlInp.focus();
    return;
  }
  const g = goals.find(x => x.id === goalId);
  if(!g) return;
  if(!Array.isArray(g.steps)) g.steps = [];
  const step = {
    id: uid(), text: v,
    result: result,
    resultChecked: false,
    resultAchieved: null,
    resultEventId: null,
    status: 'todo', lastStatus: 'todo',
    deadline, substeps: []
  };
  g.steps.push(step);
  logAction('step_created', {
    kind: 'step', id: step.id, name: step.text,
    goalId: g.id
  }, { deadline, result });
  inp.value = '';
  if(dlInp) dlInp.value = '';
  if(resInp) resInp.value = '';
  store.set('goals', goals);
  renderGoalList();
  setTimeout(() => {
    const nInp = document.querySelector(`[data-step-input="${goalId}"]`);
    if(nInp) nInp.focus();
  }, 30);
}

function toggleStep(goalId, stepId){
  const g = goals.find(x => x.id === goalId);
  if(!g) return;
  const s = g.steps.find(x => x.id === stepId);
  if(!s) return;
  if(s.substeps && s.substeps.length > 0) return;

  if(s.status === 'done'){
    s.status = s.lastStatus || 'todo';
  } else {
    s.lastStatus = s.status || 'todo';
    s.status = 'done';
  }
  // галочка — не логируем, это само по себе фиксация
  store.set('goals', goals);
  renderGoalList();

  if(s.status === 'done') setTimeout(checkPendingResultChecks, 100);
}

function delStep(goalId, stepId){
  const g = goals.find(x => x.id === goalId);
  if(!g) return;
  const s = g.steps.find(x => x.id === stepId);
  if(!s) return;
  logAction('step_deleted', {
    kind: 'step', id: s.id, name: s.text,
    goalId: g.id
  });
  g.steps = g.steps.filter(x => x.id !== stepId);
  const key = goalId + ':' + stepId;
  if(expandedSteps.has(key)){ expandedSteps.delete(key); store.set('expandedSteps', [...expandedSteps]); }
  store.set('goals', goals);
  renderGoalList();
}

function setStepDeadline(goalId, stepId, value){
  const g = goals.find(x => x.id === goalId);
  if(!g) return;
  const s = g.steps.find(x => x.id === stepId);
  if(!s) return;
  if(!value){ renderGoalList(); return; }
  const before = s.deadline;
  s.deadline = value;
  logAction('step_deadline_changed', {
    kind: 'step', id: s.id, name: s.text,
    goalId: g.id
  }, { before, after: value });
  store.set('goals', goals);
  renderGoalList();
}

function setStepResult(goalId, stepId, value){
  const g = goals.find(x => x.id === goalId);
  if(!g) return;
  const s = g.steps.find(x => x.id === stepId);
  if(!s) return;
  const before = s.result;
  s.result = value;
  logAction('step_result_changed', {
    kind: 'step', id: s.id, name: s.text,
    goalId: g.id
  }, { before, after: value });
  store.set('goals', goals);
  renderGoalList();
}

function toggleExpandStep(goalId, stepId){
  const key = goalId + ':' + stepId;
  if(expandedSteps.has(key)) expandedSteps.delete(key);
  else expandedSteps.add(key);
  store.set('expandedSteps', [...expandedSteps]);
  renderGoalList();
  setTimeout(() => {
    const inp = document.querySelector(`[data-substep-input="${key}"]`);
    if(inp && expandedSteps.has(key)) inp.focus();
  }, 30);
}

/* ---------- ПОДШАГ ---------- */
function addSubstep(goalId, stepId){
  const key = goalId + ':' + stepId;
  const inp = document.querySelector(`[data-substep-input="${key}"]`);
  const dlInp = document.querySelector(`[data-substep-deadline="${key}"]`);
  if(!inp) return;
  const v = inp.value.trim();
  const deadline = dlInp ? dlInp.value : '';
  if(!v) return;
  if(!deadline){
    alert('Укажи дедлайн подшага');
    if(dlInp) dlInp.focus();
    return;
  }
  const g = goals.find(x => x.id === goalId);
  if(!g) return;
  const s = g.steps.find(x => x.id === stepId);
  if(!s) return;
  if(!Array.isArray(s.substeps)) s.substeps = [];
  const sub = {
    id: uid(), text: v, status: 'todo', lastStatus: 'todo', deadline
  };
  s.substeps.push(sub);
  logAction('substep_created', {
    kind: 'substep', id: sub.id, name: sub.text,
    goalId: g.id, stepId: s.id
  }, { deadline });
  inp.value = '';
  if(dlInp) dlInp.value = '';
  store.set('goals', goals);
  renderGoalList();
  setTimeout(() => {
    const nInp = document.querySelector(`[data-substep-input="${key}"]`);
    if(nInp) nInp.focus();
  }, 30);
}

function toggleSubstep(goalId, stepId, substepId){
  const g = goals.find(x => x.id === goalId);
  if(!g) return;
  const s = g.steps.find(x => x.id === stepId);
  if(!s) return;
  const ss = s.substeps.find(x => x.id === substepId);
  if(!ss) return;
  if(ss.status === 'done'){
    ss.status = ss.lastStatus || 'todo';
  } else {
    ss.lastStatus = ss.status || 'todo';
    ss.status = 'done';
  }
  store.set('goals', goals);
  renderGoalList();
  setTimeout(checkPendingResultChecks, 100);
}

function delSubstep(goalId, stepId, substepId){
  const g = goals.find(x => x.id === goalId);
  if(!g) return;
  const s = g.steps.find(x => x.id === stepId);
  if(!s) return;
  const ss = s.substeps.find(x => x.id === substepId);
  if(!ss) return;
  logAction('substep_deleted', {
    kind: 'substep', id: ss.id, name: ss.text,
    goalId: g.id, stepId: s.id
  });
  s.substeps = s.substeps.filter(x => x.id !== substepId);
  store.set('goals', goals);
  renderGoalList();
}

function setSubstepDeadline(goalId, stepId, substepId, value){
  const g = goals.find(x => x.id === goalId);
  if(!g) return;
  const s = g.steps.find(x => x.id === stepId);
  if(!s) return;
  const ss = s.substeps.find(x => x.id === substepId);
  if(!ss) return;
  if(!value){ renderGoalList(); return; }
  const before = ss.deadline;
  ss.deadline = value;
  logAction('substep_deadline_changed', {
    kind: 'substep', id: ss.id, name: ss.text,
    goalId: g.id, stepId: s.id
  }, { before, after: value });
  store.set('goals', goals);
  renderGoalList();
}

/* ---------- РЕЗУЛЬТАТ: ПРОВЕРКА ---------- */
function checkPendingResultChecks(){
  for(const g of goals){
    for(const s of (g.steps || [])){
      const eff = stepEffectiveStatus(s);
      if(eff !== 'done') continue;
      if(!s.result) continue;
      if(s.resultChecked) continue;
      if(promptedThisSession.has(s.id)) continue;

      promptedThisSession.add(s.id);
      openResultCheck(g.id, s.id);
      return;
    }
  }
}

function openResultCheck(goalId, stepId){
  const g = goals.find(x => x.id === goalId);
  if(!g) return;
  const s = g.steps.find(x => x.id === stepId);
  if(!s) return;

  pendingResultCheck = { goalId, stepId };

  const stepEl = document.getElementById('resultCheckStep');
  const expEl = document.getElementById('resultCheckExpected');
  if(stepEl) stepEl.textContent = s.text;
  if(expEl) expEl.textContent = s.result;

  document.getElementById('resultCheckOverlay').classList.add('open');
}

function answerResultCheck(achieved){
  if(!pendingResultCheck) return;
  const { goalId, stepId } = pendingResultCheck;
  const g = goals.find(x => x.id === goalId);
  if(!g) return;
  const s = g.steps.find(x => x.id === stepId);
  if(!s) return;

  s.resultChecked = true;
  s.resultAchieved = achieved;

  const now = Date.now();
  const event = {
    id: uid(),
    date: todayStr(),
    source: 'result',
    refId: stepId,
    goalId,
    stepId,
    achieved: achieved,
    title: s.text,
    detail: achieved ? 'результат достигнут: ' + s.result : 'результат НЕ достигнут: ' + s.result,
    crumb: g.text,
    createdAt: now,
    status: 'new',
    analysisId: null,
    analysisStartedAt: null,
    analysisDeadline: null,
    resolvedAt: null,
    solution: null,
    childrenIds: null,
    mergedIntoId: null,
    manualType: null
  };

  checklistEvents.push(event);
  s.resultEventId = event.id;

  logAction('result_marked', {
    kind: 'step', id: s.id, name: s.text,
    goalId: g.id
  }, { achieved, result: s.result, eventId: event.id });

  store.set('goals', goals);
  store.set('checklistEvents', checklistEvents);

  pendingResultCheck = null;
  document.getElementById('resultCheckOverlay').classList.remove('open');

  renderGoalList();
  if(typeof renderChecklist === 'function') renderChecklist();
  if(typeof renderAnalysis === 'function') renderAnalysis();

  setTimeout(checkPendingResultChecks, 500);
}

/* ---------- РЕНДЕР ---------- */
function renderGoalList(){
  const list = document.getElementById('goalList');
  if(!list) return;
  list.innerHTML = '';

  if(goals.length === 0){
    list.innerHTML = `<div class="empty"><span class="empty-icon">🎯</span>Пока пусто.<br>Добавь первую цель.</div>`;
    return;
  }

  const sorted = [...goals].sort((a,b) => {
    if(a.done !== b.done) return a.done ? 1 : -1;
    return new Date(b.date) - new Date(a.date);
  });

  sorted.forEach(g => {
    const el = document.createElement('div');
    el.className = 'goal';
    if(g.done) el.classList.add('done');
    if(expandedGoals.has(g.id)) el.classList.add('expanded');

    const total = (g.steps || []).length;
    const doneCount = (g.steps || []).filter(s => stepEffectiveStatus(s) === 'done').length;
    const allDone = total > 0 && doneCount === total;

    const progressPill = total > 0
      ? `<span class="goal-progress-pill${allDone ? ' complete' : ''}">${doneCount} / ${total} ${allDone ? '✓' : ''}</span>`
      : `<span class="goal-progress-pill" style="background:rgba(255,255,255,0.05); border-color:var(--border); color:var(--muted);">шагов нет</span>`;

    const dl = deadlineInfo(g.deadline);
    const deadlineHtml = dl ? `<span class="deadline-badge ${dl.level}">📅 ${dl.text}</span>` : '';

    const stepsHtml = (g.steps || []).map(s => renderStep(g.id, s)).join('');

    const addStepHtml = `<div class="step-add">
       <input name="step-text-${g.id}" data-step-input="${g.id}" placeholder="Новый шаг..." maxlength="200">
       <input name="step-result-${g.id}" data-step-result="${g.id}" placeholder="Результат (что должно получиться)" maxlength="200">
       <input name="step-dl-${g.id}" type="date" data-step-deadline="${g.id}" title="Дедлайн (обязательно)">
       <button onclick="event.stopPropagation(); addStep('${g.id}')">+</button>
     </div>`;

    const bodyHtml = expandedGoals.has(g.id) ? `
      <div class="goal-body">
        <div class="goal-body-inner">
          ${stepsHtml}
          ${addStepHtml}
        </div>
      </div>` : '';

    el.innerHTML = `
      <div class="goal-head">
        <button class="goal-check${g.done ? ' done' : ''}" onclick="event.stopPropagation(); toggleGoalDone('${g.id}')"></button>
        <div class="goal-main" onclick="toggleExpandGoal('${g.id}')">
          <div class="goal-name">${escapeHtml(g.text)}</div>
          <div class="goal-meta">${progressPill}${deadlineHtml}</div>
        </div>
        <button class="goal-expand${expandedGoals.has(g.id) ? ' open' : ''}" onclick="event.stopPropagation(); toggleExpandGoal('${g.id}')" title="развернуть">▼</button>
        <button class="goal-del" onclick="event.stopPropagation(); delGoal('${g.id}')" title="удалить">✕</button>
      </div>
      ${bodyHtml}`;
    list.appendChild(el);
  });

  document.querySelectorAll('[data-step-input]').forEach(inp => {
    inp.addEventListener('keydown', e => {
      if(e.key === 'Enter'){ addStep(inp.dataset.stepInput); }
    });
  });
  document.querySelectorAll('[data-substep-input]').forEach(inp => {
    inp.addEventListener('keydown', e => {
      if(e.key === 'Enter'){
        const parts = inp.dataset.substepInput.split(':');
        addSubstep(parts[0], parts[1]);
      }
    });
  });
}

function renderStep(goalId, s){
  const subs = s.substeps || [];
  const hasSubs = subs.length > 0;
  const effStatus = stepEffectiveStatus(s);
  const stepKey = goalId + ':' + s.id;
  const isOpen = expandedSteps.has(stepKey);

  const dlValue = s.deadline || '';

  const dateEl = `<input name="step-date-${s.id}" type="date" class="step-date" value="${dlValue}"
      onclick="event.stopPropagation()"
      onchange="setStepDeadline('${goalId}','${s.id}', this.value)">`;

  const resultValue = s.result || '';
  const resultEl = `<div class="step-result-edit" onclick="event.stopPropagation()">
       <span class="step-result-label">Результат:</span>
       <input class="step-result-input" type="text" value="${escapeHtml(resultValue)}"
         onclick="event.stopPropagation()"
         onchange="setStepResult('${goalId}','${s.id}', this.value)"
         placeholder="Результат (что должно получиться)">
     </div>`;

  const subsHtml = subs.map(ss => renderSubstep(goalId, s.id, ss)).join('');
  const closedCount = subs.filter(x => x.status === 'done').length;

  const checkEl = hasSubs
    ? `<div class="step-check step-auto ${effStatus}" title="статус считается от подшагов"></div>`
    : `<button class="step-check${s.status === 'done' ? ' done' : ''}" onclick="event.stopPropagation(); toggleStep('${goalId}','${s.id}')"></button>`;

  const countEl = hasSubs ? `<span class="step-count">${closedCount}/${subs.length}</span>` : '';

  const toggleBtn = hasSubs
    ? `<button class="step-expand${isOpen ? ' open' : ''}" onclick="event.stopPropagation(); toggleExpandStep('${goalId}','${s.id}')" title="подшаги">▼</button>`
    : `<button class="step-add-sub${isOpen ? ' open' : ''}" onclick="event.stopPropagation(); toggleExpandStep('${goalId}','${s.id}')" title="Добавить подшаги">+↳</button>`;

  const delBtn = `<button class="step-del" onclick="event.stopPropagation(); delStep('${goalId}','${s.id}')" title="удалить">✕</button>`;

  const stepClass = [
    'step',
    hasSubs ? 'step-container' : '',
    (!hasSubs && s.status === 'done') ? 'done' : '',
    (hasSubs && effStatus === 'done') ? 'done' : ''
  ].filter(Boolean).join(' ');

  const subsAddHtml = `<div class="substep-add">
     <input name="substep-text-${stepKey}" data-substep-input="${stepKey}" placeholder="Новый подшаг..." maxlength="200">
     <input name="substep-dl-${stepKey}" type="date" data-substep-deadline="${stepKey}" title="Дедлайн (обязательно)">
     <button onclick="event.stopPropagation(); addSubstep('${goalId}','${s.id}')">+</button>
   </div>`;

  const subsBlock = isOpen ? `
    <div class="substeps-wrap open">
      ${subsHtml}
      ${subsAddHtml}
    </div>` : '';

  return `
    <div class="${stepClass}">
      ${checkEl}
      <div class="step-content">
        <div class="step-text">${escapeHtml(s.text)}</div>
        ${resultEl}
      </div>
      ${countEl}
      ${dateEl}
      ${toggleBtn}
      ${delBtn}
    </div>
    ${subsBlock}`;
}

function renderSubstep(goalId, stepId, ss){
  const done = ss.status === 'done';
  const dlValue = ss.deadline || '';

  const dateEl = `<input name="substep-date-${ss.id}" type="date" class="substep-date" value="${dlValue}"
      onclick="event.stopPropagation()"
      onchange="setSubstepDeadline('${goalId}','${stepId}','${ss.id}', this.value)">`;

  const delBtn = `<button class="substep-del" onclick="event.stopPropagation(); delSubstep('${goalId}','${stepId}','${ss.id}')" title="удалить">✕</button>`;

  return `
    <div class="substep${done ? ' done' : ''}">
      <button class="substep-check${done ? ' done' : ''}" onclick="event.stopPropagation(); toggleSubstep('${goalId}','${stepId}','${ss.id}')"></button>
      <div class="substep-text">${escapeHtml(ss.text)}</div>
      ${dateEl}
      ${delBtn}
    </div>`;
}
