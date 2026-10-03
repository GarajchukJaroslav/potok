/* ==================================================================
   ЭКРАН «АНАЛИЗ → ДЕЙСТВИЯ»
   Событие-фокус, таймер 15 мин, объединение нескольких событий.
================================================================== */

let activeAnalysisEventId = null;
let analysisTicker = null;
let selectedForMerge = new Set();

/* ---------- СТАРТ / ПРОДОЛЖЕНИЕ ---------- */
function startAnalysisFromEvent(eventId){
  const e = checklistEvents.find(x => x.id === eventId);
  if(!e) return;
  if(e.status === 'resolved') return;

  const now = Date.now();
  e.status = 'in_progress';
  e.analysisStartedAt = now;
  e.analysisDeadline = now + ANALYSIS_TIMEOUT_MS;
  store.set('checklistEvents', checklistEvents);

  activeAnalysisEventId = eventId;
  selectedForMerge.clear();
  if(typeof goTo === 'function') goTo(3);
  renderAnalysis();
  startAnalysisTicker();
}

function resumeAnalysisFromEvent(eventId){
  const e = checklistEvents.find(x => x.id === eventId);
  if(!e || e.status !== 'in_progress') return;
  activeAnalysisEventId = eventId;
  selectedForMerge.clear();
  if(typeof goTo === 'function') goTo(3);
  renderAnalysis();
  startAnalysisTicker();
}

function startAnalysisTicker(){
  stopAnalysisTicker();
  analysisTicker = setInterval(() => {
    const el = document.getElementById('focusTimer');
    if(el) updateTimerDisplay(el);
    if(typeof checkSystemBlock === 'function') checkSystemBlock();
  }, 1000);
}

function stopAnalysisTicker(){
  if(analysisTicker){ clearInterval(analysisTicker); analysisTicker = null; }
}

function updateTimerDisplay(el){
  if(!activeAnalysisEventId){ el.textContent = ''; return; }
  const e = checklistEvents.find(x => x.id === activeAnalysisEventId);
  if(!e || !e.analysisDeadline){ el.textContent = ''; return; }
  const left = e.analysisDeadline - Date.now();
  if(left <= 0){
    el.textContent = '00:00';
    el.classList.add('danger');
    return;
  }
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  el.classList.remove('danger','warning');
  if(left < 60000) el.classList.add('danger');
  else if(left < 5*60000) el.classList.add('warning');
}

/* ---------- ХЕЛПЕР: ОТКУДА ПРИШЛО СОБЫТИЕ ---------- */
function sourceMeta(source, manualType){
  if(source === 'habit')  return { icon:'🎯', label:'ЗОЖ',       cls:'habit' };
  if(source === 'kanban') return { icon:'📋', label:'Канбан',    cls:'kanban' };
  if(source === 'merged') return { icon:'🔗', label:'Объединено', cls:'merged' };
  if(source === 'manual' && manualType === 'result')
                          return { icon:'🎯', label:'Результат', cls:'result' };
  if(source === 'manual') return { icon:'💭', label:'Своё',       cls:'manual' };
  return { icon:'•', label:'Событие', cls:'other' };
}

/* HTML-блок «откуда это пришло» */
function renderEventOrigin(event){
  if(!event){
    return `<div class="origin-empty">без привязки к событию</div>`;
  }

  // merged
  if(event.source === 'merged'){
    const kids = getMergedChildren(event);
    const kidsHtml = kids.map(k => {
      const meta = sourceMeta(k.source, k.manualType);
      return `<div class="origin-child">
        <span class="origin-child-icon">${meta.icon}</span>
        <span class="origin-child-label">${meta.label}</span>
        <span class="origin-child-title">${escapeHtml(k.title || '(без названия)')}</span>
      </div>`;
    }).join('');
    return `
      <div class="origin-row">
        <span class="origin-source merged">🔗 Объединено</span>
        <span class="origin-date">${fmtEventDate(event.date)}</span>
      </div>
      <div class="origin-title">${kids.length} ${plural(kids.length,'событие','события','событий')}</div>
      <div class="origin-children">${kidsHtml}</div>
    `;
  }

  // обычное событие
  const meta = sourceMeta(event.source, event.manualType);
  const crumbHtml = event.crumb
    ? `<div class="origin-crumb">${escapeHtml(event.crumb)}</div>`
    : '';
  return `
    <div class="origin-row">
      <span class="origin-source ${meta.cls}">${meta.icon} ${meta.label}</span>
      <span class="origin-date">${fmtEventDate(event.date)}</span>
    </div>
    <div class="origin-title">${escapeHtml(event.title || '(без названия)')}</div>
    ${crumbHtml}
  `;
}

