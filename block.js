/* ==================================================================
   БЛОК СИСТЕМЫ — при 24h без реакции или просрочке таймера анализа
================================================================== */

function checkSystemBlock(){
  if(systemBlock.active){
    renderSystemBlock();
    return;
  }

  const now = Date.now();
  const active = checklistEvents.filter(e =>
    e.status === 'new' || e.status === 'in_progress'
  );

  // 24h без реакции
  for(const e of active){
    if(e.status === 'new' && (now - e.createdAt) > EVENT_TIMEOUT_MS){
      triggerBlock('timeout_24h', [e.id]);
      return;
    }
  }

  // Просрочка таймера анализа
  for(const e of active){
    if(e.status === 'in_progress' && e.analysisDeadline && now > e.analysisDeadline){
      triggerBlock('analysis_timeout', [e.id]);
      return;
    }
  }
}

function triggerBlock(reason, eventIds){
  systemBlock.active = true;
  systemBlock.reason = reason;
  systemBlock.blockedAt = Date.now();
  systemBlock.events = eventIds;
  systemBlock.resolution = null;
  store.set('systemBlock', systemBlock);
  renderSystemBlock();
}

function renderSystemBlock(){
  const overlay = document.getElementById('blockOverlay');
  if(!overlay) return;

  if(!systemBlock.active){
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    return;
  }

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  const card = document.getElementById('blockCard');
  const blockedEvents = systemBlock.events
    .map(id => checklistEvents.find(e => e.id === id))
    .filter(Boolean);

  const reasonTitle = systemBlock.reason === 'analysis_timeout'
    ? '⏱ Анализ просрочен'
    : '⚠ Требуется внешняя помощь';

  const eventsListHtml = blockedEvents.map(e => {
    const src = e.source === 'habit' ? 'ЗОЖ' : 'Канбан';
    return `
      <div class="block-event-item">
        <div class="block-event-head">
          <span class="block-event-date">${fmtEventDate(e.date)}</span>
          <span class="block-event-source">${src}</span>
        </div>
        <div class="block-event-title">${escapeHtml(e.title)}</div>
        <div class="block-event-detail">${escapeHtml(e.detail)}</div>
      </div>`;
  }).join('');

  const solutionsFormHtml = blockedEvents.map(e => `
    <div class="block-solution-row">
      <div class="block-solution-label">${escapeHtml(e.title)}</div>
      <textarea class="block-solution-input" data-solution-for="${e.id}"
        placeholder="Что решили по этой проблеме?"></textarea>
    </div>
  `).join('');

  card.innerHTML = `
    <div class="block-title">${reasonTitle}</div>
    <div class="block-message">
      Система заблокирована. Обсуди проблемы с внешним человеком —
      тренером, другом, наставником — и зафиксируй решения.
    </div>

    <div class="block-events-title">Проблемы:</div>
    <div class="block-events-list">${eventsListHtml}</div>

    <div class="block-form">
      <div class="block-solution-row">
        <div class="block-solution-label">С кем обсудил</div>
        <input class="block-solution-input" id="blockDiscussedWith"
          type="text" placeholder="Имя / кто это">
      </div>
      <div class="block-events-title" style="margin-top:18px;">Решения:</div>
      ${solutionsFormHtml}
    </div>

    <button class="block-confirm-btn" onclick="confirmBlockResolution()">
      Подтвердить, что обсудил
    </button>
  `;
}

function confirmBlockResolution(){
  const who = document.getElementById('blockDiscussedWith');
  const whoVal = who ? who.value.trim() : '';
  if(!whoVal){
    alert('Укажи, с кем обсудил');
    if(who) who.focus();
    return;
  }

  const inputs = document.querySelectorAll('.block-solution-input[data-solution-for]');
  const solutions = [];
  for(const inp of inputs){
    const v = inp.value.trim();
    if(!v){
      alert('Заполни решение по каждой проблеме');
      inp.focus();
      return;
    }
    solutions.push({ eventId: inp.dataset.solutionFor, text: v });
  }

  // Применяем: каждое событие -> resolved + solution
  const now = Date.now();
  solutions.forEach(s => {
    const e = checklistEvents.find(x => x.id === s.eventId);
    if(e){
      e.status = 'resolved';
      e.resolvedAt = now;
      e.solution = s.text;
    }
  });
  store.set('checklistEvents', checklistEvents);

  systemBlock = {
    active: false,
    reason: null,
    blockedAt: null,
    events: [],
    resolution: {
      discussedWith: whoVal,
      solutions,
      resolvedAt: now
    }
  };
  store.set('systemBlock', systemBlock);

  // Закрываем overlay
  const overlay = document.getElementById('blockOverlay');
  if(overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';

  // Перерисовываем всё что зависит
  if(typeof renderChecklist === 'function') renderChecklist();
  if(typeof renderAnalysis === 'function') renderAnalysis();
  if(typeof renderKanban === 'function') renderKanban();
}
