/* ==================================================================
   ACTIONS — структурные действия из анализа
   (добавление/удаление/сдвиг сущностей системы)
================================================================== */

/* ---------- ПОИСК ---------- */
function findGoal(goalId){ return goals.find(g => g.id === goalId) || null; }
function findStep(goalId, stepId){
  const g = findGoal(goalId);
  if(!g) return null;
  return (g.steps || []).find(s => s.id === stepId) || null;
}
function findSubstep(goalId, stepId, substepId){
  const s = findStep(goalId, stepId);
  if(!s) return null;
  return (s.substeps || []).find(ss => ss.id === substepId) || null;
}
function findHabit(habitId){ return habits.find(h => h.id === habitId) || null; }

/* ---------- ОПЦИИ ДЛЯ СЕЛЕКТОВ ---------- */
function optionsGoals(){
  let html = '<option value="">— выбери цель —</option>';
  goals.forEach(g => {
    html += `<option value="${g.id}">${escapeHtml(g.text)}</option>`;
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

function optionsSteps(){
  let html = '<option value="">— выбери шаг —</option>';
  goals.forEach(g => {
    const steps = g.steps || [];
    if(steps.length === 0) return;
    html += `<optgroup label="${escapeHtml(g.text)}">`;
    steps.forEach(s => {
      html += `<option value="${g.id}/${s.id}">${escapeHtml(s.text)}</option>`;
    });
    html += '</optgroup>';
  });
  return html;
}

function optionsSubsteps(){
  let html = '<option value="">— выбери подшаг —</option>';
  goals.forEach(g => {
    (g.steps || []).forEach(s => {
      const subs = s.substeps || [];
      if(subs.length === 0) return;
      html += `<optgroup label="${escapeHtml(g.text)} → ${escapeHtml(s.text)}">`;
      subs.forEach(ss => {
        html += `<option value="${g.id}/${s.id}/${ss.id}">${escapeHtml(ss.text)}</option>`;
      });
      html += '</optgroup>';
    });
  });
  return html;
}

function optionsNoteTargets(){
  let html = '<option value="">— куда добавить заметку —</option>';
  if(habits.length > 0){
    html += '<optgroup label="Привычки">';
    habits.forEach(h => {
      html += `<option value="habit/${h.id}">${escapeHtml(h.name)}</option>`;
    });
    html += '</optgroup>';
  }
  goals.forEach(g => {
    const steps = g.steps || [];
    if(steps.length === 0) return;
    html += `<optgroup label="🎯 ${escapeHtml(g.text)}">`;
    steps.forEach(s => {
      html += `<option value="step/${g.id}/${s.id}">Шаг: ${escapeHtml(s.text)}</option>`;
      (s.substeps || []).forEach(ss => {
        html += `<option value="substep/${g.id}/${s.id}/${ss.id}">↳ Подшаг: ${escapeHtml(ss.text)}</option>`;
      });
    });
    html += '</optgroup>';
  });
  return html;
}

/* ---------- ПОСТРОЕНИЕ ФОРМЫ ПОД ТИП ---------- */
function onActionTypeChange(type){
  const host = document.getElementById('focusActionForm');
  if(!host) return;
  if(!type){ host.innerHTML = ''; return; }

  if(type === 'note'){
    host.innerHTML = `
      <select class="action-select" id="actTarget">${optionsNoteTargets()}</select>
      <textarea class="action-textarea" id="actText" placeholder="Текст заметки"></textarea>
    `;
  } else if(type === 'add_step'){
    host.innerHTML = `
      <select class="action-select" id="actGoal">${optionsGoals()}</select>
      <input class="action-input" type="text" id="actText" placeholder="Название шага" maxlength="200">
      <input class="action-input" type="date" id="actDeadline" title="Дедлайн">
    `;
  } else if(type === 'add_substep'){
    host.innerHTML = `
      <select class="action-select" id="actStep">${optionsSteps()}</select>
      <input class="action-input" type="text" id="actText" placeholder="Название подшага" maxlength="200">
      <input class="action-input" type="date" id="actDeadline">
    `;
  } else if(type === 'add_habit'){
    host.innerHTML = `
      <input class="action-input" type="text" id="actText" placeholder="Название привычки" maxlength="80">
      <div class="action-row">
        <input class="action-input small" type="number" id="actTarget" value="1" min="1" max="30">
        <select class="action-select small" id="actPeriod">
          <option value="day">раз в день</option>
          <option value="week">раз в неделю</option>
        </select>
      </div>
    `;
  } else if(type === 'del_step'){
    host.innerHTML = `<select class="action-select" id="actStep">${optionsSteps()}</select>`;
  } else if(type === 'del_substep'){
    host.innerHTML = `<select class="action-select" id="actSubstep">${optionsSubsteps()}</select>`;
  } else if(type === 'del_habit'){
    host.innerHTML = `<select class="action-select" id="actHabit">${optionsHabits()}</select>`;
  } else if(type === 'shift_step_deadline'){
    host.innerHTML = `
      <select class="action-select" id="actStep">${optionsSteps()}</select>
      <input class="action-input" type="date" id="actDeadline" title="Новая дата">
    `;
  } else if(type === 'shift_substep_deadline'){
    host.innerHTML = `
      <select class="action-select" id="actSubstep">${optionsSubsteps()}</select>
      <input class="action-input" type="date" id="actDeadline" title="Новая дата">
    `;
  }
}

/* ---------- СБОР ДАННЫХ ИЗ ФОРМЫ ---------- */
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
    if(parts[0] === 'step'){ data.target.goalId = parts[1]; data.target.stepId = parts[2]; }
    if(parts[0] === 'substep'){
      data.target.goalId = parts[1];
      data.target.stepId = parts[2];
      data.target.substepId = parts[3];
    }
    data.text = text;
  } else if(type === 'add_step'){
    const goalId = document.getElementById('actGoal')?.value || '';
    const text = document.getElementById('actText')?.value.trim() || '';
    const deadline = document.getElementById('actDeadline')?.value || '';
    if(!goalId){ alert('Выбери цель'); return null; }
    if(!text){ alert('Напиши название шага'); return null; }
    if(!deadline){ alert('Укажи дедлайн'); return null; }
    data.goalId = goalId; data.text = text; data.deadline = deadline;
  } else if(type === 'add_substep'){
    const val = document.getElementById('actStep')?.value || '';
    const text = document.getElementById('actText')?.value.trim() || '';
    const deadline = document.getElementById('actDeadline')?.value || '';
    if(!val){ alert('Выбери шаг'); return null; }
    if(!text){ alert('Напиши название подшага'); return null; }
    if(!deadline){ alert('Укажи дедлайн'); return null; }
    const [goalId, stepId] = val.split('/');
    data.goalId = goalId; data.stepId = stepId;
    data.text = text; data.deadline = deadline;
  } else if(type === 'add_habit'){
    const text = document.getElementById('actText')?.value.trim() || '';
    const target = parseInt(document.getElementById('actTarget')?.value || '1', 10);
    const period = document.getElementById('actPeriod')?.value || 'day';
    if(!text){ alert('Напиши название привычки'); return null; }
    if(!target || target < 1){ alert('Укажи сколько раз'); return null; }
    data.text = text; data.target = target; data.period = period;
  } else if(type === 'del_step'){
    const val = document.getElementById('actStep')?.value || '';
    if(!val){ alert('Выбери шаг'); return null; }
    const [goalId, stepId] = val.split('/');
    data.goalId = goalId; data.stepId = stepId;
  } else if(type === 'del_substep'){
    const val = document.getElementById('actSubstep')?.value || '';
    if(!val){ alert('Выбери подшаг'); return null; }
    const [goalId, stepId, substepId] = val.split('/');
    data.goalId = goalId; data.stepId = stepId; data.substepId = substepId;
  } else if(type === 'del_habit'){
    const habitId = document.getElementById('actHabit')?.value || '';
    if(!habitId){ alert('Выбери привычку'); return null; }
    data.habitId = habitId;
  } else if(type === 'shift_step_deadline'){
    const val = document.getElementById('actStep')?.value || '';
    const deadline = document.getElementById('actDeadline')?.value || '';
    if(!val){ alert('Выбери шаг'); return null; }
    if(!deadline){ alert('Укажи новую дату'); return null; }
    const [goalId, stepId] = val.split('/');
    data.goalId = goalId; data.stepId = stepId; data.deadline = deadline;
  } else if(type === 'shift_substep_deadline'){
    const val = document.getElementById('actSubstep')?.value || '';
    const deadline = document.getElementById('actDeadline')?.value || '';
    if(!val){ alert('Выбери подшаг'); return null; }
    if(!deadline){ alert('Укажи новую дату'); return null; }
    const [goalId, stepId, substepId] = val.split('/');
    data.goalId = goalId; data.stepId = stepId; data.substepId = substepId;
    data.deadline = deadline;
  }

  return data;
}

/* ---------- ВЫПОЛНЕНИЕ ---------- */
function executeAction(type, data){
  if(type === 'note'){
    let entity = null;
    if(data.target.kind === 'habit') entity = findHabit(data.target.habitId);
    else if(data.target.kind === 'step') entity = findStep(data.target.goalId, data.target.stepId);
    else if(data.target.kind === 'substep') entity = findSubstep(data.target.goalId, data.target.stepId, data.target.substepId);
    if(!entity) return false;
    if(!entity.notes) entity.notes = [];
    entity.notes.push({ id: uid(), text: data.text, date: new Date().toISOString() });
    store.set('habits', habits);
    store.set('goals', goals);
    return true;
  }
  if(type === 'add_step'){
    const g = findGoal(data.goalId);
    if(!g) return false;
    if(!Array.isArray(g.steps)) g.steps = [];
    g.steps.push({
      id: uid(), text: data.text, status: 'todo', lastStatus: 'todo',
      deadline: data.deadline, substeps: []
    });
    store.set('goals', goals);
    return true;
  }
  if(type === 'add_substep'){
    const s = findStep(data.goalId, data.stepId);
    if(!s) return false;
    if(!Array.isArray(s.substeps)) s.substeps = [];
    s.substeps.push({
      id: uid(), text: data.text, status: 'todo', lastStatus: 'todo',
      deadline: data.deadline
    });
    store.set('goals', goals);
    return true;
  }
  if(type === 'add_habit'){
    habits.push({
      id: uid(), name: data.text, target: data.target, period: data.period,
      createdAt: todayStr(), log: {}, slots: {}
    });
    store.set('habits', habits);
    return true;
  }
  if(type === 'del_step'){
    const g = findGoal(data.goalId);
    if(!g) return false;
    g.steps = (g.steps || []).filter(s => s.id !== data.stepId);
    store.set('goals', goals);
    return true;
  }
  if(type === 'del_substep'){
    const s = findStep(data.goalId, data.stepId);
    if(!s) return false;
    s.substeps = (s.substeps || []).filter(ss => ss.id !== data.substepId);
    store.set('goals', goals);
    return true;
  }
  if(type === 'del_habit'){
    habits = habits.filter(h => h.id !== data.habitId);
    store.set('habits', habits);
    return true;
  }
  if(type === 'shift_step_deadline'){
    const s = findStep(data.goalId, data.stepId);
    if(!s) return false;
    s.deadline = data.deadline;
    store.set('goals', goals);
    return true;
  }
  if(type === 'shift_substep_deadline'){
    const ss = findSubstep(data.goalId, data.stepId, data.substepId);
    if(!ss) return false;
    ss.deadline = data.deadline;
    store.set('goals', goals);
    return true;
  }
  return false;
}

/* ---------- ОПИСАНИЕ ДЕЙСТВИЯ (для истории) ---------- */
function describeAction(type, data){
  if(type === 'note'){
    let targetName = '';
    if(data.target.kind === 'habit'){
      const h = findHabit(data.target.habitId);
      targetName = 'привычке «' + (h ? h.name : '?') + '»';
    } else if(data.target.kind === 'step'){
      const s = findStep(data.target.goalId, data.target.stepId);
      targetName = 'шагу «' + (s ? s.text : '?') + '»';
    } else if(data.target.kind === 'substep'){
      const ss = findSubstep(data.target.goalId, data.target.stepId, data.target.substepId);
      targetName = 'подшагу «' + (ss ? ss.text : '?') + '»';
    }
    return `Добавил заметку к ${targetName}: ${data.text}`;
  }
  if(type === 'add_step') return `Добавил шаг «${data.text}» (дедлайн ${data.deadline})`;
  if(type === 'add_substep') return `Добавил подшаг «${data.text}» (дедлайн ${data.deadline})`;
  if(type === 'add_habit'){
    const p = data.period === 'day' ? 'день' : 'неделю';
    return `Добавил привычку «${data.text}» — ${data.target} раз в ${p}`;
  }
  if(type === 'del_step'){
    const s = findStep(data.goalId, data.stepId);
    return `Удалил шаг «${s ? s.text : '?'}»`;
  }
  if(type === 'del_substep'){
    const ss = findSubstep(data.goalId, data.stepId, data.substepId);
    return `Удалил подшаг «${ss ? ss.text : '?'}»`;
  }
  if(type === 'del_habit'){
    const h = findHabit(data.habitId);
    return `Удалил привычку «${h ? h.name : '?'}»`;
  }
  if(type === 'shift_step_deadline'){
    const s = findStep(data.goalId, data.stepId);
    return `Сдвинул дедлайн шага «${s ? s.text : '?'}» на ${data.deadline}`;
  }
  if(type === 'shift_substep_deadline'){
    const ss = findSubstep(data.goalId, data.stepId, data.substepId);
    return `Сдвинул дедлайн подшага «${ss ? ss.text : '?'}» на ${data.deadline}`;
  }
  return 'Действие';
}