/* Найти событие, к которому относится мысль */
function findThoughtEvent(t){
  if(!t || !t.fromEvent) return null;
  return checklistEvents.find(x => x.id === t.fromEvent) || null;
}

/* ---------- MERGE UI ---------- */
function toggleMergeSelect(eventId){
  if(selectedForMerge.has(eventId)) selectedForMerge.delete(eventId);
  else selectedForMerge.add(eventId);
  updateHomeCheckboxes();
  renderMergePanel();
}

function updateHomeCheckboxes(){
  document.querySelectorAll('.home-event[data-event-id]').forEach(el => {
    const id = el.dataset.eventId;
    const cb = el.querySelector('.merge-checkbox');
    if(cb) cb.classList.toggle('checked', selectedForMerge.has(id));
  });
}

function renderMergePanel(){
  const host = document.getElementById('mergePanelHost');
  if(!host) return;

  if(selectedForMerge.size < 2){
    host.innerHTML = '';
    return;
  }

  host.innerHTML = `
    <div class="merge-panel">
      <div class="merge-count">
        Выбрано: <b>${selectedForMerge.size}</b>
      </div>
      <button class="merge-btn-cancel" onclick="clearMergeSelection()">Отмена</button>
      <button class="merge-btn-go" onclick="createMergedEvent()">Объединить и анализировать</button>
    </div>
  `;
}

function clearMergeSelection(){
  selectedForMerge.clear();
  renderMergePanel();
  updateHomeCheckboxes();
}

function createMergedEvent(){
  const ids = [...selectedForMerge];
  if(ids.length < 2) return;

  const children = ids
    .map(id => checklistEvents.find(x => x.id === id))
    .filter(Boolean)
    .filter(e => e.status === 'new');

  if(children.length < 2){
    alert('Можно объединять только новые события');
    clearMergeSelection();
    return;
  }

  const minCreatedAt = Math.min(...children.map(c => c.createdAt || Date.now()));
  const minDate = children.map(c => c.date).sort()[0];

  const merged = {
    id: uid(),
    date: minDate,
    source: 'merged',
    refId: null,
    title: null,
    detail: null,
    crumb: null,
    createdAt: minCreatedAt,
    status: 'in_progress',
    analysisStartedAt: Date.now(),
    analysisDeadline: Date.now() + ANALYSIS_TIMEOUT_MS,
    resolvedAt: null,
    solution: null,
    childrenIds: children.map(c => c.id),
    mergedIntoId: null,
    manualType: null
  };

  children.forEach(c => {
    c.status = 'merged';
    c.mergedIntoId = merged.id;
  });

  checklistEvents.push(merged);
  store.set('checklistEvents', checklistEvents);

  selectedForMerge.clear();
  activeAnalysisEventId = merged.id;

  renderAnalysis();
  startAnalysisTicker();
  if(typeof renderChecklist === 'function') renderChecklist();
}

/* ---------- РЕНДЕР ЭКРАНА ---------- */
function renderAnalysis(){
  refreshNumbers();

  const isFocused = !!activeAnalysisEventId;
  const focusEl = document.getElementById('analysisFocus');
  const homeEl = document.getElementById('analysisHome');
  if(!focusEl || !homeEl) return;

  if(isFocused){
    const e = checklistEvents.find(x => x.id === activeAnalysisEventId);
    if(!e || e.status === 'resolved'){
      activeAnalysisEventId = null;
      stopAnalysisTicker();
      renderAnalysis();
      return;
    }
    focusEl.style.display = 'flex';
    homeEl.style.display = 'none';
    renderAnalysisFocus(e);
    startAnalysisTicker();
    renderMergePanel();
  } else {
    focusEl.style.display = 'none';
    homeEl.style.display = 'flex';
    stopAnalysisTicker();
    renderAnalysisHome();
    renderMergePanel();
  }
}

