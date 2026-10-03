/* ==================================================================
   ЭКРАН «ЦЕЛИ» — цель → шаг → подшаг + режим СТАРТ
================================================================== */

let expandedGoals = new Set(store.get('expandedGoals', []));
let expandedSteps = new Set(store.get('expandedSteps', []));

/* ---------- СТАРТ СИСТЕМЫ ---------- */
function startPotok(){
  if(goals.length === 0 && habits.length === 0){
    alert('Создай хотя бы одну цель или привычку, прежде чем стартовать');
    return;
  }
  if(!confirm('Точно стартовать?\n\nПосле старта нельзя будет:\n— создавать новые цели/шаги/подшаги/привычки\n— менять дедлайны\n— удалять что-либо\n\nВсё это — только через Анализ → Действия.')){
    return;
  }
  potokStarted = true;
  store.set('potokStarted', true);
  renderStartBlock();
  renderGoalList();
  renderHabits();
  renderKanban();
  if(typeof renderChecklist === 'function') renderChecklist();
  if(typeof renderAnalysis === 'function') renderAnalysis();
}

function renderStartBlock(){
  const el = document.getElementById('startBlock');
  if(!el) return;

  if(isStarted()){
    el.innerHTML = `
      <div class="start-status">
        <span class="dot"></span>
        СИСТЕМА ЗАПУЩЕНА · выполнение активно
      </div>
    `;
  } else {
    el.innerHTML = `
      <button class="start-btn" onclick="startPotok()">
        <span class="start-icon">▶</span>
        СТАРТ
      </button>
      <div class="start-hint">
        Спланируй цели, шаги и привычки, выставь дедлайны.<br>
        После СТАРТА план замораживается — можно только выполнять.
      </div>
    `;
  }

  const bar = document.getElementById('goalsBar');
  if(bar) bar.style.display = isStarted() ? 'none' : 'flex';
}

/* ---------- ЦЕЛЬ ---------- */
function addGoal(){
  if(!canPlan()){ blockedAfterStart(); return; }
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
  if(!canExecute()){ blockedBeforeStart(); return; }
  const g = goals.find(x => x.id === id);
  if(!g) return;
  g.done = !g.done;
  store.set('goals', goals);
  renderGoalList();
  if(typeof renderKanban === 'function') renderKanban();
}

function delGoal(id){
  if(!canPlan()){ blockedAfterStart(); return; }
  if(!confirm('Удалить цель со всеми шагами и подшагами?')) return;
  goals = goals.filter(x => x.id !== id);
  store.set('goals', goals);
  renderGoalList();
  if(typeof renderKanban === 'function') renderKanban();
}

function setGoalDeadline(goalId, value){
  if(!canPlan()){ renderGoalList(); return; }
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
  if(canPlan()){
    setTimeout(() => {
      const inp = document.querySelector(`[data-step-input="${id}"]`);
      if(inp && expandedGoals.has(id)) inp.focus();
    }, 30);
  }
}

/* ---------- ШАГ ---------- */
function addStep(goalId){
  if(!canPlan()){ blockedAfterStart(); return; }
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
  if(!canExecute()){ blockedBeforeStart(); return; }
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
  store.set('goals', goals);
  renderGoalList();
  if(typeof renderKanban === 'function') renderKanban();
}

function delStep(goalId, stepId){
  if(!canPlan()){ blockedAfterStart(); return; }
  const g = goals.find(x => x.id === goalId);
  if(!g) return;
  g.steps = g.steps.filter(x => x.id !== stepId);
  const key = goalId + ':' + stepId;
  if(expandedSteps.has(key)){ expandedSteps.delete(key); store.set('expandedSteps', [...expandedSteps]); }
  store.set('goals', goals);
  renderGoalList();
  if(typeof renderKanban === 'function') renderKanban();
}

function setStepDeadline(goalId, stepId, value){
  if(!canPlan()){ renderGoalList(); return; }
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
  if(canPlan()){
    setTimeout(() => {
      const inp = document.querySelector(`[data-substep-input="${key}"]`);
      if(inp && expandedSteps.has(key)) inp.focus();
    }, 30);
  }
}

