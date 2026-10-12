/* ==================================================================
   ACTIONS — структурные действия из анализа
   Все изменения логируются в actionLog (source: 'analysis')
================================================================== */

/* ---------- ПОИСК ---------- */
function findProject(projectId){ return goals.find(g => g.id === projectId) || null; }
function findMilestone(projectId, milestoneId){
  const g = findProject(projectId);
  if(!g) return null;
  return (g.milestones || []).find(m => m.id === milestoneId) || null;
}
function findHabit(habitId){ return habits.find(h => h.id === habitId) || null; }

/* ---------- ОПЦИИ ---------- */
function optionsProjects(){
  let html = '<option value="">— выбери проект —</option>';
  goals.forEach(g => {
    html += `<option value="${g.id}">${escapeHtml(g.title)}</option>`;
  });
  return html;
}
function optionsHabits(){
  let html = '<option value="">— выбери привычку —</option>';
  habits.forEach(h => {
    html += `<option value="${h.id}">${escapeHtml(h.name)}</option>`;
  });
  return html;
}
function optionsMilestones(){
  let html = '<option value="">— выбери веху —</option>';
  goals.forEach(g => {
    const ms = g.milestones || [];
    if(ms.length === 0) return;
    html += `<optgroup label="${escapeHtml(g.title)}">`;
    ms.forEach(m => {
      const d = m.date ? ' · ' + m.date : '';
      html += `<option value="${g.id}/${m.id}">${escapeHtml(m.title)}${d}</option>`;
    });
    html += '</optgroup>';
  });
  return html;
}

function optionsNoteTargets(excludeKeys){
  excludeKeys = excludeKeys || new Set();
  let html = '<option value="">— куда добавить заметку —</option>';

  const habitOpts = [];
  habits.forEach(h => {
    const key = 'habit/' + h.id;
    if(excludeKeys.has(key)) return;
    habitOpts.push(`<option value="${key}">${escapeHtml(h.name)}</option>`);
  });
  if(habitOpts.length > 0){
    html += '<optgroup label="Привычки">' + habitOpts.join('') + '</optgroup>';
  }

  const projOpts = [];
  goals.forEach(g => {
    const key = 'project/' + g.id;
    if(excludeKeys.has(key)) return;
    projOpts.push(`<option value="${key}">${escapeHtml(g.title)}</option>`);
  });
  if(projOpts.length > 0){
    html += '<optgroup label="🛤 Проекты">' + projOpts.join('') + '</optgroup>';
  }

  return html;
}

function collectDraftNoteKeys(){
  const set = new Set();
  const draft = getDraftActions();
  draft.forEach(a => {
    if(a.type !== 'note') return;
    const t = a.data.target;
    if(t.kind === 'habit') set.add('habit/' + t.habitId);
    else if(t.kind === 'project') set.add('project/' + t.projectId);
  });
  return set;
}

/* ---------- ПОСТРОЕНИЕ ФОРМЫ ПОД ТИП ---------- */
function buildActionFormHTML(type){
  if(type === 'note'){
    const excluded = collectDraftNoteKeys();
    const opts = optionsNoteTargets(excluded);
    return `
      <select class="action-select" id="actTarget">${opts}</select>
      <textarea class="action-textarea" id="actText" placeholder="Текст заметки"></textarea>
    `;
  }
  if(type === 'add_habit'){
    return `
      <input class="action-input" type="text" id="actText" placeholder="Название привычки" maxlength="80">
      <div class="action-row">
        <input class="action-input small" type="number" id="actTarget" value="1" min="1" max="30">
        <select class="action-select small" id="actPeriod">
          <option value="day">раз в день</option>
          <option value="week">раз в неделю</option>
        </select>
      </div>
    `;
  }
  if(type === 'del_habit'){
    return `<select class="action-select" id="actHabit">${optionsHabits()}</select>`;
  }
  if(type === 'add_milestone'){
    return `
      <select class="action-select" id="actProject">${optionsProjects()}</select>
      <input class="action-input" type="text" id="actText" placeholder="Название вехи" maxlength="200">
      <input class="action-input" type="date" id="actDate" title="Дата вехи">
    `;
  }
  if(type === 'del_milestone'){
    return `<select class="action-select" id="actMilestone">${optionsMilestones()}</select>`;
  }
  if(type === 'shift_milestone_date'){
    return `
      <select class="action-select" id="actMilestone">${optionsMilestones()}</select>
      <input class="action-input" type="date" id="actDate" title="Новая дата">
    `;
  }
  if(type === 'shift_project_end'){
    return `
      <select class="action-select" id="actProject">${optionsProjects()}</select>
      <input class="action-input" type="date" id="actDate" title="Новый финиш">
    `;
  }
  return '';
}

