(() => {
  // Avoid conflicts with page globals
  const API = "/api/chatbot";

  function el(html){ const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild }

  // Create button (uses Petzi emoji as fallback icon)
  const btn = el(`<div class="petzi-bot-button" title="Petzi Assistant"><span class="petzi-bot-icon">🐾</span></div>`);
  document.body.appendChild(btn);

  // Create window
  const win = el(`<div class="petzi-bot-window" style="display:none">
    <div class="petzi-bot-header"><strong>🐾 Petzi Assistant</strong><button class="petzi-bot-close" style="background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer">✕</button></div>
    <div class="petzi-bot-body"><div class="petzi-bot-welcome petzi-bot-message petzi-bot-bot-message">Hello! 👋 I'm Petzi, your pet-care assistant. Ask me anything about pets.</div></div>
    <div class="petzi-bot-footer"><input class="petzi-bot-input" placeholder="Ask about your pet..."/><button class="petzi-bot-send">➤</button></div>
  </div>`);
  document.body.appendChild(win);

  const input = win.querySelector('.petzi-bot-input');
  const send = win.querySelector('.petzi-bot-send');
  const body = win.querySelector('.petzi-bot-body');
  const close = win.querySelector('.petzi-bot-close');

  function addMessage(text, cls){
    const m = document.createElement('div'); m.className = `petzi-bot-message ${cls}`; m.textContent = text; body.appendChild(m); body.scrollTop = body.scrollHeight; }

  let busy = false;
  async function sendMessage(){
    if (busy) return; const msg = input.value && input.value.trim(); if (!msg) { addMessage("Please type a question about pets.", 'petzi-bot-user-message'); return }
    addMessage(msg, 'petzi-bot-user-message'); input.value = '';
    busy = true; const typ = document.createElement('div'); typ.className='petzi-bot-message petzi-bot-bot-message petzi-bot-typing'; typ.textContent='Petzi is typing…'; body.appendChild(typ); body.scrollTop = body.scrollHeight;
    try{
      const r = await fetch(API, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message:msg})});
      const j = await r.json();
      typ.remove();
      if (j && j.reply) addMessage(j.reply, 'petzi-bot-bot-message'); else addMessage('Sorry, I could not process that right now.', 'petzi-bot-bot-message');
    }catch(e){ typ.remove(); addMessage('Network error. Please try again.', 'petzi-bot-bot-message'); }
    busy = false;
  }

  btn.addEventListener('click', ()=>{ win.style.display = 'flex'; input.focus(); });
  close.addEventListener('click', ()=>{ win.style.display = 'none'; });
  send.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') sendMessage(); });

  // expose quick API for debug
  window._petziBot = { open: ()=> btn.click() };
})();
