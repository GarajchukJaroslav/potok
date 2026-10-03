/* ==================================================================
   КАНБАН — плоский список leaf-задач (шаги без подшагов + подшаги)
   Сортировка по дедлайну (срочные сверху)
================================================================== */

const KANBAN_COLS = [
  { key: 'todo',  title: 'Сделать' },
  { key: 'doing', title: 'В процессе' },
  { key: 'done',  title: 'Сделано' }
];

function collectKanbanTasks(){
  const tasks = [];
  goals.forEach(g => {
    if(g.done) return;
    (g.steps || []).forEach(step => {
      const subs = step.substeps || [];
      if(subs.length > 0){
        // контейнер — показываем подшаги
        subs.forEach(ss => {
          tasks.push({
            goalId: g.id,
            stepId: step.id,
            substepId: ss.id,
            text: ss.text,
            status: ss.status || 'todo',
            deadline: ss.deadline || null,
            breadcrumb: g.text + ' → ' + step.text
          });
        });
      } else {
        // leaf-шаг — показываем сам шаг
        tasks.push({
          goalId: g.id,
          stepId: step.id,
          substepId: null,
          text: step.text,
          status: step.status || 'todo',
          deadline: step.deadline || null,
          breadcrumb: g.text
        });
      }
    });
  });

  // сортировка: срочные сверху, без дедлайна — вниз
  tasks.sort((a, b) => deadlineTime(a.deadline) - deadlineTime(b.deadline));
  return tasks;
}

function renderKanban(){
  const el = document.getElementById('kanban');
  if(!el) return;

  const tasks = collectKanbanTasks();

  if(tasks.length === 0){
    el.innerHTML = `
      <div class="empty" style="grid-column: 1 / -1;">
        <span class="empty-icon">📋</span>
        Задач пока нет.<br>
        Добавь шаги к целям — они появятся здесь автоматически.
      </div>`;
    return;
  }

  el.innerHTML = KANBAN_COLS.map(col => {
    const colTasks = tasks.filter(t => t.status === col.key);
    const body = colTasks.length === 0
      ? `<div class="kanban-empty">—</div>`
      : colTasks.map(t => kanbanCard(t, col.key)).join('');
    return `
      <div class="kanban-col">
        <div class="kanban-col-head">
          <span class="kanban-col-title">${col.title}</span>
          <span class="kanban-col-count">${colTasks.length}</span>
        </div>
        <div class="kanban-col-body">${body}</div>
      </div>`;
  }).join('');
}

function kanbanCard(t, colKey){
  const dl = deadlineInfo(t.deadline);
  const isDone = colKey === 'done';
  const dlHtml = dl
    ? `<span class="deadline-badge ${dl.level}">📅 ${dl.text}</span>`
    : '<span></span>';
  const cardClass = (dl && !isDone) ? `dl-${dl.level}` : '';
  const canLeft = colKey !== 'todo';
  const canRight = colKey !== 'done';
  const crumb = t.breadcrumb.length > 55 ? t.breadcrumb.slice(0, 55) + '…' : t.breadcrumb;
  const sid = t.substepId ? `'${t.substepId}'` : 'null';

  return `
    <div class="kanban-card ${cardClass}">
      <div class="kanban-card-text">${escapeHtml(t.text)}</div>
      <div class="kanban-card-goal">🎯 ${escapeHtml(crumb)}</div>
      <div class="kanban-card-foot">
        ${dlHtml}
        <div class="kanban-card-actions">
          <button class="kb-btn" ${canLeft ? '' : 'disabled'}
                  onclick="moveTask('${t.goalId}','${t.stepId}', ${sid}, -1)" title="Влево">←</button>
          <button class="kb-btn" ${canRight ? '' : 'disabled'}
                  onclick="moveTask('${t.goalId}','${t.stepId}', ${sid}, 1)" title="Вправо">→</button>
        </div>
      </div>
    </div>`;
}

function moveTask(goalId, stepId, substepId, direction){
  if(!canExecute()){ blockedBeforeStart(); return; } 
  const g = goals.find(x => x.id === goalId);
  if(!g) return;
  const step = g.steps.find(x => x.id === stepId);
  if(!step) return;

  let entity;
  if(substepId){
    entity = (step.substeps || []).find(x => x.id === substepId);
  } else {
    entity = step;
  }
  if(!entity) return;

  const order = ['todo', 'doing', 'done'];
  const cur = order.indexOf(entity.status || 'todo');
  const next = Math.max(0, Math.min(order.length - 1, cur + direction));
  if(next === cur) return;

  const prev = order[cur];
  entity.status = order[next];
  if(entity.status === 'done') entity.lastStatus = prev;

  store.set('goals', goals);
  renderKanban();
  renderGoalList();
}
