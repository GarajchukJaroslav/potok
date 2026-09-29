/* ==================================================================
   STORE + UTILS + ГЛОБАЛЬНЫЙ STATE
   Подключается ПЕРВЫМ. Все остальные скрипты используют эти функции.
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

/* ============ ГЛОБАЛЬНЫЙ STATE ============ */
let habits  = store.get('habits', []);
let thoughts = store.get('thoughts', []);
let rules   = store.get('rules', []);
let goals   = store.get('goals', []);

// нормализация старых данных привычек
habits.forEach(h => {
  if(!h.log) h.log = {};
  if(!h.createdAt) h.createdAt = todayStr();
});

/* ============ НУМЕРАЦИЯ (Анализ / Действия) ============ */
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