/* ==================================================================
   STORE + UTILS + ГЛОБАЛЬНЫЙ STATE + ЖУРНАЛ
   Цели → Проекты (точка А → вехи → точка B)
================================================================== */

const store = {
  get(k, def){
    try{ const v = JSON.parse(localStorage.getItem(k)); return v === null ? def : v; }
    catch{ return def; }
  },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};

const SYSTEM_START_DATE = '2026-10-04';

function isAfterStart(dateStr){
  if(!dateStr) return true;
  return dateStr >= SYSTEM_START_DATE;
}

function dayStr(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
const todayStr = () => dayStr(new Date());

function getWeekDaysFrom(date){
  const d = new Date(date);
  d.setHours(0,0,0,0);
  const wd = d.getDay();
  const diff = wd === 0 ? -6 : 1 - wd;
  d.setDate(d.getDate() + diff);
  const days = [];
  for(let i=0;i<7;i++){
    const dd = new Date(d);
    dd.setDate(d.getDate() + i);
    days.push(dayStr(dd));
  }
  return days;
}
const getWeekDays = () => getWeekDaysFrom(new Date());

function plural(n, one, few, many){
  const m10 = n % 10, m100 = n % 100;
  if(m10 === 1 && m100 !== 11) return one;
  if(m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

function fmtFreq(target, period){
  if(period === 'day'){
    if(target === 1) return 'каждый день';
    return `${target} ${plural(target,'раз','раза','раз')} в день`;
  }
  return `${target} ${plural(target,'раз','раза','раз')} в неделю`;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function deadlineInfo(dateStr){
  if(!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  if(isNaN(d)) return null;
  const today = new Date();
  today.setHours(0,0,0,0);
  const target = new Date(d);
  target.setHours(0,0,0,0);
  const diff = Math.round((target - today) / 86400000);
  let level = 'future';
  if(diff < 0) level = 'overdue';
  else if(diff === 0) level = 'today';
  else if(diff <= 3) level = 'soon';
  const text = d.toLocaleDateString('ru-RU', { day:'numeric', month:'short' });
  return { text, diff, level };
}

function fmtEventDate(dateStr){
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('ru-RU', { day:'numeric', month:'long' });
}

/* ============ ЖУРНАЛ ============ */
function logAction(type, entity, extra){
  const log = store.get('actionLog', []);
  log.push({
    id: uid(),
    ts: Date.now(),
    date: todayStr(),
    type,
    entity: entity || null,
    ...(extra || {})
  });
  store.set('actionLog', log);
  return log[log.length - 1];
}

function getActionLog(){
  return store.get('actionLog', []);
}

/* ============ ГЛОБАЛЬНЫЙ STATE ============ */
let habits  = store.get('habits', []);
let thoughts = store.get('thoughts', []);
let rules   = store.get('rules', []);
let goals   = store.get('goals', []);   // проекты (оставляем имя переменной)
let checklistEvents = store.get('checklistEvents', []);
let systemBlock = store.get('systemBlock', { active:false, reason:null, blockedAt:null, events:[], resolution:null });
let currentManualType = store.get('manualCurrentType', 'want');

/* ============ МИГРАЦИЯ ============ */
habits.forEach(h => {
  if(!h.log) h.log = {};
  if(!h.createdAt) h.createdAt = todayStr();
  if(!Array.isArray(h.notes)) h.notes = [];
  if(h.period === 'day' && h.target > 1){
    if(!h.slots) h.slots = {};
    Object.keys(h.log).forEach(d => {
      if(!h.slots[d]){
        const n = h.log[d] || 0;
        const arr = [];
        for(let i = 0; i < h.target; i++) arr.push(i < n);
        h.slots[d] = arr;
      }
    });
  }
});

// goals: старая структура (steps/substeps/result) → новая (milestones)
goals.forEach(g => {
  if(g.pointA === undefined) g.pointA = '';
  if(g.startDate === undefined){
    g.startDate = g.date ? g.date.slice(0,10) : todayStr();
  }
  if(g.endDate === undefined){
    g.endDate = g.deadline || null;
  }
  if(g.done === undefined) g.done = false;
  if(!Array.isArray(g.notes)) g.notes = [];

  // миграция steps → milestones
  if(!Array.isArray(g.milestones)){
    const steps = g.steps || [];
    g.milestones = steps.map(s => ({
      id: s.id || uid(),
      title: s.text || '',
      date: s.deadline || null,
      status: s.status === 'done' ? 'done' : (s.status === 'doing' ? 'doing' : 'todo')
    }));
  }
  // старые поля чистим, чтобы не путались
  delete g.steps;
  delete g.deadline;

  // у milestones проверим поля
  g.milestones.forEach(m => {
    if(m.status === undefined) m.status = 'todo';
    if(m.date === undefined) m.date = null;
    if(m.title === undefined) m.title = '';
  });
});

checklistEvents.forEach(e => {
  if(e.status === undefined) e.status = 'new';
  if(e.analysisStartedAt === undefined) e.analysisStartedAt = null;
  if(e.analysisDeadline === undefined) e.analysisDeadline = null;
  if(e.resolvedAt === undefined) e.resolvedAt = null;
  if(e.childrenIds === undefined) e.childrenIds = null;
  if(e.mergedIntoId === undefined) e.mergedIntoId = null;
  if(e.source === 'manual' && !e.manualType) e.manualType = 'want';
  if(e.source === 'result' && e.achieved === undefined) e.achieved = true;
});

/* ============ ХЕЛПЕРЫ MERGED ============ */
function getMergedChildren(e){
  if(!e || e.source !== 'merged' || !Array.isArray(e.childrenIds)) return [];
  return e.childrenIds
    .map(id => checklistEvents.find(x => x.id === id))
    .filter(Boolean);
}

function isAllManualDeletableMerge(e){
  const kids = getMergedChildren(e);
  if(kids.length === 0) return false;
  return kids.every(k => k.source === 'manual' && k.manualType === 'want');
}

function resolveEvent(eventId, solution){
  const e = checklistEvents.find(x => x.id === eventId);
  if(!e) return;
  const now = Date.now();
  e.status = 'resolved';
  e.resolvedAt = now;
  e.solution = solution;

  if(e.source === 'merged' && Array.isArray(e.childrenIds)){
    e.childrenIds.forEach(cid => {
      const c = checklistEvents.find(x => x.id === cid);
      if(c){
        c.status = 'resolved';
        c.resolvedAt = now;
        c.solution = solution;
        c.mergedIntoId = e.id;
      }
    });
  }
  store.set('checklistEvents', checklistEvents);
}

function unmergeEvent(mergedId){
  const e = checklistEvents.find(x => x.id === mergedId);
  if(!e || e.source !== 'merged') return;
  if(Array.isArray(e.childrenIds)){
    e.childrenIds.forEach(cid => {
      const c = checklistEvents.find(x => x.id === cid);
      if(c && c.status === 'merged'){
        c.status = 'new';
        c.mergedIntoId = null;
      }
    });
  }
  checklistEvents = checklistEvents.filter(x => x.id !== mergedId);
  store.set('checklistEvents', checklistEvents);
}

/* ============ НУМЕРАЦИЯ ============ */
let thoughtNums = {};
let ruleNums = {};

function refreshNumbers(){
  const entities = [];
  const thoughtMap = {};

  thoughts.forEach(t => {
    const e = { date: new Date(t.date).getTime() || 0, thought: t, rules: [] };
    thoughtMap[t.id] = e;
    entities.push(e);
  });

  rules.forEach(r => {
    if(r.from && thoughtMap[r.from]) thoughtMap[r.from].rules.push(r);
    else entities.push({ date: new Date(r.date).getTime() || 0, thought: null, rules: [r] });
  });

  entities.sort((a,b) => a.date - b.date);

  thoughtNums = {};
  ruleNums = {};
  entities.forEach((e, i) => {
    const num = i + 1;
    if(e.thought) thoughtNums[e.thought.id] = num;
    e.rules.forEach(r => { ruleNums[r.id] = num; });
  });
}

/* ============ ПРОЕКТ: РАСЧЁТЫ ============ */
function projectProgress(g){
  const ms = g.milestones || [];
  const done = ms.filter(m => m.status === 'done').length;
  return { done, total: ms.length };
}

/* Позиция точки на таймлайне (0-100%) по дате */
function milestonePosition(g, m){
  if(!g.startDate || !g.endDate || !m.date) return null;
  const s = new Date(g.startDate + 'T12:00:00').getTime();
  const e = new Date(g.endDate + 'T12:00:00').getTime();
  const d = new Date(m.date + 'T12:00:00').getTime();
  if(isNaN(s) || isNaN(e) || isNaN(d) || e <= s) return null;
  let p = ((d - s) / (e - s)) * 100;
  if(p < 0) p = 0;
  if(p > 100) p = 100;
  return p;
}

/* ============ ТАЙМЕРЫ ============ */
const EVENT_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const ANALYSIS_TIMEOUT_MS = 15 * 60 * 1000;
