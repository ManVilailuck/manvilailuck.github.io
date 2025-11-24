document.addEventListener('DOMContentLoaded', function(){
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(a=>{
    try{
      if (a.getAttribute('href') === path) a.classList.add('active');
      const dt = a.querySelector('decrypted-text');
      if (dt) {
        // Forward hover events from the anchor to the custom element so it can animate
        a.addEventListener('mouseenter', ()=> dt.dispatchEvent(new Event('mouseenter', {bubbles:true, cancelable:true})));
        a.addEventListener('mouseleave', ()=> dt.dispatchEvent(new Event('mouseleave', {bubbles:true, cancelable:true})));
        // Ensure clicks always activate the anchor even if decrypted-text has pointer-events
        a.addEventListener('click', (e)=> { /* no-op, anchor naturally handles navigation */ });
      }
    }catch(err){console.warn('nav wiring failed', err)}
  });
});
