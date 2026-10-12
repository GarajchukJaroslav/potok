/* ==================================================================
   ЭКРАН «ПРОЕКТЫ» — точка А → вехи → точка B
   Полностью без запретов. Все изменения — в журнал.
================================================================== */

let expandedProjects = new Set(store.get('expandedProjects', []));

/* ---------- ПРОЕКТ ---------- */
function addProject(){
  const titleInp = document.getElementById('projectTitle');
  const pointAInp = document.getElementById('projectPointA');
  const startInp = document.getElementById('projectStart');
  const endInp = document.getElementById('projectEnd');

  const title = titleInp ? titleInp.value.trim() : '';
  const pointA = pointAInp ? pointAInp.value.trim() : '';
  const startDate = startInp ? startInp.value : '';
  const endDate = endInp ? endInp.value : '';

  if(!title){ alert('Напиши, куда идём (точка B)'); if(titleInp) titleInp.focus(); return; }
  if(!startDate){ alert('Укажи дату старта'); if(startInp) startInp.focus(); return; }
  if(!endDate){ alert('Укажи дату финиша'); if(endInp) endInp.focus(); return; }
  if(endDate < startDate){ alert('Финиш раньше старта'); return; }

  const project = {
    id: uid(),
    title,
    pointA,
    startDate,
    endDate,
    milestones: [],
    notes: [],
    done: false,
    createdAt: new Date().toISOString()
  };
  goals.push(project);

  logAction('project_created', {
    kind: 'project', id: project.id, name: project.title
  }, { startDate, endDate, pointA });

  if(titleInp) titleInp.value = '';
  if(pointAInp) pointAInp.value = '';
  if(startInp) startInp.value = '';
  if(endInp) endInp.value = '';

  store.set('goals', goals);
  renderGoalList();
  if(titleInp) titleInp.focus();
}

function delProject(id){
  const g = goals.find(x => x.id === id);
  if(!g) return;
  if(!confirm('Удалить проект со всеми вехами?')) return;
  logAction('project_deleted', {
    kind: 'project', id: g.id, name: g.title
  });
  goals = goals.filter(x => x.id !== id);
  store.set('goals', goals);
  renderGoalList();
}

function setProjectTitle(id, value){
  const g = goals.find(x => x.id === id);
  if(!g) return;
  if(!value) return;
  const before = g.title;
  g.title = value;
  logAction('project_title_changed', {
    kind: 'project', id: g.id, name: value
  }, { before, after: value });
  store.set('goals', goals);
  renderGoalList();
}

function setProjectPointA(id, value){
  const g = goals.find(x => x.id === id);
  if(!g) return;
  const before = g.pointA;
  g.pointA = value || '';
  logAction('project_point_a_changed', {
    kind: 'project', id: g.id, name: g.title
  }, { before, after: g.pointA });
  store.set('goals', goals);
  renderGoalList();
}

function setProjectStart(id, value){
  const g = goals.find(x => x.id === id);
  if(!g) return;
  if(!value) return;
  const before = g.startDate;
  g.startDate = value;
  logAction('project_start_changed', {
    kind: 'project', id: g.id, name: g.title
  }, { before, after: value });
  store.set('goals', goals);
  renderGoalList();
}

function setProjectEnd(id, value){
  const g = goals.find(x => x.id === id);
  if(!g) return;
  if(!value) return;
  const before = g.endDate;
  g.endDate = value;
  logAction('project_end_changed', {
    kind: 'project', id: g.id, name: g.title
  }, { before, after: value });
  store.set('goals', goals);
  renderGoalList();
}

function toggleExpandProject(id){
  if(expandedProjects.has(id)) expandedProjects.delete(id);
  else expandedProjects.add(id);
  store.set('expandedProjects', [...expandedProjects]);
  renderGoalList();
}

/* ---------- ВЕХА ---------- */
function addMilestone(projectId){
  const inp = document.querySelector(`[data-ms-input="${projectId}"]`);
  const dtInp = document.querySelector(`[data-ms-date="${projectId}"]`);
  if(!inp) return;
  const title = inp.value.trim();
  const date = dtInp ? dtInp.value : '';
  if(!title){ alert('Напиши название вехи'); inp.focus(); return; }
  if(!date){ alert('Укажи дату вехи'); if(dtInp) dtInp.focus(); return; }

  const g = goals.find(x => x.id === projectId);
  if(!g) return;
  if(!Array.isArray(g.milestones)) g.milestones = [];
  const ms = { id: uid(), title, date, status: 'todo' };
  g.milestones.push(ms);
  // сортировка по дате
  g.milestones.sort((a,b) => (a.date || '').localeCompare(b.date || ''));

  logAction('milestone_created', {
    kind: 'milestone', id: ms.id, name: ms.title,
    projectId: g.id
  }, { date });

  inp.value = '';
  if(dtInp) dtInp.value = '';
  store.set('goals', goals);
  renderGoalList();
  setTimeout(() => {
    const nInp = document.querySelector(`[data-ms-input="${projectId}"]`);
    if(nInp) nInp.focus();
  }, 30);
}

