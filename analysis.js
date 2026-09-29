/* ==================================================================
   ЭКРАН «АНАЛИЗ → ДЕЙСТВИЯ»
   Мысли создаются только из событий Чеклиста, с таймером 15 мин.
   Для manual-событий есть опция «удалить без решения».
================================================================== */

let activeAnalysisEventId = null;
let analysisTicker = null;

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
  if(typeof goTo === 'function') goTo(3);
  renderAnalysis();
  startAnalysisTicker();
}

function resumeAnalysisFromEvent(eventId){
  const e = checklistEvents.find(x => x.id === eventId);
  if(!e || e.status !== 'in_progress') return;
  activeAnalysisEventId = eventId;
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

/* ---------- РЕНДЕР ---------- */
function renderAnalysis(){
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
  } else {
    focusEl.style.display = 'none';
    homeEl.style.display = 'flex';
    stopAnalysisTicker();
    renderAnalysisHome();
  }
}

function renderAnalysisFocus(e){
  const focusEl = document.getElementById('analysisFocus');
  const isManual = e.source === 'manual';
  const sourceLabel = e.source === 'habit' ? 'ЗОЖ' : (e.source === 'kanban' ? 'Канбан' : 'Своё событие');
  const sourceIcon = e.source === 'habit' ? '🎯' : (e.source === 'kanban' ? '📋' : '💭');
  const crumb = e.crumb ? `<div class="focus-event-crumb">${escapeHtml(e.crumb)}</div>` : '';

  const cancelBtn = isManual
    ? `<button class="btn-cancel-focus danger" onclick="deleteManualAnalysis()">Удалить без решения</button>`
    : `<button class="btn-cancel-focus" onclick="cancelAnalysis()">Свернуть</button>`;

  focusEl.innerHTML = `
    <div class="focus-panel">
      <div class="focus-head">
        <div class="focus-event-info">
          <div class="focus-event-meta">
            <span class="event-date">${fmtEventDate(e.date)}</span>
            <span class="event-source ${e.source}">${sourceIcon} ${sourceLabel}</span>
          </div>
          <div class="focus-event-title">${escapeHtml(e.title)}</div>
          ${crumb}
          <div class="focus-event-detail">${escapeHtml(e.detail)}</div>
        </div>
        <div class="focus-timer-wrap">
          <div class="focus-timer-label">Осталось</div>
          <div class="focus-timer" id="focusTimer">15:00</div>
        </div>
      </div>

      <div class="focus-body">
        <div class="focus-field">
          <label class="focus-label">Анализ проблемы</label>
          <textarea class="focus-textarea" id="focusNote"
            placeholder="Почему это произошло? Что помешало? Что смущает?"></textarea>
        </div>
        <div class="focus-field">
          <label class="focus-label">Гипотеза / действие</label>
          <textarea class="focus-textarea" id="focusAction"
            placeholder="Что нужно сделать, чтобы это не повторилось?"></textarea>
        </div>
      </div>

      <div class="focus-actions">
        <button class="btn-cancel-focus" onclick="minimizeAnalysis()">Свернуть</button>
        ${isManual ? `<button class="btn-cancel-focus danger" onclick="deleteManualAnalysis()">Удалить без решения</button>` : ''}
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
  const newEvents = checklistEvents
    .filter(e => e.status !== 'resolved')
    .sort((a,b) => b.date.localeCompare(a.date));

  const eventsHtml = newEvents.length === 0
    ? `<div class="empty" style="padding:20px;"><span class="empty-icon" style="font-size:24px;">✨</span>Нет активных событий</div>`
    : newEvents.map(e => {
        const src = e.source === 'habit' ? '🎯 ЗОЖ'
                  : e.source === 'kanban' ? '📋 Канбан'
                  : '💭 Своё';
        const label = e.status === 'in_progress' ? 'Продолжить' : 'Принять меры';
        const click = e.status === 'in_progress'
          ? `resumeAnalysisFromEvent('${e.id}')`
          : `startAnalysisFromEvent('${e.id}')`;
        return `
          <div class="home-event${e.status === 'in_progress' ? ' in-progress' : ''}">
            <div class="home-event-row">
              <span class="home-event-date">${fmtEventDate(e.date)}</span>
              <span class="home-event-source">${src}</span>
            </div>
            <div class="home-event-title">${escapeHtml(e.title)}</div>
            <div class="home-event-detail">${escapeHtml(e.detail)}</div>
            <button class="btn-take-action small" onclick="${click}">${label}</button>
          </div>`;
      }).join('');

  const thoughtsHtml = thoughts.length === 0
    ? `<div class="empty" style="padding:20px;"><span class="empty-icon" style="font-size:24px;">📝</span>Пока пусто</div>`
    : thoughts.map(t => {
        const num = thoughtNums[t.id] || '?';
        const dt = new Date(t.date);
        const dateStr = dt.toLocaleDateString('ru-RU', { day:'numeric', month:'short' });
        const ruleBadges = (t.rules || []).map(rid => {
          const r = rules.find(x => x.id === rid);
          if(!r) return '';
          return `<div class="rule-badge">→ ${escapeHtml(r.text)}</div>`;
        }).join('');
        return `
          <div class="thought">
            <div>${escapeHtml(t.text)}</div>
            ${ruleBadges}
            <div class="thought-meta">
              <div class="thought-meta-left">
                <span class="num-badge">#${num}</span>
                <span>${dateStr}</span>
              </div>
            </div>
          </div>`;
      }).join('');

  const rulesHtml = rules.length === 0
    ? `<div class="empty" style="padding:20px;"><span class="empty-icon" style="font-size:24px;">⚡</span>Нет действий</div>`
    : rules.map(r => {
        const num = ruleNums[r.id] || '?';
        const origin = r.from
          ? (() => {
              const t = thoughts.find(x => x.id === r.from);
              if(!t) return '';
              const tn = thoughtNums[t.id] || '?';
              return `<div class="rule-origin">из анализа #${tn}: ${escapeHtml(t.text.slice(0,100))}${t.text.length>100?'…':''}</div>`;
            })()
          : '';
        return `
          <div class="rule">
            <div class="rule-num">${num}</div>
            <div class="rule-body">
              <div>${escapeHtml(r.text)}</div>
              ${origin}
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

/* ---------- ДЕЙСТВИЯ ---------- */
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

  e.status = 'resolved';
  e.resolvedAt = Date.now();
  e.analysisId = thought.id;
  e.solution = action;

  store.set('thoughts', thoughts);
  store.set('rules', rules);
  store.set('checklistEvents', checklistEvents);

  activeAnalysisEventId = null;
  stopAnalysisTicker();

  renderAnalysis();
  renderChecklist();
  if(typeof renderKanban === 'function') renderKanban();
}

/* Свернуть фокус — таймер продолжает идти */
function minimizeAnalysis(){
  activeAnalysisEventId = null;
  renderAnalysis();
}

/* Удалить manual-событие без решения */
function deleteManualAnalysis(){
  const e = checklistEvents.find(x => x.id === activeAnalysisEventId);
  if(!e) return;
  if(e.source !== 'manual') return;
  if(!confirm('Удалить событие без решения?')) return;

  checklistEvents = checklistEvents.filter(x => x.id !== e.id);
  store.set('checklistEvents', checklistEvents);

  activeAnalysisEventId = null;
  stopAnalysisTicker();

  renderAnalysis();
  renderChecklist();
}
