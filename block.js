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

  const now = Date.now();
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

  const overlay = document.getElementById('blockOverlay');
  if(overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';

  if(typeof renderChecklist === 'function') renderChecklist();
  if(typeof renderAnalysis === 'function') renderAnalysis();
  if(typeof renderKanban === 'function') renderKanban();
}