/* ---------- СБОР ДАННЫХ ---------- */
function collectActionData(type){
  const data = {};

  if(type === 'note'){
    const target = document.getElementById('actTarget')?.value || '';
    const text = document.getElementById('actText')?.value.trim() || '';
    if(!target){ alert('Выбери, куда добавить заметку'); return null; }
    if(!text){ alert('Напиши текст заметки'); return null; }
    const parts = target.split('/');
    data.target = { kind: parts[0] };
    if(parts[0] === 'habit') data.target.habitId = parts[1];
    if(parts[0] === 'project') data.target.projectId = parts[1];
    data.text = text;
  } else if(type === 'add_habit'){
    const text = document.getElementById('actText')?.value.trim() || '';
    const target = parseInt(document.getElementById('actTarget')?.value || '1', 10);
    const period = document.getElementById('actPeriod')?.value || 'day';
    if(!text){ alert('Напиши название привычки'); return null; }
    if(!target || target < 1){ alert('Укажи сколько раз'); return null; }
    data.text = text; data.target = target; data.period = period;
  } else if(type === 'del_habit'){
    const habitId = document.getElementById('actHabit')?.value || '';
    if(!habitId){ alert('Выбери привычку'); return null; }
    data.habitId = habitId;
  } else if(type === 'add_milestone'){
    const projectId = document.getElementById('actProject')?.value || '';
    const text = document.getElementById('actText')?.value.trim() || '';
    const date = document.getElementById('actDate')?.value || '';
    if(!projectId){ alert('Выбери проект'); return null; }
    if(!text){ alert('Напиши название вехи'); return null; }
    if(!date){ alert('Укажи дату'); return null; }
    data.projectId = projectId; data.text = text; data.date = date;
  } else if(type === 'del_milestone'){
    const val = document.getElementById('actMilestone')?.value || '';
    if(!val){ alert('Выбери веху'); return null; }
    const [projectId, milestoneId] = val.split('/');
    data.projectId = projectId; data.milestoneId = milestoneId;
  } else if(type === 'shift_milestone_date'){
    const val = document.getElementById('actMilestone')?.value || '';
    const date = document.getElementById('actDate')?.value || '';
    if(!val){ alert('Выбери веху'); return null; }
    if(!date){ alert('Укажи новую дату'); return null; }
    const [projectId, milestoneId] = val.split('/');
    data.projectId = projectId; data.milestoneId = milestoneId; data.date = date;
  } else if(type === 'shift_project_end'){
    const projectId = document.getElementById('actProject')?.value || '';
    const date = document.getElementById('actDate')?.value || '';
    if(!projectId){ alert('Выбери проект'); return null; }
    if(!date){ alert('Укажи новую дату'); return null; }
    data.projectId = projectId; data.date = date;
  }

  return data;
}

/* ---------- ВЫПОЛНЕНИЕ + ЛОГ ---------- */
function executeAction(type, data){
  if(type === 'note'){
    let entity = null;
    if(data.target.kind === 'habit') entity = findHabit(data.target.habitId);
    else if(data.target.kind === 'project') entity = findProject(data.target.projectId);
    if(!entity) return false;
    if(!Array.isArray(entity.notes)) entity.notes = [];
    entity.notes.push({ id: uid(), text: data.text, date: new Date().toISOString() });
    logAction('note_added', {
      kind: data.target.kind,
      id: entity.id,
      name: entity.name || entity.title || ''
    }, { source: 'analysis', text: data.text });
    store.set('habits', habits);
    store.set('goals', goals);
    return true;
  }
  if(type === 'add_habit'){
    const habit = {
      id: uid(), name: data.text, target: data.target, period: data.period,
      createdAt: todayStr(), log: {}, slots: {}, notes: []
    };
    habits.push(habit);
    logAction('habit_created', {
      kind: 'habit', id: habit.id, name: habit.name
    }, { source: 'analysis', target: habit.target, period: habit.period });
    store.set('habits', habits);
    return true;
  }
  if(type === 'del_habit'){
    const h = findHabit(data.habitId);
    if(!h) return false;
    logAction('habit_deleted', {
      kind: 'habit', id: h.id, name: h.name
    }, { source: 'analysis' });
    habits = habits.filter(x => x.id !== data.habitId);
    store.set('habits', habits);
    return true;
  }
  if(type === 'add_milestone'){
    const g = findProject(data.projectId);
    if(!g) return false;
    if(!Array.isArray(g.milestones)) g.milestones = [];
    const ms = { id: uid(), title: data.text, date: data.date, status: 'todo' };
    g.milestones.push(ms);
    g.milestones.sort((a,b) => (a.date || '').localeCompare(b.date || ''));
    logAction('milestone_created', {
      kind: 'milestone', id: ms.id, name: ms.title,
      projectId: g.id
    }, { source: 'analysis', date: data.date });
    store.set('goals', goals);
    return true;
  }
  if(type === 'del_milestone'){
    const g = findProject(data.projectId);
    if(!g) return false;
    const ms = (g.milestones || []).find(x => x.id === data.milestoneId);
    if(!ms) return false;
    logAction('milestone_deleted', {
      kind: 'milestone', id: ms.id, name: ms.title,
      projectId: g.id
    }, { source: 'analysis' });
    g.milestones = g.milestones.filter(x => x.id !== data.milestoneId);
    store.set('goals', goals);
    return true;
  }
  if(type === 'shift_milestone_date'){
    const g = findProject(data.projectId);
    if(!g) return false;
    const ms = (g.milestones || []).find(x => x.id === data.milestoneId);
    if(!ms) return false;
    const before = ms.date;
    ms.date = data.date;
    g.milestones.sort((a,b) => (a.date || '').localeCompare(b.date || ''));
    logAction('milestone_date_changed', {
      kind: 'milestone', id: ms.id, name: ms.title,
      projectId: g.id
    }, { source: 'analysis', before, after: data.date });
    store.set('goals', goals);
    return true;
  }
  if(type === 'shift_project_end'){
    const g = findProject(data.projectId);
    if(!g) return false;
    const before = g.endDate;
    g.endDate = data.date;
    logAction('project_end_changed', {
      kind: 'project', id: g.id, name: g.title
    }, { source: 'analysis', before, after: data.date });
    store.set('goals', goals);
    return true;
  }
  return false;
}

