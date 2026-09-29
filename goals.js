/* ==================================================================
   ЭКРАН «ЦЕЛИ» + ДЕДЛАЙНЫ
================================================================== */

let expandedGoals = new Set(store.get('expandedGoals', []));

function addGoal(){
  const inp = document.getElementById('goalInput');
  const dlInp = document.getElementById('goalDeadline');
  const v = inp.value.trim();
  if(!v) return;
  const deadline = (dlInp && dlInp.value) ? dlInp.value : null;
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
  if(!confirm('Удалить цель и все её шаги?')) return;
  goals = goals.filter(x => x.id !== id);
  store.set('goals', goals);
  renderGoalList();
  if(typeof renderKanban === 'function') renderKanban();
}

function setGoalDeadline(goalId, value){
  const g = goals.find(x => x.id === goalId);
  if(!g) return;
  g.deadline = value || null;
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

function addStep(goalId){
  const inp = document.querySelector(`[data-step-input="${goalId}"]`);
  const dlInp = document.querySelector(`[data-step-deadline="${goalId}"]`);
  if(!inp) return;
  const v = inp.value.trim();
  if(!v) return;
  const g = goals.find(x => x.id === goalId);
  if(!g) return;
  if(!Array.isArray(g.steps)) g.steps = [];
  g.steps.push({
    id: uid(),
    text: v,
    status: 'todo',
    lastStatus: 'todo',
    deadline: (dlInp && dlInp.value) ? dlInp.value : null
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
  s.deadline = value || null;
  store.set('goals', goals);
  renderGoalList();
  if(typeof renderKanban === 'function') renderKanban();
}

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
    const total = (g.steps || []).length;
    const doneSteps = (g.steps || []).filter(s => s.status === 'done').length;
    const allStepsDone = total > 0 && doneSteps === total;
    const isExpanded = expandedGoals.has(g.id);

    const el = document.createElement('div');
    el.className = 'goal';
    if(g.done) el.classList.add('done');
    if(isExpanded) el.classList.add('expanded');

    const stepsHtml = (g.steps || []).map(s => `
      <div class="step${s.status === 'done' ? ' done' : ''}">
        <button class="step-check${s.status === 'done' ? ' done' : ''}" onclick="event.stopPropagation(); toggleStep('${g.id}','${s.id}')"></button>
        <div class="step-text">${escapeHtml(s.text)}</div>
        <input type="date" class="step-date" value="${s.deadline || ''}"
               onclick="event.stopPropagation()"
               onchange="setStepDeadline('${g.id}','${s.id}', this.value)"
               title="Дедлайн шага">
        <button class="step-del" onclick="event.stopPropagation(); delStep('${g.id}','${s.id}')" title="удалить">✕</button>
      </div>
    `).join('');

    const progressPill = total > 0
      ? `<span class="goal-progress-pill${allStepsDone ? ' complete' : ''}">${doneSteps} / ${total} ${allStepsDone ? '✓' : ''}</span>`
      : `<span class="goal-progress-pill" style="background:rgba(255,255,255,0.05); border-color:var(--border); color:var(--muted);">шагов нет</span>`;

    const dl = deadlineInfo(g.deadline);
    const deadlineHtml = dl
      ? `<span class="deadline-badge ${dl.level}">📅 ${dl.text}</span>`
      : '';

    const bodyHtml = isExpanded ? `
      <div class="goal-body">
        <div class="goal-body-inner">
          ${stepsHtml}
          <div class="step-add">
            <input data-step-input="${g.id}" placeholder="Новый шаг..." maxlength="200">
            <input type="date" data-step-deadline="${g.id}" title="Дедлайн">
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
        <button class="goal-expand${isExpanded ? ' open' : ''}" onclick="event.stopPropagation(); toggleExpandGoal('${g.id}')" title="развернуть">▼</button>
        <button class="goal-del" onclick="event.stopPropagation(); delGoal('${g.id}')" title="удалить">✕</button>
      </div>
      ${bodyHtml}`;
    list.appendChild(el);
  });

  document.querySelectorAll('[data-step-input]').forEach(inp => {
    inp.addEventListener('keydown', e => {
      if(e.key === 'Enter'){
        const gid = inp.dataset.stepInput;
        addStep(gid);
      }
    });
  });
}