function toggleMilestone(projectId, msId){
  const g = goals.find(x => x.id === projectId);
  if(!g) return;
  const ms = (g.milestones || []).find(x => x.id === msId);
  if(!ms) return;
  ms.status = ms.status === 'done' ? 'todo' : 'done';
  store.set('goals', goals);
  renderGoalList();
}

function setMilestoneDoing(projectId, msId){
  const g = goals.find(x => x.id === projectId);
  if(!g) return;
  const ms = (g.milestones || []).find(x => x.id === msId);
  if(!ms) return;
  ms.status = ms.status === 'doing' ? 'todo' : 'doing';
  store.set('goals', goals);
  renderGoalList();
}

function delMilestone(projectId, msId){
  const g = goals.find(x => x.id === projectId);
  if(!g) return;
  const ms = (g.milestones || []).find(x => x.id === msId);
  if(!ms) return;
  logAction('milestone_deleted', {
    kind: 'milestone', id: ms.id, name: ms.title,
    projectId: g.id
  });
  g.milestones = g.milestones.filter(x => x.id !== msId);
  store.set('goals', goals);
  renderGoalList();
}

function setMilestoneTitle(projectId, msId, value){
  const g = goals.find(x => x.id === projectId);
  if(!g) return;
  const ms = (g.milestones || []).find(x => x.id === msId);
  if(!ms) return;
  if(!value) return;
  const before = ms.title;
  ms.title = value;
  logAction('milestone_title_changed', {
    kind: 'milestone', id: ms.id, name: value,
    projectId: g.id
  }, { before, after: value });
  store.set('goals', goals);
  renderGoalList();
}

function setMilestoneDate(projectId, msId, value){
  const g = goals.find(x => x.id === projectId);
  if(!g) return;
  const ms = (g.milestones || []).find(x => x.id === msId);
  if(!ms) return;
  if(!value) return;
  const before = ms.date;
  ms.date = value;
  // пересортировка
  g.milestones.sort((a,b) => (a.date || '').localeCompare(b.date || ''));
  logAction('milestone_date_changed', {
    kind: 'milestone', id: ms.id, name: ms.title,
    projectId: g.id
  }, { before, after: value });
  store.set('goals', goals);
  renderGoalList();
}

