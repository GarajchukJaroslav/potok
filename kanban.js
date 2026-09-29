/* ==================================================================
   КАНБАН — вид на шаги целей
   Задачи создаются в Целях (шаги), тут только перемещаются.
================================================================== */

const KANBAN_COLS = [
  { key: 'todo',  title: 'Сделать' },
  { key: 'doing', title: 'В процессе' },
  { key: 'done',  title: 'Сделано' }
];

function collectKanbanTasks(){
  const tasks = [];
  goals.forEach(g => {
    if(g.done) return; // цели помеченные done не показываем
    (g.steps || []).forEach(s => {
      tasks.push({
        goalId: g.id,
        goalText: g.text,
        stepId: s.id,
        text: s.text,
        status: s.status || 'todo',
        deadline: s.deadline || g.deadline || null
      });
    });
  });
  // сортировка: сначала с дедлайном (по возрастанию), потом без
  tasks.sort((a, b) => {
    if(a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if(a.deadline) return -1;
    if(b.deadline) return 1;
    return 0;
  });
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
  const dlHtml = dl ? `<span class="deadline-badge ${dl.level}">📅 ${dl.text}</span>` : '<span></span>';
  const cardClass = (dl && !isDone) ? `dl-${dl.level}` : '';
  const canLeft = colKey !== 'todo';
  const canRight = colKey !== 'done';
  const goalShort = t.goalText.length > 50 ? t.goalText.slice(0, 50) + '…' : t.goalText;

  return `
    <div class="kanban-card ${cardClass}">
      <div class="kanban-card-text">${escapeHtml(t.text)}</div>
      <div class="kanban-card-goal">🎯 ${escapeHtml(goalShort)}</div>
      <div class="kanban-card-foot">
        ${dlHtml}
        <div class="kanban-card-actions">
          <button class="kb-btn" ${canLeft ? '' : 'disabled'}
                  onclick="moveTask('${t.goalId}','${t.stepId}', -1)" title="Влево">←</button>
          <button class="kb-btn" ${canRight ? '' : 'disabled'}
                  onclick="moveTask('${t.goalId}','${t.stepId}', 1)" title="Вправо">→</button>
        </div>
      </div>
    </div>`;
}

function moveTask(goalId, stepId, direction){
  const g = goals.find(x => x.id === goalId);
  if(!g) return;
  const s = g.steps.find(x => x.id === stepId);
  if(!s) return;
  const order = ['todo', 'doing', 'done'];
  const cur = order.indexOf(s.status || 'todo');
  const next = Math.max(0, Math.min(order.length - 1, cur + direction));
  if(next === cur) return;
  const prev = order[cur];
  s.status = order[next];
  if(s.status === 'done') s.lastStatus = prev;
  store.set('goals', goals);
  renderKanban();
  renderGoalList();
}