/* ---------- ОПИСАНИЕ ---------- */
function describeAction(type, data){
  if(type === 'note'){
    let targetName = '';
    if(data.target.kind === 'habit'){
      const h = findHabit(data.target.habitId);
      targetName = 'привычке «' + (h ? h.name : '?') + '»';
    } else if(data.target.kind === 'project'){
      const g = findProject(data.target.projectId);
      targetName = 'проекту «' + (g ? g.title : '?') + '»';
    }
    return `Заметка к ${targetName}: ${data.text}`;
  }
  if(type === 'add_habit'){
    const p = data.period === 'day' ? 'день' : 'неделю';
    return `Добавить привычку «${data.text}» — ${data.target} раз в ${p}`;
  }
  if(type === 'del_habit'){
    const h = findHabit(data.habitId);
    return `Удалить привычку «${h ? h.name : '?'}»`;
  }
  if(type === 'add_milestone'){
    const g = findProject(data.projectId);
    return `Добавить веху «${data.text}» к проекту «${g ? g.title : '?'}» (дата ${data.date})`;
  }
  if(type === 'del_milestone'){
    const ms = findMilestone(data.projectId, data.milestoneId);
    return `Удалить веху «${ms ? ms.title : '?'}»`;
  }
  if(type === 'shift_milestone_date'){
    const ms = findMilestone(data.projectId, data.milestoneId);
    return `Сдвинуть дату вехи «${ms ? ms.title : '?'}» на ${data.date}`;
  }
  if(type === 'shift_project_end'){
    const g = findProject(data.projectId);
    return `Сдвинуть финиш проекта «${g ? g.title : '?'}» на ${data.date}`;
  }
  return 'Действие';
}

/* ---------- ЧЕРНОВИК ---------- */
function getDraftActions(){
  const e = checklistEvents.find(x => x.id === activeAnalysisEventId);
  if(!e) return [];
  if(!Array.isArray(e.draftActions)) e.draftActions = [];
  return e.draftActions;
}

function persistDraftActions(){
  store.set('checklistEvents', checklistEvents);
}

function openActionPicker(){
  const sel = document.getElementById('pickerActionType');
  if(sel) sel.value = '';
  const form = document.getElementById('pickerActionForm');
  if(form) form.innerHTML = '';
  document.getElementById('actionPickerOverlay').classList.add('open');
}

function closeActionPicker(){
  const ov = document.getElementById('actionPickerOverlay');
  if(ov) ov.classList.remove('open');
}

function onPickerTypeChange(type){
  const host = document.getElementById('pickerActionForm');
  if(!host) return;
  host.innerHTML = type ? buildActionFormHTML(type) : '';
}

function confirmAddAction(){
  const type = document.getElementById('pickerActionType')?.value || '';
  if(!type){ alert('Выбери тип действия'); return; }
  const data = collectActionData(type);
  if(!data) return;

  if(type === 'note'){
    const key = noteTargetKey(data.target);
    const existing = collectDraftNoteKeys();
    if(existing.has(key)){
      alert('К этой сущности заметка уже добавлена в этом анализе');
      return;
    }
  }

  const description = describeAction(type, data);
  const draft = getDraftActions();
  draft.push({ id: uid(), type, data, description });
  persistDraftActions();
  closeActionPicker();
  renderActionList();
}

function noteTargetKey(t){
  if(t.kind === 'habit') return 'habit/' + t.habitId;
  if(t.kind === 'project') return 'project/' + t.projectId;
  return '';
}

function removeDraftAction(actionId){
  const e = checklistEvents.find(x => x.id === activeAnalysisEventId);
  if(!e) return;
  e.draftActions = (e.draftActions || []).filter(a => a.id !== actionId);
  persistDraftActions();
  renderActionList();
}

function renderActionList(){
  const host = document.getElementById('focusActionList');
  if(!host) return;
  const draft = getDraftActions();

  if(draft.length === 0){
    host.innerHTML = `<div class="action-empty">Действий пока нет. Нажми «+ Добавить действие».</div>`;
    return;
  }

  host.innerHTML = draft.map((a, i) => `
    <div class="action-card">
      <div class="action-card-num">${i+1}</div>
      <div class="action-card-text">${escapeHtml(a.description)}</div>
      <button class="action-card-del" onclick="removeDraftAction('${a.id}')" title="удалить">✕</button>
    </div>
  `).join('');
}