/* ---------- РЕНДЕР ---------- */
function renderGoalList(){
  const list = document.getElementById('goalList');
  if(!list) return;
  list.innerHTML = '';

  if(goals.length === 0){
    list.innerHTML = `<div class="empty">
      <span class="empty-icon">🛤</span>
      Пока пусто.<br>Добавь первый проект — куда идёшь и как.
    </div>`;
    return;
  }

  const sorted = [...goals].sort((a,b) => {
    if(a.done !== b.done) return a.done ? 1 : -1;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  sorted.forEach(g => list.appendChild(renderProjectCard(g)));
}

function renderProjectCard(g){
  const el = document.createElement('div');
  el.className = 'project';
  if(g.done) el.classList.add('done');
  if(expandedProjects.has(g.id)) el.classList.add('expanded');

  const { done, total } = projectProgress(g);
  const allDone = total > 0 && done === total;

  // ---- timeline ----
  const timelineHtml = renderTimeline(g);

  // ---- даты ----
  const startFmt = g.startDate ? deadlineInfo(g.startDate)?.text : '—';
  const endFmt = g.endDate ? deadlineInfo(g.endDate)?.text : '—';

  // ---- вехи ----
  const milestones = g.milestones || [];
  const msHtml = milestones.length === 0
    ? `<div class="ms-empty">Вех пока нет. Добавь первую — что должно случиться по пути.</div>`
    : milestones.map(m => renderMilestoneRow(g.id, m)).join('');

  const msAddHtml = `<div class="ms-add">
    <input class="ms-add-title" data-ms-input="${g.id}" placeholder="Новая веха..." maxlength="200">
    <input class="ms-add-date" data-ms-date="${g.id}" type="date">
    <button class="ms-add-btn" onclick="event.stopPropagation(); addMilestone('${g.id}')">+</button>
  </div>`;

  const expanded = expandedProjects.has(g.id);

  el.innerHTML = `
    <div class="project-head" onclick="toggleExpandProject('${g.id}')">
      <div class="project-main">
        <div class="project-title-row">
          <input class="project-title" value="${escapeHtml(g.title)}"
            onclick="event.stopPropagation()"
            onchange="setProjectTitle('${g.id}', this.value)"
            maxlength="200">
        </div>
        <div class="project-meta">
          <span class="project-points">${done} / ${total} вех</span>
          ${allDone ? '<span class="project-points done">✓ всё</span>' : ''}
          <span class="project-dates">📅 ${startFmt} → ${endFmt}</span>
        </div>
        ${g.pointA ? `<div class="project-point-a">A: ${escapeHtml(g.pointA)}</div>` : ''}
      </div>
      <button class="project-expand${expanded ? ' open' : ''}" onclick="event.stopPropagation(); toggleExpandProject('${g.id}')" title="развернуть">▼</button>
      <button class="project-del" onclick="event.stopPropagation(); delProject('${g.id}')" title="удалить">✕</button>
    </div>

    ${timelineHtml}

    ${expanded ? `
      <div class="project-body">
        <div class="project-point-a-edit">
          <span class="field-label">Точка А (откуда):</span>
          <input class="field-input" value="${escapeHtml(g.pointA || '')}"
            onchange="setProjectPointA('${g.id}', this.value)"
            placeholder="Опционально" maxlength="200">
        </div>
        <div class="project-dates-edit">
          <span class="field-label">Старт:</span>
          <input class="field-input small" type="date" value="${g.startDate || ''}"
            onchange="setProjectStart('${g.id}', this.value)">
          <span class="field-label">Финиш:</span>
          <input class="field-input small" type="date" value="${g.endDate || ''}"
            onchange="setProjectEnd('${g.id}', this.value)">
        </div>

        <div class="ms-list">${msHtml}</div>
        ${msAddHtml}
      </div>
    ` : ''}
  `;

  return el;
}

function renderTimeline(g){
  const ms = (g.milestones || []).filter(m => m.date);
  const { done, total } = projectProgress(g);

  // Прогресс-линия: доля done по датам? Упростим: количество done от total
  const ratio = total === 0 ? 0 : (done / total);

  // Точки
  const pointsHtml = ms.map(m => {
    const pos = milestonePosition(g, m);
    if(pos === null) return '';
    const cls = m.status === 'done' ? 'done' : (m.status === 'doing' ? 'doing' : 'todo');
    const safeTitle = escapeHtml(m.title);
    const safeDate = m.date || '';
    return `<div class="tl-point ${cls}" style="left:${pos}%" title="${safeTitle} (${safeDate})"></div>`;
  }).join('');

  // Подписи точки А и B
  const pointALabel = g.pointA ? escapeHtml(g.pointA) : 'старт';
  const pointBLabel = escapeHtml(g.title);

  return `
    <div class="project-timeline">
      <div class="tl-endpoints">
        <span class="tl-endpoint tl-endpoint-a" title="${pointALabel}">${pointALabel}</span>
        <span class="tl-endpoint tl-endpoint-b" title="${pointBLabel}">🏁</span>
      </div>
      <div class="tl-line-wrap">
        <div class="tl-line">
          <div class="tl-line-progress" style="width:${ratio * 100}%"></div>
        </div>
        ${pointsHtml}
      </div>
    </div>
  `;
}

function renderMilestoneRow(projectId, m){
  const done = m.status === 'done';
  const doing = m.status === 'doing';
  const cls = done ? 'done' : (doing ? 'doing' : '');

  return `
    <div class="ms-row ${cls}">
      <button class="ms-check${done ? ' done' : ''}"
        onclick="event.stopPropagation(); toggleMilestone('${projectId}','${m.id}')"
        title="${done ? 'Отметить невыполненной' : 'Отметить выполненной'}"></button>
      <button class="ms-doing${doing ? ' active' : ''}"
        onclick="event.stopPropagation(); setMilestoneDoing('${projectId}','${m.id}')"
        title="${doing ? 'Снять текущую' : 'Отметить текущей (в процессе)'}">●</button>
      <input class="ms-title" value="${escapeHtml(m.title)}"
        onclick="event.stopPropagation()"
        onchange="setMilestoneTitle('${projectId}','${m.id}', this.value)"
        maxlength="200">
      <input class="ms-date" type="date" value="${m.date || ''}"
        onclick="event.stopPropagation()"
        onchange="setMilestoneDate('${projectId}','${m.id}', this.value)">
      <button class="ms-del" onclick="event.stopPropagation(); delMilestone('${projectId}','${m.id}')" title="удалить">✕</button>
    </div>
  `;
}