function renderAnalysisFocus(e){
  const focusEl = document.getElementById('analysisFocus');
  const isMerged = e.source === 'merged';
  const isManualWant = e.source === 'manual' && e.manualType === 'want';
  const isManualResult = e.source === 'manual' && e.manualType === 'result';

  let headerHtml = '';

  if(isMerged){
    const kids = getMergedChildren(e);
    const kidsHtml = kids.map(k => {
      const meta = sourceMeta(k.source, k.manualType);
      const crumb = k.crumb ? ` <span class="focus-kid-crumb">· ${escapeHtml(k.crumb)}</span>` : '';
      return `<div class="focus-kid"><span class="focus-kid-icon">${meta.icon}</span><span class="focus-kid-label">${meta.label}</span><span class="focus-kid-title">${escapeHtml(k.title)}</span>${crumb}</div>`;
    }).join('');

    headerHtml = `
      <div class="focus-event-meta">
        <span class="event-source merged">🔗 Объединённый анализ</span>
      </div>
      <div class="focus-event-title">${kids.length} ${plural(kids.length,'событие','события','событий')}</div>
      <div class="focus-kids">${kidsHtml}</div>
    `;
  } else {
    const meta = sourceMeta(e.source, e.manualType);
    const crumb = e.crumb ? `<div class="focus-event-crumb">${escapeHtml(e.crumb)}</div>` : '';
    headerHtml = `
      <div class="focus-event-meta">
        <span class="event-date">${fmtEventDate(e.date)}</span>
        <span class="event-source ${meta.cls}">${meta.icon} ${meta.label}</span>
      </div>
      <div class="focus-event-title">${escapeHtml(e.title)}</div>
      ${crumb}
      <div class="focus-event-detail">${escapeHtml(e.detail)}</div>
    `;
  }

  const canDelete = isManualWant || (isMerged && isAllManualDeletableMerge(e));

  const placeholder = isManualResult
    ? 'Что ты ожидал? Что получилось? Где расхождение?'
    : 'Почему это произошло? Что общего между этими событиями?';

  focusEl.innerHTML = `
    <div class="focus-panel${isManualResult ? ' focus-panel-result' : ''}">
      <div class="focus-head">
        <div class="focus-event-info">${headerHtml}</div>
        <div class="focus-timer-wrap">
          <div class="focus-timer-label">Осталось</div>
          <div class="focus-timer" id="focusTimer">15:00</div>
        </div>
      </div>

      <div class="focus-body">
        <div class="focus-field">
          <label class="focus-label">Анализ проблемы</label>
          <textarea class="focus-textarea" id="focusNote" placeholder="${placeholder}"></textarea>
        </div>
        <div class="focus-field">
          <label class="focus-label">Гипотеза / действие</label>
          <textarea class="focus-textarea" id="focusAction"
            placeholder="Что нужно сделать, чтобы это не повторилось?"></textarea>
        </div>
      </div>

      <div class="focus-actions">
        <button class="btn-cancel-focus" onclick="minimizeAnalysis()">Свернуть</button>
        ${canDelete ? `<button class="btn-cancel-focus danger" onclick="deleteManualAnalysis()">Удалить без решения</button>` : ''}
        <button class="btn-save-focus" onclick="saveAnalysis()">Сохранить и закрыть</button>
      </div>
    </div>
  `;

  const timer = document.getElementById('focusTimer');
  if(timer) updateTimerDisplay(timer);

  ['focusNote','focusAction'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('keydown', ev => {
      if(ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) saveAnalysis();
    });
  });
}

