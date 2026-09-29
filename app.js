/* ==================================================================
   НАВИГАЦИЯ + INIT
================================================================== */

const SCREENS = ['goals','routine','checklist','analysis'];
let currentIndex = 0;
let globalTicker = null;

function updateScreenHeight(){
  document.documentElement.style.setProperty('--screen-h', window.innerHeight + 'px');
  applyFlowTransform();
}

function applyFlowTransform(){
  const flow = document.getElementById('flow');
  if(!flow) return;
  flow.style.transform = `translateY(${-currentIndex * window.innerHeight}px)`;
}

function goTo(index){
  if(index < 0 || index >= SCREENS.length) return;
  currentIndex = index;
  applyFlowTransform();
  const v = SCREENS[index];
  if(location.hash.slice(1) !== v){
    history.replaceState(null, '', '#' + v);
  }
  // при заходе на чеклист — перегенерируем события
  if(v === 'checklist' && typeof renderChecklist === 'function') renderChecklist();
  // при заходе на анализ — рендерим
  if(v === 'analysis' && typeof renderAnalysis === 'function') renderAnalysis();
}

function goDown(){ goTo(currentIndex + 1); }
function goUp(){ goTo(currentIndex - 1); }

/* ============ INIT ============ */
function init(){
  // генерим события Чеклиста на старте
  if(typeof generateChecklistEvents === 'function') generateChecklistEvents();

  // рендер всех вьюх
  renderGoalList();
  renderHabits();
  renderKanban();
  renderChecklist();
  renderAnalysis();

  updateScreenHeight();
  const startView = (location.hash || '').replace('#','');
  const startIdx = SCREENS.indexOf(startView);
  currentIndex = startIdx >= 0 ? startIdx : 0;
  applyFlowTransform();

  // обработчики
  const goalInput = document.getElementById('goalInput');
  if(goalInput) goalInput.addEventListener('keydown', e => {
    if(e.key === 'Enter') addGoal();
  });

  const habitInput = document.getElementById('habitInput');
  if(habitInput) habitInput.addEventListener('keydown', e => {
    if(e.key === 'Enter') addHabit();
  });

  const presets = document.getElementById('presets');
  if(presets) presets.addEventListener('click', e => {
    const btn = e.target.closest('.preset');
    if(!btn) return;
    document.querySelectorAll('.preset').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    habitDraft = {
      target: parseInt(btn.dataset.target, 10),
      period: btn.dataset.period
    };
  });

  window.addEventListener('resize', updateScreenHeight);
  window.addEventListener('orientationchange', () => setTimeout(updateScreenHeight, 100));

  window.addEventListener('hashchange', () => {
    const v = (location.hash || '').replace('#','');
    const i = SCREENS.indexOf(v);
    if(i >= 0 && i !== currentIndex){
      currentIndex = i;
      applyFlowTransform();
      if(v === 'checklist' && typeof renderChecklist === 'function') renderChecklist();
      if(v === 'analysis' && typeof renderAnalysis === 'function') renderAnalysis();
    }
  });

  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && detailHabitId) closeHabitModal();
    if(detailHabitId) return;
    // стрелки — только если фокус не в поле ввода
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if(tag === 'INPUT' || tag === 'TEXTAREA') return;
    if(e.key === 'ArrowDown' || e.key === 'PageDown') goDown();
    if(e.key === 'ArrowUp'   || e.key === 'PageUp')   goUp();
  });

  // глобальный тикер: проверка блока раз в 15 сек
  if(globalTicker) clearInterval(globalTicker);
  globalTicker = setInterval(() => {
    if(typeof generateChecklistEvents === 'function') generateChecklistEvents();
    if(typeof checkSystemBlock === 'function') checkSystemBlock();
  }, 15000);

  // единоразовая проверка
  if(typeof checkSystemBlock === 'function') checkSystemBlock();
}

init();
