/* ==================================================================
   БЛОК СИСТЕМЫ — 3 причины блокировки:
   1) 24ч без реакции на событие
   2) Просрочен таймер анализа
   3) Одна сущность провалена ≥3 раз за текущий месяц
================================================================== */

function checkSystemBlock(){
  if(!isStarted()){
    return;
  }
   
  if(systemBlock.active){
    const overlay = document.getElementById('blockOverlay');
    if(overlay && overlay.classList.contains('open')){
      return;
    }
    renderSystemBlock();
    return;
  }

  const now = Date.now();
  const active = checklistEvents.filter(e =>
    e.status === 'new' || e.status === 'in_progress'
  );

  // 1) 24ч без реакции
  for(const e of active){
    if(e.status === 'new' && (now - e.createdAt) > EVENT_TIMEOUT_MS){
      triggerBlock('timeout_24h', [e.id]);
      return;
    }
  }

  // 2) Просрочен таймер анализа
  for(const e of active){
    if(e.status === 'in_progress' && e.analysisDeadline && now > e.analysisDeadline){
      triggerBlock('analysis_timeout', [e.id]);
      return;
    }
  }

  // 3) Систематический провал (≥3 раза за месяц)
  const repeats = findRepeatFails();
  if(repeats.length > 0){
    const first = repeats[0];
    triggerBlock(
      'repeat_fail',
      first.events.map(e => e.id),
      {
        source: first.source,
        refId: first.refId,
        title: first.title,
        count: first.events.length
      }
    );
    return;
  }
}

/* ---------- ПОИСК ПОВТОРНЫХ ПРОВАЛОВ ---------- */
function findRepeatFails(){
  const acknowledged = store.get('repeatBlocksAcknowledged', []);
  const now = new Date();
  const ym = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth()+1, 0);

  const groups = {};

  checklistEvents.forEach(e => {
    if(e.source !== 'habit' && e.source !== 'kanban') return;
    if(!e.refId) return;
    const d = new Date(e.date + 'T12:00:00');
    if(isNaN(d)) return;
    if(d < monthStart || d > monthEnd) return;

    const key = e.source + ':' + e.refId;
    if(!groups[key]){
      groups[key] = {
        source: e.source,
        refId: e.refId,
        title: e.title,
        events: []
      };
    }
    groups[key].events.push(e);
  });

  return Object.values(groups).filter(g => {
    if(g.events.length < 3) return false;
    const ackKey = g.source + ':' + g.refId + ':' + ym;
    return !acknowledged.includes(ackKey);
  });
}

/* ---------- ТРИГГЕР БЛОКА ---------- */
function triggerBlock(reason, eventIds, meta){
  systemBlock.active = true;
  systemBlock.reason = reason;
  systemBlock.blockedAt = Date.now();
  systemBlock.events = eventIds;
  systemBlock.meta = meta || null;
  systemBlock.resolution = null;
  store.set('systemBlock', systemBlock);
  renderSystemBlock(true);
}

