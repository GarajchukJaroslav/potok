/* ==================================================================
   ЧЕКЛИСТ — авто-события + ручные (want / external / discuss) + результаты
================================================================== */

/* ---------- ГЕНЕРАЦИЯ АВТО-СОБЫТИЙ ---------- */
function generateChecklistEvents(){
  const before = checklistEvents.length;

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

  if(checklistEvents.length !== before){
    store.set('checklistEvents', checklistEvents);
  }
}

function addEventIfMissing(source, refId, date, info){
  const exists = checklistEvents.find(e =>
    e.source === source &&
    e.refId === refId &&
    e.date === date
  );
  if(exists) return;

  const evt = {
    id: uid(),
    date,
    source,
    refId,
    title: info.title,
    detail: info.detail,
    period: info.period || null,
    crumb: info.crumb || null,
    createdAt: Date.now(),
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
  checklistEvents.push(evt);

  logAction('event_created', {
    kind: 'event', id: evt.id, name: info.title
  }, { source, date, detail: info.detail });
}

/* ---------- ПЕРЕКЛЮЧАТЕЛЬ КАТЕГОРИИ ---------- */
function switchManualType(type){
  currentManualType = type;
  store.set('manualCurrentType', type);
  renderChecklist();
}

/* ---------- УНИВЕРСАЛЬНАЯ КНОПКА + ---------- */
function openManualPicker(){
  if(currentManualType === 'result'){
    alert('События этого типа создаются автоматически при выполнении вехи проекта');
    return;
  }
  if(currentManualType === 'external'){
    openExternalPicker();
    return;
  }
  if(currentManualType === 'discuss'){
    openDiscussPicker();
    return;
  }
  // want
  openWantPicker();
}

/* ---------- WANT: НЕ ХОЧУ ДЕЛАТЬ ---------- */
function openWantPicker(){
  const titleEl = document.getElementById('manualModalTitle');
  const labelEl = document.getElementById('manualTaskLabel');
  const dateLabel = document.getElementById('manualDateLabel');
  if(titleEl) titleEl.textContent = 'Не хочу делать';
  if(labelEl) labelEl.textContent = 'Что не хочется делать';
  if(dateLabel) dateLabel.textContent = 'Когда не хочется';

  const tasks = [];

  habits.forEach(h => {
    tasks.push({
      value: 'habit:' + h.id,
      group: 'ЗОЖ',
      title: h.name,
      crumb: null,
      refType: 'habit',
      refId: h.id
    });
  });

  goals.forEach(g => {
    const ms = g.milestones || [];
    if(ms.length === 0) return;
    ms.forEach(m => {
      if(m.status === 'done') return;
      tasks.push({
        value: 'milestone:' + g.id + ':' + m.id,
        group: 'Вехи проектов',
        title: m.title,
        crumb: g.title,
        refType: 'milestone',
        refId: m.id
      });
    });
  });

  const sel = document.getElementById('manualTaskSelect');
  if(!sel) return;

  if(tasks.length === 0){
    sel.innerHTML = `<option value="">— нет доступных задач —</option>`;
  } else {
    const byGroup = {};
    tasks.forEach(t => {
      if(!byGroup[t.group]) byGroup[t.group] = [];
      byGroup[t.group].push(t);
    });
    let html = '<option value="">— выбери задачу —</option>';
    Object.keys(byGroup).forEach(g => {
      html += `<optgroup label="${escapeHtml(g)}">`;
      byGroup[g].forEach(t => {
        const label = t.crumb ? `${t.title}  (${t.crumb})` : t.title;
        html += `<option value="${t.value}"
          data-ref-type="${t.refType}"
          data-ref-id="${t.refId}"
          data-title="${escapeHtml(t.title)}"
          data-crumb="${t.crumb ? escapeHtml(t.crumb) : ''}"
        >${escapeHtml(label)}</option>`;
      });
      html += '</optgroup>';
    });
    sel.innerHTML = html;
  }

  const dateInp = document.getElementById('manualDate');
  if(dateInp){
    dateInp.value = todayStr();
    if(dateInp.min !== SYSTEM_START_DATE) dateInp.min = SYSTEM_START_DATE;
  }

  document.getElementById('manualOverlay').classList.add('open');
}

function closeManualPicker(){
  document.getElementById('manualOverlay').classList.remove('open');
}

function createManualEvent(){
  const sel = document.getElementById('manualTaskSelect');
  const dateInp = document.getElementById('manualDate');
  if(!sel || !dateInp) return;

  const value = sel.value;
  const date = dateInp.value;

  if(!value){ alert('Выбери задачу'); sel.focus(); return; }
  if(!date){ alert('Укажи дату'); dateInp.focus(); return; }
  if(date < SYSTEM_START_DATE){ alert('Дата раньше старта системы'); return; }

  const opt = sel.options[sel.selectedIndex];
  const refType = opt.dataset.refType;
  const refId = opt.dataset.refId;
  const title = opt.dataset.title;
  const crumb = opt.dataset.crumb || null;

  const dup = checklistEvents.find(e =>
    e.source === 'manual' &&
    e.manualType === 'want' &&
    e.refType === refType &&
    e.refId === refId &&
    e.date === date &&
    e.status !== 'resolved'
  );
  if(dup){ alert('Такое событие уже есть'); return; }

  checklistEvents.push({
    id: uid(),
    date,
    source: 'manual',
    manualType: 'want',
    refType,
    refId,
    title,
    detail: 'не хочется делать',
    crumb,
    createdAt: Date.now(),
    status: 'new',
    analysisId: null,
    analysisStartedAt: null,
    analysisDeadline: null,
    resolvedAt: null,
    solution: null,
    childrenIds: null,
    mergedIntoId: null
  });
  store.set('checklistEvents', checklistEvents);
  closeManualPicker();
  renderChecklist();
}

/* ---------- EXTERNAL: ВНЕШНЕЕ СОБЫТИЕ ---------- */
function openExternalPicker(){
  const titleInp = document.getElementById('externalTitle');
  const dateInp = document.getElementById('externalDate');
  const noteInp = document.getElementById('externalNote');
  if(titleInp) titleInp.value = '';
  if(noteInp) noteInp.value = '';
  if(dateInp){
    dateInp.value = todayStr();
    if(dateInp.min !== SYSTEM_START_DATE) dateInp.min = SYSTEM_START_DATE;
  }
  document.getElementById('externalOverlay').classList.add('open');
  if(titleInp) setTimeout(() => titleInp.focus(), 100);
}

function closeExternalPicker(){
  document.getElementById('externalOverlay').classList.remove('open');
}

function createExternalEvent(){
  const titleInp = document.getElementById('externalTitle');
  const dateInp = document.getElementById('externalDate');
  const noteInp = document.getElementById('externalNote');
  if(!titleInp || !dateInp) return;

  const title = titleInp.value.trim();
  const date = dateInp.value;
  const note = noteInp ? noteInp.value.trim() : '';

  if(!title){ alert('Напиши, что случилось'); titleInp.focus(); return; }
  if(!date){ alert('Укажи дату'); dateInp.focus(); return; }
  if(date < SYSTEM_START_DATE){ alert('Дата раньше старта системы'); return; }

  checklistEvents.push({
    id: uid(),
    date,
    source: 'external',
    refType: null,
    refId: null,
    title,
    detail: 'внешнее событие',
    note: note || null,
    crumb: null,
    createdAt: Date.now(),
    status: 'new',
    analysisId: null,
    analysisStartedAt: null,
    analysisDeadline: null,
    resolvedAt: null,
    solution: null,
    childrenIds: null,
    mergedIntoId: null
  });
  logAction('external_event_created', {
    kind: 'event', id: uid(), name: title
  }, { date, note: note || null });
  store.set('checklistEvents', checklistEvents);
  closeExternalPicker();
  renderChecklist();
}

/* ---------- DISCUSS: ХОЧЕТСЯ ОБСУДИТЬ ---------- */
function openDiscussPicker(){
  const titleInp = document.getElementById('discussTitle');
  const withInp = document.getElementById('discussWith');
  const dateInp = document.getElementById('discussDate');
  const noteInp = document.getElementById('discussNote');
  if(titleInp) titleInp.value = '';
  if(withInp) withInp.value = '';
  if(noteInp) noteInp.value = '';
  if(dateInp){
    dateInp.value = todayStr();
    if(dateInp.min !== SYSTEM_START_DATE) dateInp.min = SYSTEM_START_DATE;
  }
  document.getElementById('discussOverlay').classList.add('open');
  if(titleInp) setTimeout(() => titleInp.focus(), 100);
}

function closeDiscussPicker(){
  document.getElementById('discussOverlay').classList.remove('open');
}

function createDiscussEvent(){
  const titleInp = document.getElementById('discussTitle');
  const withInp = document.getElementById('discussWith');
  const dateInp = document.getElementById('discussDate');
  const noteInp = document.getElementById('discussNote');
  if(!titleInp || !dateInp) return;

  const title = titleInp.value.trim();
  const withWhom = withInp ? withInp.value.trim() : '';
  const date = dateInp.value;
  const note = noteInp ? noteInp.value.trim() : '';

  if(!title){ alert('Напиши, что обсудить'); titleInp.focus(); return; }
  if(!date){ alert('Укажи дату'); dateInp.focus(); return; }
  if(date < SYSTEM_START_DATE){ alert('Дата раньше старта системы'); return; }

  const detail = withWhom ? 'обсудить с ' + withWhom : 'хочется обсудить';

  checklistEvents.push({
    id: uid(),
    date,
    source: 'discuss',
    refType: null,
    refId: null,
    title,
    detail,
    note: note || null,
    crumb: null,
    createdAt: Date.now(),
    status: 'new',
    analysisId: null,
    analysisStartedAt: null,
    analysisDeadline: null,
    resolvedAt: null,
    solution: null,
    childrenIds: null,
    mergedIntoId: null
  });
  logAction('discuss_event_created', {
    kind: 'event', id: uid(), name: title
  }, { date, withWhom: withWhom || null, note: note || null });
  store.set('checklistEvents', checklistEvents);
  closeDiscussPicker();
  renderChecklist();
}

/* ---------- РЕНДЕР ---------- */
function renderChecklist(){
  generateChecklistEvents();

  const autoList = document.getElementById('checklistList');
  const manualList = document.getElementById('checklistManualList');
  const select = document.getElementById('sideSelect');
  const addBtn = document.getElementById('sideAddBtn');

  if(select && select.value !== currentManualType){
    select.value = currentManualType;
  }

  const isResultTab = currentManualType === 'result';
  if(addBtn){
    addBtn.style.display = isResultTab ? 'none' : 'grid';
  }

  if(autoList){
    autoList.innerHTML = '';
    const auto = checklistEvents
      .filter(e => e.status !== 'merged'
        && e.source === 'habit'
        && isAfterStart(e.date))
      .sort((a,b) => {
        const aDone = a.status === 'resolved' ? 1 : 0;
        const bDone = b.status === 'resolved' ? 1 : 0;
        if(aDone !== bDone) return aDone - bDone;
        return b.date.localeCompare(a.date);
      });

    if(auto.length === 0){
      autoList.innerHTML = `
        <div class="empty">
          <span class="empty-icon">✨</span>
          Пока чисто. Все привычки сделаны.
        </div>`;
    } else {
      auto.forEach(e => autoList.appendChild(buildEventCard(e)));
    }
  }

  if(manualList){
    manualList.innerHTML = '';

    let items, emptyMsg, emptyIcon;

    if(currentManualType === 'want'){
      items = checklistEvents.filter(e =>
        e.status !== 'merged' &&
        e.source === 'manual' &&
        e.manualType === 'want' &&
        isAfterStart(e.date)
      );
      emptyIcon = '💭';
      emptyMsg = 'Что-то не хочется делать? Жми +';
    } else if(currentManualType === 'external'){
      items = checklistEvents.filter(e =>
        e.status !== 'merged' &&
        e.source === 'external' &&
        isAfterStart(e.date)
      );
      emptyIcon = '🌍';
      emptyMsg = 'Что-то произошло извне? Жми +';
    } else if(currentManualType === 'discuss'){
      items = checklistEvents.filter(e =>
        e.status !== 'merged' &&
        e.source === 'discuss' &&
        isAfterStart(e.date)
      );
      emptyIcon = '💬';
      emptyMsg = 'Есть что обсудить? Жми +';
    } else {
      items = checklistEvents.filter(e =>
        e.status !== 'merged' && e.source === 'result' && isAfterStart(e.date)
      );
      emptyIcon = '🎯';
      emptyMsg = 'События появятся, когда завершишь веху и ответишь про результат';
    }

    items.sort((a,b) => {
      const aDone = a.status === 'resolved' ? 1 : 0;
      const bDone = b.status === 'resolved' ? 1 : 0;
      if(aDone !== bDone) return aDone - bDone;
      return b.date.localeCompare(a.date);
    });

    if(items.length === 0){
      manualList.innerHTML = `
        <div class="empty" style="padding:30px 20px;">
          <span class="empty-icon" style="font-size:24px;">${emptyIcon}</span>
          Пусто.<br>
          <span style="font-size:12px;">${emptyMsg}</span>
        </div>`;
    } else {
      items.forEach(e => manualList.appendChild(buildEventCard(e)));
    }
  }
}

function buildEventCard(e){
  const el = document.createElement('div');
  el.className = 'checklist-event';
  if(e.source === 'manual') el.classList.add('manual');
  if(e.source === 'external') el.classList.add('external');
  if(e.source === 'discuss') el.classList.add('discuss');
  if(e.source === 'result') el.classList.add('result-event');
  if(e.source === 'result' && e.achieved) el.classList.add('result-achieved');
  if(e.source === 'result' && !e.achieved) el.classList.add('result-failed');
  if(e.source === 'merged') el.classList.add('merged');
  if(e.status === 'resolved') el.classList.add('resolved');
  if(e.status === 'in_progress') el.classList.add('in-progress');

  let sourceLabel, sourceIcon, titleHtml;

  if(e.source === 'merged'){
    sourceLabel = 'Объединено';
    sourceIcon = '🔗';
    const kids = getMergedChildren(e);
    titleHtml = `${kids.length} ${plural(kids.length,'событие','события','событий')}`;
  } else if(e.source === 'result'){
    sourceLabel = e.achieved ? 'Результат ✓' : 'Результат ✗';
    sourceIcon = e.achieved ? '✓' : '✗';
    titleHtml = escapeHtml(e.title);
  } else if(e.source === 'external'){
    sourceLabel = 'Внешнее';
    sourceIcon = '🌍';
    titleHtml = escapeHtml(e.title);
  } else if(e.source === 'discuss'){
    sourceLabel = 'Обсудить';
    sourceIcon = '💬';
    titleHtml = escapeHtml(e.title);
  } else if(e.source === 'habit'){
    sourceLabel = 'ЗОЖ';
    sourceIcon = '🎯';
    titleHtml = escapeHtml(e.title);
  } else {
    sourceLabel = 'Своё';
    sourceIcon = '💭';
    titleHtml = escapeHtml(e.title);
  }

  let actionHtml = '';
  if(e.status === 'new'){
    const label = (e.source === 'result' && e.achieved) ? 'Проанализировать результат' : 'Принять меры';
    const cls = (e.source === 'result' && e.achieved) ? 'btn-take-action success' : 'btn-take-action';
    actionHtml = `<button class="${cls}" onclick="startAnalysisFromEvent('${e.id}')">${label}</button>`;
  } else if(e.status === 'in_progress'){
    actionHtml = `<button class="btn-take-action in-progress" onclick="resumeAnalysisFromEvent('${e.id}')">Продолжить анализ →</button>`;
  } else {
    actionHtml = `<div class="event-resolved-badge">✓ Решено</div>`;
  }

  const crumbHtml = e.crumb && e.source !== 'merged'
    ? `<div class="event-crumb">${escapeHtml(e.crumb)}</div>` : '';
  const noteHtml = e.note
    ? `<div class="event-note">${escapeHtml(e.note)}</div>` : '';
  const solutionHtml = e.solution
    ? `<div class="event-solution">Решение: ${escapeHtml(e.solution)}</div>` : '';

  let childrenHtml = '';
  if(e.source === 'merged'){
    const kids = getMergedChildren(e);
    childrenHtml = `<div class="event-children">${kids.map(k => {
      const icon = k.source === 'habit' ? '🎯' : (k.source === 'result' ? '✓' : (k.source === 'external' ? '🌍' : (k.source === 'discuss' ? '💬' : '💭')));
      const label = k.source === 'habit' ? 'ЗОЖ' : (k.source === 'result' ? 'Результат' : (k.source === 'external' ? 'Внешнее' : (k.source === 'discuss' ? 'Обсудить' : 'Своё')));
      return `<div class="event-child"><span class="event-child-icon">${icon}</span><span class="event-child-label">${label}</span><span class="event-child-title">${escapeHtml(k.title)}</span></div>`;
    }).join('')}</div>`;
  }

  el.innerHTML = `
    <div class="event-head">
      <div class="event-date">${fmtEventDate(e.date)}</div>
      <div class="event-source ${e.source}">${sourceIcon} ${sourceLabel}</div>
    </div>
    <div class="event-title">${titleHtml}</div>
    ${crumbHtml}
    ${childrenHtml}
    ${e.source !== 'merged' ? `<div class="event-detail">${escapeHtml(e.detail)}</div>` : ''}
    ${noteHtml}
    ${solutionHtml}
    <div class="event-foot">${actionHtml}</div>
  `;
  return el;
}
