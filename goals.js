/* ==================================================================
   ЭКРАН «ЦЕЛИ» — цель → шаг → подшаг
================================================================== */

let expandedGoals = new Set(store.get('expandedGoals', []));
let expandedSteps = new Set(store.get('expandedSteps', []));

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
  goals.push({
    id: uid(),
    text: v,
    done: false,
    deadline,
    steps: [],
    date: new Date().toISOString()
  });
  inp.value = '';
  if(dlInp) dlInp.value = '';
  store.set('goals', goals);
  renderGoalList();
  if(typeof renderKanban === 'function') renderKanban();
  inp.focus();
}

function toggleGoalDone(id){
  const g = goals.find(x => x.id === id);
  if(!g) return;
  g.done = !g.done;
  store.set('goals', goals);
  renderGoalList();
  if(typeof renderKanban === 'function') renderKanban();
}

function delGoal(id){
  if(!confirm('Удалить цель со всеми шагами и подшагами?')) return;
  goals = goals.filter(x => x.id !== id);
  store.set('goals', goals);
  renderGoalList();
  if(typeof renderKanban === 'function') renderKanban();
}

function setGoalDeadline(goalId, value){
  const g = goals.find(x => x.id === goalId);
  if(!g) return;
  if(!value){ renderGoalList(); return; }
  g.deadline = value;
  store.set('goals', goals);
  renderGoalList();
  if(typeof renderKanban === 'function') renderKanban();
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
  if(!inp) return;
  const v = inp.value.trim();
  const deadline = dlInp ? dlInp.value : '';
  if(!v) return;
  if(!deadline){
    alert('Укажи дедлайн шага');
    if(dlInp) dlInp.focus();
    return;
  }
  const g = goals.find(x => x.id === goalId);
  if(!g) return;
  if(!Array.isArray(g.steps)) g.steps = [];
  g.steps.push({
    id: uid(),
    text: v,
    status: 'todo',
    lastStatus: 'todo',
    deadline,
    substeps: []
  });
  inp.value = '';
  if(dlInp) dlInp.value = '';
  store.set('goals', goals);
  renderGoalList();
  if(typeof renderKanban === 'function') renderKanban();
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
  // если шаг-контейнер (есть подшаги) — клик не работает
  if(s.substeps && s.substeps.length > 0) return;
  if(s.status === 'done'){
    s.status = s.lastStatus || 'todo';
  } else {
    s.lastStatus = s.status || 'todo';
    s.status = 'done';
  }
  store.set('goals', goals);
  renderGoalList();
  if(typeof renderKanban === 'function') renderKanban();
}

function delStep(goalId, stepId){
  const g = goals.find(x => x.id === goalId);
  if(!g) return;
  g.steps = g.steps.filter(x => x.id !== stepId);
  store.set('goals', goals);
  renderGoalList();
  if(typeof renderKanban === 'function') renderKanban();
}

