/* ==================================================================
   STORE + UTILS + ГЛОБАЛЬНЫЙ STATE
================================================================== */

const store = {
  get(k, def){
    try{ const v = JSON.parse(localStorage.getItem(k)); return v === null ? def : v; }
    catch{ return def; }
  },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};

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

/* Дедлайн: { text, diff, level } или null */
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

/* Таймстамп дедлайна для сортировки (без дедлайна — в самый низ) */
function deadlineTime(dl){
  if(!dl) return Infinity;
  const d = new Date(dl + 'T12:00:00');
  return isNaN(d) ? Infinity : d.getTime();
}

/* Эффективный статус шага: если есть подшаги — от них, иначе ручной */
function stepEffectiveStatus(step){
  const subs = step.substeps || [];
  if(subs.length === 0) return step.status || 'todo';
  const statuses = subs.map(s => s.status || 'todo');
  if(statuses.every(s => s === 'done')) return 'done';
  if(statuses.some(s => s === 'done' || s === 'doing')) return 'doing';
  return 'todo';
}

/* ============ ГЛОБАЛЬНЫЙ STATE ============ */
let habits  = store.get('habits', []);
let thoughts = store.get('thoughts', []);
let rules   = store.get('rules', []);
let goals   = store.get('goals', []);

/* ============ МИГРАЦИЯ ============ */
habits.forEach(h => {
  if(!h.log) h.log = {};
  if(!h.createdAt) h.createdAt = todayStr();
});

goals.forEach(g => {
  if(g.deadline === undefined) g.deadline = null;
  if(!Array.isArray(g.steps)) g.steps = [];
  g.steps.forEach(s => {
    if(s.deadline === undefined) s.deadline = null;
    if(s.status === undefined) s.status = s.done ? 'done' : 'todo';
    if(!Array.isArray(s.substeps)) s.substeps = [];
    s.substeps.forEach(ss => {
      if(ss.deadline === undefined) ss.deadline = null;
      if(ss.status === undefined) ss.status = 'todo';
    });
  });
});

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
