/* ==================================================================
   ЭКРАН «АНАЛИЗ → ДЕЙСТВИЯ»
================================================================== */

let promotingThoughtId = null;
let editingThoughtId = null;

function addThought(){
  const inp = document.getElementById('thoughtInput');
  const v = inp.value.trim();
  if(!v) return;
  thoughts.unshift({
    id: uid(),
    text: v,
    date: new Date().toISOString(),
    rules: []
  });
  inp.value = '';
  store.set('thoughts', thoughts);
  renderThoughts();
  inp.focus();
}

function delThought(id){
  thoughts = thoughts.filter(t => t.id !== id);
  store.set('thoughts', thoughts);
  renderThoughts();
}

function startPromote(id){
  promotingThoughtId = id;
  editingThoughtId = null;
  renderThoughts();
  setTimeout(() => {
    const ta = document.querySelector('.rule-input');
    if(ta){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }, 50);
}

function confirmPromote(){
  const ta = document.querySelector('.rule-input');
  if(!ta) return;
  const text = ta.value.trim();
  if(!text) return;
  const t = thoughts.find(x => x.id === promotingThoughtId);
  if(!t) return;
  const rule = { id: uid(), text, from: t.id, date: new Date().toISOString() };
  rules.unshift(rule);
  if(!t.rules) t.rules = [];
  t.rules.push(rule.id);
  store.set('rules', rules);
  store.set('thoughts', thoughts);
  promotingThoughtId = null;
  renderThoughts();
  renderRules();
}

function cancelPromote(){ promotingThoughtId = null; renderThoughts(); }

function startEdit(id){
  editingThoughtId = id;
  promotingThoughtId = null;
  renderThoughts();
  setTimeout(() => {
    const ta = document.querySelector('.note-edit');
    if(ta){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }, 50);
}

function saveEdit(){
  const ta = document.querySelector('.note-edit');
  if(!ta) return;
  const text = ta.value.trim();
  if(!text) return;
  const t = thoughts.find(x => x.id === editingThoughtId);
  if(!t) return;
  t.text = text;
  store.set('thoughts', thoughts);
  editingThoughtId = null;
  renderThoughts();
}

function cancelEdit(){ editingThoughtId = null; renderThoughts(); }

function renderThoughts(){
  refreshNumbers();
  const list = document.getElementById('thoughtList');
  if(!list) return;
  list.innerHTML = '';
  if(thoughts.length === 0){
    list.innerHTML = '<div class="empty"><span class="empty-icon">✍️</span>Здесь будет анализ.<br>Пиши проблему — потом вытащишь из неё действие.</div>';
  }
  thoughts.forEach(t => {
    const num = thoughtNums[t.id];
    const el = document.createElement('div');
    el.className = 'thought';

    if(t.id === promotingThoughtId){
      el.classList.add('editing-promote');
      el.innerHTML = `
        <div class="thought-original">${escapeHtml(t.text)}</div>
        <div class="promote-label">→ ЧТО С ЭТИМ ДЕЛАТЬ?</div>
        <textarea class="rule-input" placeholder="Например: проработать травму">${escapeHtml(t.text)}</textarea>
        <div class="promote-actions">
          <button class="btn-mini primary" onclick="confirmPromote()">→ В действия</button>
          <button class="btn-mini" onclick="cancelPromote()">Отмена</button>
        </div>`;
    } else if(t.id === editingThoughtId){
      el.classList.add('editing-note');
      el.innerHTML = `
        <div class="edit-label">✎ РЕДАКТИРОВАНИЕ <span style="color:var(--muted); font-weight:500;">#${num}</span></div>
        <textarea class="rule-input note-edit">${escapeHtml(t.text)}</textarea>
        <div class="promote-actions">
          <button class="btn-mini primary note-save" onclick="saveEdit()">Сохранить</button>
          <button class="btn-mini" onclick="cancelEdit()">Отмена</button>
        </div>`;
    } else {
      const dt = new Date(t.date);
      const dateStr = dt.toLocaleDateString('ru-RU', { day:'numeric', month:'short' });
      const ruleBadges = (t.rules || []).map(rid => {
        const r = rules.find(x => x.id === rid);
        if(!r) return '';
        return `<div class="rule-badge">→ ${escapeHtml(r.text)}</div>`;
      }).join('');
      el.innerHTML = `
        <div>${escapeHtml(t.text)}</div>
        ${ruleBadges}
        <div class="thought-meta">
          <div class="thought-meta-left">
            <span class="num-badge">#${num}</span>
            <span>${dateStr}</span>
          </div>
          <div class="thought-actions">
            <button class="icon-btn" onclick="startEdit('${t.id}')" title="редактировать">✎</button>
            <button class="promote" onclick="startPromote('${t.id}')">→ в действие</button>
            <button class="icon-btn danger" onclick="delThought('${t.id}')">✕</button>
          </div>
        </div>`;
    }
    list.appendChild(el);
  });
}

function delRule(id){
  rules = rules.filter(r => r.id !== id);
  thoughts.forEach(t => { if(t.rules) t.rules = t.rules.filter(rid => rid !== id); });
  store.set('rules', rules);
  store.set('thoughts', thoughts);
  renderRules();
  renderThoughts();
}

function renderRules(){
  refreshNumbers();
  const list = document.getElementById('ruleList');
  if(!list) return;
  list.innerHTML = '';
  if(rules.length === 0){
    list.innerHTML = '<div class="empty"><span class="empty-icon">⚡</span>Действия появятся здесь,<br>когда ты вытащишь их из анализа.</div>';
  }
  rules.forEach(r => {
    const num = ruleNums[r.id];
    const el = document.createElement('div');
    el.className = 'rule';
    const origin = r.from
      ? (() => {
          const t = thoughts.find(x => x.id === r.from);
          if(!t) return '';
          const tNum = thoughtNums[t.id];
          return `<div class="rule-origin">из анализа #${tNum}: ${escapeHtml(t.text.slice(0,120))}${t.text.length>120?'…':''}</div>`;
        })()
      : '';
    el.innerHTML = `
      <div class="rule-num">${num}</div>
      <div class="rule-body">
        <div>${escapeHtml(r.text)}</div>
        ${origin}
      </div>
      <button class="icon-btn danger" onclick="delRule('${r.id}')">✕</button>`;
    list.appendChild(el);
  });
}