/* ---------- РЕНДЕР БЛОКА ---------- */
function renderSystemBlock(force){
  const overlay = document.getElementById('blockOverlay');
  if(!overlay) return;

  if(!systemBlock.active){
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    return;
  }

  if(overlay.classList.contains('open') && !force){
    return;
  }

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  const card = document.getElementById('blockCard');
  const blockedEvents = systemBlock.events
    .map(id => checklistEvents.find(e => e.id === id))
    .filter(Boolean);

  let reasonTitle, reasonMessage;

  if(systemBlock.reason === 'analysis_timeout'){
    reasonTitle = '⏱ Анализ просрочен';
    reasonMessage = 'Система заблокирована. Обсуди проблемы с внешним человеком — тренером, другом, наставником — и зафиксируй решения.';
  } else if(systemBlock.reason === 'repeat_fail' && systemBlock.meta){
    reasonTitle = '🔁 Систематический провал';
    const m = systemBlock.meta;
    const srcLabel = m.source === 'habit' ? 'Привычка' : 'Задача';
    reasonMessage = `<b>${escapeHtml(m.title)}</b><br><span style="font-size:13px;opacity:0.75;">${srcLabel} провалена <b>${m.count}</b> раз за этот месяц. Это уже паттерн, а не случайность. Обсуди с ментором.</span>`;
  } else {
    reasonTitle = '⚠ Требуется внешняя помощь';
    reasonMessage = 'Система заблокирована. Обсуди проблемы с внешним человеком — тренером, другом, наставником — и зафиксируй решения.';
  }

  // ---------- Список проблем ----------
  function eventBlockHtml(e){
    let src, title, detailHtml, childrenHtml = '';

    if(e.source === 'merged'){
      src = '🔗 Объединено';
      const kids = getMergedChildren(e);
      title = `${kids.length} ${plural(kids.length,'событие','события','событий')}`;
      detailHtml = '';
      childrenHtml = `<div class="block-event-children">${kids.map(k => {
        const icon = k.source === 'habit' ? '🎯' : (k.source === 'kanban' ? '📋' : '💭');
        const label = k.source === 'habit' ? 'ЗОЖ'
                    : (k.source === 'kanban' ? 'Канбан'
                    : (k.manualType === 'result' ? 'Результат' : 'Своё'));
        return `<div class="block-event-child"><span>${icon}</span><span class="block-event-child-label">${label}</span><span class="block-event-child-title">${escapeHtml(k.title)}</span></div>`;
      }).join('')}</div>`;
    } else if(e.source === 'habit'){
      src = '🎯 ЗОЖ';
      title = e.title;
      detailHtml = `<div class="block-event-detail">${escapeHtml(e.detail)}</div>`;
    } else if(e.source === 'kanban'){
      src = '📋 Канбан';
      title = e.title;
      detailHtml = `<div class="block-event-detail">${escapeHtml(e.detail)}</div>`;
    } else if(e.source === 'manual'){
      src = e.manualType === 'result' ? '🎯 Результат' : '💭 Своё';
      title = e.title;
      detailHtml = `<div class="block-event-detail">${escapeHtml(e.detail)}</div>`;
    } else {
      src = 'Событие';
      title = e.title || '(без названия)';
      detailHtml = '';
    }

    return `
      <div class="block-event-item">
        <div class="block-event-head">
          <span class="block-event-date">${fmtEventDate(e.date)}</span>
          <span class="block-event-source">${src}</span>
        </div>
        <div class="block-event-title">${escapeHtml(title)}</div>
        ${detailHtml}
        ${childrenHtml}
      </div>`;
  }

  const eventsListHtml = blockedEvents.map(eventBlockHtml).join('');

  // ---------- Форма решений ----------
  // Для repeat_fail — одна форма на всю группу (это одна проблема, а не три)
  // Для остальных — по одной форме на каждое событие
  let solutionsFormHtml;

  if(systemBlock.reason === 'repeat_fail' && systemBlock.meta){
    solutionsFormHtml = `
      <div class="block-solution-row">
        <div class="block-solution-label">${escapeHtml(systemBlock.meta.title)}</div>
        <textarea class="block-solution-input" data-solution-for-all="1"
          placeholder="Что решили по этому систематическому провалу?"></textarea>
      </div>`;
  } else {
    solutionsFormHtml = blockedEvents.map(e => {
      let label;
      if(e.source === 'merged'){
        const kids = getMergedChildren(e);
        label = `${kids.length} ${plural(kids.length,'событие','события','событий')} (объединённые)`;
      } else {
        label = e.title || '(без названия)';
      }
      return `
        <div class="block-solution-row">
          <div class="block-solution-label">${escapeHtml(label)}</div>
          <textarea class="block-solution-input" data-solution-for="${e.id}"
            placeholder="Что решили по этой проблеме?"></textarea>
        </div>`;
    }).join('');
  }

  card.innerHTML = `
    <div class="block-title">${reasonTitle}</div>
    <div class="block-message">${reasonMessage}</div>

    <div class="block-events-title">Проблемы:</div>
    <div class="block-events-list">${eventsListHtml}</div>

    <div class="block-form">
      <div class="block-solution-row">
        <label class="block-solution-label" for="blockDiscussedWith">С кем обсудил</label>
        <input class="block-solution-input" id="blockDiscussedWith" name="blockDiscussedWith"
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

/* ---------- ПОДТВЕРЖДЕНИЕ ---------- */
function confirmBlockResolution(){
  const who = document.getElementById('blockDiscussedWith');
  const whoVal = who ? who.value.trim() : '';
  if(!whoVal){
    alert('Укажи, с кем обсудил');
    if(who) who.focus();
    return;
  }

  const now = Date.now();
  const isRepeat = systemBlock.reason === 'repeat_fail' && systemBlock.meta;

  if(isRepeat){
    // Одно решение на всю группу — разрезолвить все события одним текстом
    const ta = document.querySelector('.block-solution-input[data-solution-for-all]');
    const text = ta ? ta.value.trim() : '';
    if(!text){
      alert('Заполни решение');
      if(ta) ta.focus();
      return;
    }

    systemBlock.events.forEach(id => {
      if(typeof resolveEvent === 'function') resolveEvent(id, text);
    });

    // Запоминаем, что паттерн за этот месяц разобран
    const d = new Date();
    const ym = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    const m = systemBlock.meta;
    const ackKey = m.source + ':' + m.refId + ':' + ym;
    const acknowledged = store.get('repeatBlocksAcknowledged', []);
    if(!acknowledged.includes(ackKey)){
      acknowledged.push(ackKey);
      store.set('repeatBlocksAcknowledged', acknowledged);
    }
  } else {
    // По одной форме на событие
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

    solutions.forEach(s => {
      if(typeof resolveEvent === 'function'){
        resolveEvent(s.eventId, s.text);
      } else {
        const e = checklistEvents.find(x => x.id === s.eventId);
        if(e){
          e.status = 'resolved';
          e.resolvedAt = now;
          e.solution = s.text;
        }
      }
    });
    store.set('checklistEvents', checklistEvents);
  }

  systemBlock = {
    active: false,
    reason: null,
    blockedAt: null,
    events: [],
    meta: null,
    resolution: {
      discussedWith: whoVal,
      resolvedAt: now
    }
  };
  store.set('systemBlock', systemBlock);

  const overlay = document.getElementById('blockOverlay');
  if(overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';

  if(typeof renderChecklist === 'function') renderChecklist();
  if(typeof renderAnalysis === 'function') renderAnalysis();
  if(typeof renderKanban === 'function') renderKanban();
}
