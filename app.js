/* ==================================================================
   НАВИГАЦИЯ + INIT
   Подключается ПОСЛЕДНИМ, после всех вьюх.
================================================================== */

const SCREENS = ['goals','routine','checklist','analysis'];
let currentIndex = 0;

function updateScreenHeight(){
  document.documentElement.style.setProperty('--screen-h', window.innerHeight + 'px');
  applyFlowTransform();
}

function applyFlowTransform(){
  const flow = document.getElementById('flow');
  if(!flow) return;
  flow.style.transform = `translateY(${-currentIndex * window.innerHeight}px)`;
}

function updateDots(){
  document.querySelectorAll('.screen-dots').forEach(dots => {
    dots.innerHTML = SCREENS.map((_, j) =>
      `<span class="${j === currentIndex ? 'active' : ''}"></span>`
    ).join('');
  });
}

function goTo(index){
  if(index < 0 || index >= SCREENS.length) return;
  currentIndex = index;
  applyFlowTransform();
  updateDots();
  const v = SCREENS[index];
  if(location.hash.slice(1) !== v){
    history.replaceState(null, '', '#' + v);
  }
}

function goDown(){ goTo(currentIndex + 1); }
function goUp(){ goTo(currentIndex - 1); }

/* ============ INIT ============ */
function init(){
  // рендер всех экранов
  renderGoalList();
  renderHabits();
  renderThoughts();
  renderRules();

  // навигация
  updateScreenHeight();
  const startView = (location.hash || '').replace('#','');
  const startIdx = SCREENS.indexOf(startView);
  currentIndex = startIdx >= 0 ? startIdx : 0;
  applyFlowTransform();
  updateDots();

  // события: цели
  const goalInput = document.getElementById('goalInput');
  if(goalInput) goalInput.addEventListener('keydown', e => {
    if(e.key === 'Enter') addGoal();
  });

  // события: привычки
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

  // события: анализ
  const thoughtInput = document.getElementById('thoughtInput');
  if(thoughtInput) thoughtInput.addEventListener('keydown', e => {
    if(e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addThought();
  });

  // общие события
  window.addEventListener('resize', updateScreenHeight);
  window.addEventListener('orientationchange', () => setTimeout(updateScreenHeight, 100));

  window.addEventListener('hashchange', () => {
    const v = (location.hash || '').replace('#','');
    const i = SCREENS.indexOf(v);
    if(i >= 0 && i !== currentIndex){
      currentIndex = i;
      applyFlowTransform();
      updateDots();
    }
  });

  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && detailHabitId) closeHabitModal();
    if(detailHabitId) return;
    if(e.key === 'ArrowDown' || e.key === 'PageDown') goDown();
    if(e.key === 'ArrowUp'   || e.key === 'PageUp')   goUp();
  });
}

init();