/* ---------- ПОДШАГ ---------- */
function addSubstep(goalId, stepId){
  if(!canPlan()){ blockedAfterStart(); return; }
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
  if(!canExecute()){ blockedBeforeStart(); return; }
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
  if(!canPlan()){ blockedAfterStart(); return; }
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
  if(!canPlan()){ renderGoalList(); return; }
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

  const locked = isStarted();

  if(goals.length === 0){
    list.innerHTML = `<div class="empty"><span class="empty-icon">🎯</span>Пока пусто.<br>Добавь первую цель — и нажми СТАРТ, когда спланируешь.</div>`;
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

    const addStepHtml = locked
      ? `<div class="locked-hint">Новые шаги — только через Анализ → Действия</div>`
      : `<div class="step-add">
           <input name="step-text-${g.id}" data-step-input="${g.id}" placeholder="Новый шаг..." maxlength="200">
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

    const delBtn = locked
      ? ''
      : `<button class="goal-del" onclick="event.stopPropagation(); delGoal('${g.id}')" title="удалить">✕</button>`;

    el.innerHTML = `
      <div class="goal-head">
        <button class="goal-check${g.done ? ' done' : ''}" onclick="event.stopPropagation(); toggleGoalDone('${g.id}')"></button>
        <div class="goal-main" onclick="toggleExpandGoal('${g.id}')">
          <div class="goal-name">${escapeHtml(g.text)}</div>
          <div class="goal-meta">${progressPill}${deadlineHtml}</div>
        </div>
        <button class="goal-expand${expandedGoals.has(g.id) ? ' open' : ''}" onclick="event.stopPropagation(); toggleExpandGoal('${g.id}')" title="развернуть">▼</button>
        ${delBtn}
      </div>
      ${bodyHtml}`;
    list.appendChild(el);
  });

  if(!locked){
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
}

function renderStep(goalId, s){
  const locked = isStarted();
  const subs = s.substeps || [];
  const hasSubs = subs.length > 0;
  const effStatus = stepEffectiveStatus(s);
  const stepKey = goalId + ':' + s.id;
  const isOpen = expandedSteps.has(stepKey);

  const dlValue = s.deadline || '';
  const dlInfo = deadlineInfo(dlValue);
  const dlText = dlInfo ? dlInfo.text : '—';

  const dateEl = locked
    ? `<span class="step-date-static">${dlText}</span>`
    : `<input name="step-date-${s.id}" type="date" class="step-date" value="${dlValue}"
        onclick="event.stopPropagation()"
        onchange="setStepDeadline('${goalId}','${s.id}', this.value)">`;

  const subsHtml = subs.map(ss => renderSubstep(goalId, s.id, ss)).join('');
  const closedCount = subs.filter(x => x.status === 'done').length;

  const checkEl = hasSubs
    ? `<div class="step-check step-auto ${effStatus}" title="статус считается от подшагов"></div>`
    : `<button class="step-check${s.status === 'done' ? ' done' : ''}" onclick="event.stopPropagation(); toggleStep('${goalId}','${s.id}')"></button>`;

  const countEl = hasSubs ? `<span class="step-count">${closedCount}/${subs.length}</span>` : '';

  const toggleBtn = hasSubs
    ? `<button class="step-expand${isOpen ? ' open' : ''}" onclick="event.stopPropagation(); toggleExpandStep('${goalId}','${s.id}')" title="подшаги">▼</button>`
    : (locked
        ? ''
        : `<button class="step-add-sub${isOpen ? ' open' : ''}" onclick="event.stopPropagation(); toggleExpandStep('${goalId}','${s.id}')" title="Добавить подшаги">+↳</button>`);

  const delBtn = locked
    ? ''
    : `<button class="step-del" onclick="event.stopPropagation(); delStep('${goalId}','${s.id}')" title="удалить">✕</button>`;

  const stepClass = [
    'step',
    hasSubs ? 'step-container' : '',
    (!hasSubs && s.status === 'done') ? 'done' : '',
    (hasSubs && effStatus === 'done') ? 'done' : ''
  ].filter(Boolean).join(' ');

  const subsAddHtml = locked
    ? `<div class="locked-hint">Новые подшаги — только через Анализ</div>`
    : `<div class="substep-add">
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
      <div class="step-text">${escapeHtml(s.text)}</div>
      ${countEl}
      ${dateEl}
      ${toggleBtn}
      ${delBtn}
    </div>
    ${subsBlock}`;
}

function renderSubstep(goalId, stepId, ss){
  const locked = isStarted();
  const done = ss.status === 'done';
  const dlValue = ss.deadline || '';
  const dlInfo = deadlineInfo(dlValue);
  const dlText = dlInfo ? dlInfo.text : '—';

  const dateEl = locked
    ? `<span class="substep-date-static">${dlText}</span>`
    : `<input name="substep-date-${ss.id}" type="date" class="substep-date" value="${dlValue}"
        onclick="event.stopPropagation()"
        onchange="setSubstepDeadline('${goalId}','${stepId}','${ss.id}', this.value)">`;

  const delBtn = locked
    ? ''
    : `<button class="substep-del" onclick="event.stopPropagation(); delSubstep('${goalId}','${stepId}','${ss.id}')" title="удалить">✕</button>`;

  return `
    <div class="substep${done ? ' done' : ''}">
      <button class="substep-check${done ? ' done' : ''}" onclick="event.stopPropagation(); toggleSubstep('${goalId}','${stepId}','${ss.id}')"></button>
      <div class="substep-text">${escapeHtml(ss.text)}</div>
      ${dateEl}
      ${delBtn}
    </div>`;
}