function renderAnalysisHome(){
  const homeEl = document.getElementById('analysisHome');
  const active = checklistEvents
    .filter(e => e.status === 'new' || e.status === 'in_progress')
    .sort((a,b) => b.date.localeCompare(a.date));

  const eventsHtml = active.length === 0
    ? `<div class="empty" style="padding:20px;"><span class="empty-icon" style="font-size:24px;">✨</span>Нет активных событий</div>`
    : active.map(e => {
        const meta = sourceMeta(e.source, e.manualType);
        const label = e.status === 'in_progress' ? 'Продолжить' : 'Принять меры';
        const click = e.status === 'in_progress'
          ? `resumeAnalysisFromEvent('${e.id}')`
          : `startAnalysisFromEvent('${e.id}')`;
        const checked = selectedForMerge.has(e.id) ? 'checked' : '';
        const canSelect = e.status === 'new';

        const title = e.source === 'merged'
          ? `${getMergedChildren(e).length} ${plural(getMergedChildren(e).length,'событие','события','событий')}`
          : escapeHtml(e.title);

        const detail = e.source === 'merged'
          ? getMergedChildren(e).map(k => escapeHtml(k.title)).join(' · ')
          : escapeHtml(e.detail);

        return `
          <div class="home-event${e.status === 'in_progress' ? ' in-progress' : ''}${e.source === 'manual' && e.manualType === 'result' ? ' is-result' : ''}" data-event-id="${e.id}">
            <div class="home-event-row">
              ${canSelect ? `<div class="merge-checkbox ${checked}" onclick="toggleMergeSelect('${e.id}')"></div>` : ''}
              <span class="home-event-date">${fmtEventDate(e.date)}</span>
              <span class="home-event-source">${meta.icon} ${meta.label}</span>
            </div>
            <div class="home-event-title">${title}</div>
            <div class="home-event-detail">${detail}</div>
            <button class="btn-take-action small" onclick="${click}">${label}</button>
          </div>`;
      }).join('');

  // ---------- История анализа (мысли) ----------
  const thoughtsHtml = thoughts.length === 0
    ? `<div class="empty" style="padding:20px;"><span class="empty-icon" style="font-size:24px;">📝</span>Пока пусто</div>`
    : thoughts.map(t => {
        const num = thoughtNums[t.id] || '?';
        const dt = new Date(t.date);
        const dateStr = dt.toLocaleDateString('ru-RU', { day:'numeric', month:'short' });
        const event = findThoughtEvent(t);
        const originHtml = renderEventOrigin(event);

        const ruleBadges = (t.rules || []).map(rid => {
          const r = rules.find(x => x.id === rid);
          if(!r) return '';
          return `<div class="rule-badge">→ ${escapeHtml(r.text)}</div>`;
        }).join('');

        return `
          <div class="thought">
            <div class="thought-text">${escapeHtml(t.text)}</div>
            <div class="origin-block">${originHtml}</div>
            ${ruleBadges}
            <div class="thought-meta">
              <div class="thought-meta-left">
                <span class="num-badge">#${num}</span>
                <span>${dateStr}</span>
              </div>
            </div>
          </div>`;
      }).join('');

  // ---------- Действия (правила) ----------
  const rulesHtml = rules.length === 0
    ? `<div class="empty" style="padding:20px;"><span class="empty-icon" style="font-size:24px;">⚡</span>Нет действий</div>`
    : rules.map(r => {
        const num = ruleNums[r.id] || '?';
        const thought = r.from ? thoughts.find(x => x.id === r.from) : null;
        const event = thought ? findThoughtEvent(thought) : null;
        const originHtml = renderEventOrigin(event);
        const fromNumHtml = thought
          ? `<div class="origin-from">из анализа #${thoughtNums[thought.id] || '?'}</div>`
          : '';

        return `
          <div class="rule">
            <div class="rule-num">${num}</div>
            <div class="rule-body">
              <div class="rule-text">${escapeHtml(r.text)}</div>
              <div class="origin-block">${originHtml}</div>
              ${fromNumHtml}
            </div>
          </div>`;
      }).join('');

  homeEl.innerHTML = `
    <div class="analysis-home-cols">
      <div class="analysis-col">
        <div class="analysis-section-title">Требуют внимания</div>
        <div class="analysis-events-list">${eventsHtml}</div>

        <div class="analysis-section-title" style="margin-top:24px;">История анализа</div>
        <div class="list" style="gap:8px;">${thoughtsHtml}</div>
      </div>
      <div class="analysis-col">
        <div class="analysis-section-title">Действия</div>
        <div class="list" style="gap:8px;">${rulesHtml}</div>
      </div>
    </div>
  `;
}

/* ---------- СОХРАНЕНИЕ ---------- */
function saveAnalysis(){
  const noteEl = document.getElementById('focusNote');
  const actEl = document.getElementById('focusAction');
  if(!noteEl || !actEl) return;

  const note = noteEl.value.trim();
  const action = actEl.value.trim();

  if(!note){ alert('Напиши анализ проблемы'); noteEl.focus(); return; }
  if(!action){ alert('Опиши гипотезу / действие'); actEl.focus(); return; }

  const e = checklistEvents.find(x => x.id === activeAnalysisEventId);
  if(!e) return;

  if(e.analysisDeadline && Date.now() > e.analysisDeadline){
    if(typeof triggerBlock === 'function') triggerBlock('analysis_timeout', [e.id]);
    return;
  }

  const thought = {
    id: uid(),
    text: note,
    date: new Date().toISOString(),
    fromEvent: e.id,
    rules: []
  };
  thoughts.unshift(thought);

  const rule = {
    id: uid(),
    text: action,
    from: thought.id,
    date: new Date().toISOString()
  };
  rules.unshift(rule);
  thought.rules.push(rule.id);

  e.analysisId = thought.id;

  store.set('thoughts', thoughts);
  store.set('rules', rules);
  store.set('checklistEvents', checklistEvents);

  resolveEvent(e.id, action);

  activeAnalysisEventId = null;
  stopAnalysisTicker();

  renderAnalysis();
  renderChecklist();
  if(typeof renderKanban === 'function') renderKanban();
}

function minimizeAnalysis(){
  activeAnalysisEventId = null;
  renderAnalysis();
}

function deleteManualAnalysis(){
  const e = checklistEvents.find(x => x.id === activeAnalysisEventId);
  if(!e) return;

  const canDelete =
    (e.source === 'manual' && e.manualType === 'want') ||
    (e.source === 'merged' && isAllManualDeletableMerge(e));

  if(!canDelete) return;
  if(!confirm('Удалить событие без решения?')) return;

  if(e.source === 'merged'){
    unmergeEvent(e.id);
  } else {
    checklistEvents = checklistEvents.filter(x => x.id !== e.id);
    store.set('checklistEvents', checklistEvents);
  }

  activeAnalysisEventId = null;
  stopAnalysisTicker();

  renderAnalysis();
  renderChecklist();
}