function setStepDeadline(goalId, stepId, value){
  const g = goals.find(x => x.id === goalId);
  if(!g) return;
  const s = g.steps.find(x => x.id === stepId);
  if(!s) return;
  if(!value){ renderGoalList(); return; }
  s.deadline = value;
  store.set('goals', goals);
  renderGoalList();
  if(typeof renderKanban === 'function') renderKanban();
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

/* Превращает leaf-шаг в контейнер (создаёт первый подшаг через инпут) */
function openAddSubstep(goalId, stepId){
  const key = goalId + ':' + stepId;
  expandedSteps.add(key);
  store.set('expandedSteps', [...expandedSteps]);
  renderGoalList();
  setTimeout(() => {
    const inp = document.querySelector(`[data-substep-input="${key}"]`);
    if(inp) inp.focus();
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
  s.substeps.push({
    id: uid(),
    text: v,
    status: 'todo',
    lastStatus: 'todo',
    deadline
  });
  inp.value = '';
  if(dlInp) dlInp.value = '';
  store.set('goals', goals);
  renderGoalList();
  if(typeof renderKanban === 'function') renderKanban();
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
  if(typeof renderKanban === 'function') renderKanban();
}

function delSubstep(goalId, stepId, substepId){
  const g = goals.find(x => x.id === goalId);
  if(!g) return;
  const s = g.steps.find(x => x.id === stepId);
  if(!s) return;
  s.substeps = s.substeps.filter(x => x.id !== substepId);
  store.set('goals', goals);
  renderGoalList();
  if(typeof renderKanban === 'function') renderKanban();
}

function setSubstepDeadline(goalId, stepId, substepId, value){
  const g = goals.find(x => x.id === goalId);
  if(!g) return;
  const s = g.steps.find(x => x.id === stepId);
  if(!s) return;
  const ss = s.substeps.find(x => x.id === substepId);
  if(!ss) return;
  if(!value){ renderGoalList(); return; }
  ss.deadline = value;
  store.set('goals', goals);
  renderGoalList();
  if(typeof renderKanban === 'function') renderKanban();
}

/* ---------- РЕНДЕР ---------- */
function renderGoalList(){
  const list = document.getElementById('goalList');
  if(!list) return;
  list.innerHTML = '';

  if(goals.length === 0){
    list.innerHTML = `<div class="empty"><span class="empty-icon">🎯</span>Пока пусто.<br>Добавь первую глобальную цель.</div>`;
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

    const bodyHtml = expandedGoals.has(g.id) ? `
      <div class="goal-body">
        <div class="goal-body-inner">
          ${stepsHtml}
          <div class="step-add">
            <input data-step-input="${g.id}" placeholder="Новый шаг..." maxlength="200">
            <input type="date" data-step-deadline="${g.id}" title="Дедлайн (обязательно)">
            <button onclick="event.stopPropagation(); addStep('${g.id}')">+</button>
          </div>
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

  // Enter на инпутах шагов
  document.querySelectorAll('[data-step-input]').forEach(inp => {
    inp.addEventListener('keydown', e => {
      if(e.key === 'Enter'){ addStep(inp.dataset.stepInput); }
    });
  });
  // Enter на инпутах подшагов
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
  const isContainer = subs.length > 0;
  const effStatus = stepEffectiveStatus(s);
  const stepKey = goalId + ':' + s.id;
  const isOpen = expandedSteps.has(stepKey);

  const dlValue = s.deadline || '';
  const dateInput = `<input type="date" class="step-date" value="${dlValue}"
    onclick="event.stopPropagation()"
    onchange="setStepDeadline('${goalId}','${s.id}', this.value)">`;

  if(isContainer){
    const subsHtml = subs.map(ss => renderSubstep(goalId, s.id, ss)).join('');
    const closedCount = subs.filter(x => x.status === 'done').length;

    return `
      <div class="step step-container ${effStatus === 'done' ? 'done' : ''}">
        <div class="step-check step-auto ${effStatus}" title="статус считается от подшагов"></div>
        <div class="step-text">${escapeHtml(s.text)}</div>
        <span class="step-count">${closedCount}/${subs.length}</span>
        ${dateInput}
        <button class="step-expand${isOpen ? ' open' : ''}" onclick="event.stopPropagation(); toggleExpandStep('${goalId}','${s.id}')" title="подшаги">▼</button>
        <button class="step-del" onclick="event.stopPropagation(); delStep('${goalId}','${s.id}')" title="удалить">✕</button>
      </div>
      <div class="substeps-wrap${isOpen ? ' open' : ''}">
        ${subsHtml}
        <div class="substep-add">
          <input data-substep-input="${stepKey}" placeholder="Новый подшаг..." maxlength="200">
          <input type="date" data-substep-deadline="${stepKey}" title="Дедлайн (обязательно)">
          <button onclick="event.stopPropagation(); addSubstep('${goalId}','${s.id}')">+</button>
        </div>
      </div>`;
  }

  // leaf-шаг
  return `
    <div class="step${s.status === 'done' ? ' done' : ''}">
      <button class="step-check${s.status === 'done' ? ' done' : ''}" onclick="event.stopPropagation(); toggleStep('${goalId}','${s.id}')"></button>
      <div class="step-text">${escapeHtml(s.text)}</div>
      ${dateInput}
      <button class="step-add-sub" onclick="event.stopPropagation(); openAddSubstep('${goalId}','${s.id}')" title="Добавить подшаги">+↳</button>
      <button class="step-del" onclick="event.stopPropagation(); delStep('${goalId}','${s.id}')" title="удалить">✕</button>
    </div>`;
}

function renderSubstep(goalId, stepId, ss){
  const done = ss.status === 'done';
  const dlValue = ss.deadline || '';
  return `
    <div class="substep${done ? ' done' : ''}">
      <button class="substep-check${done ? ' done' : ''}" onclick="event.stopPropagation(); toggleSubstep('${goalId}','${stepId}','${ss.id}')"></button>
      <div class="substep-text">${escapeHtml(ss.text)}</div>
      <input type="date" class="substep-date" value="${dlValue}"
        onclick="event.stopPropagation()"
        onchange="setSubstepDeadline('${goalId}','${stepId}','${ss.id}', this.value)">
      <button class="substep-del" onclick="event.stopPropagation(); delSubstep('${goalId}','${stepId}','${ss.id}')" title="удалить">✕</button>
    </div>`;
}
