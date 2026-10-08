/* Zion Clothing — verso digitado, letras reunidas em Z, depois ZION.
   Abertura independente do catálogo, executada a cada carregamento. */
(() => {
  const overlay = document.getElementById('zionIntro');
  if (!overlay) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    overlay.remove();
    return;
  }

  const timing = {gather:2050,zReady:3120,wordmark:3550,end:4970};
  const timers = [], particles = [];
  let ended = false;
  const onEscape = e => { if (e.key === 'Escape') finish(); };

  function finish() {
    if (ended) return;
    ended = true;
    timers.forEach(window.clearTimeout);
    document.removeEventListener('keydown',onEscape);
    particles.forEach(node => node.remove());
    overlay.classList.add('is-exiting');
    document.body.classList.remove('zion-intro-lock');
    window.setTimeout(() => overlay.remove(),780);
  }

  function zPoint(index,total,width,height) {
    const t = total <= 1 ? 0 : index/(total-1);
    const seg = t*3;
    const u = seg<1 ? seg : seg<2 ? seg-1 : seg-2;
    if (seg<1) return {x:(u-.5)*width,y:-height/2};
    if (seg<2) return {x:(.5-u)*width,y:(u-.5)*height};
    return {x:(u-.5)*width,y:height/2};
  }

  function gatherLetters() {
    if (ended) return;
    const quote = overlay.querySelector('.zion-intro__quote');
    if (!quote || !document.createRange || !Element.prototype.animate) {
      overlay.classList.add('is-gathering','is-forming');
      return;
    }
    const frame = overlay.getBoundingClientRect();
    const glyphs = [];
    for (const line of quote.querySelectorAll('.zion-intro__line')) {
      const text = line.firstChild;
      if (!text || text.nodeType !== Node.TEXT_NODE) continue;
      const style = window.getComputedStyle(line);
      for (let i=0;i<text.length;i++) {
        const letter = text.textContent[i];
        if (!letter || !letter.trim()) continue;
        const range = document.createRange();
        range.setStart(text,i);
        range.setEnd(text,i+1);
        const rect = range.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        glyphs.push({letter,rect,fontSize:style.fontSize,fontFamily:style.fontFamily});
      }
    }
    if (!glyphs.length) {
      overlay.classList.add('is-gathering','is-forming');
      return;
    }

    const width = Math.min(210,Math.max(100,frame.width*.18));
    const height = Math.min(225,Math.max(115,frame.height*.28));
    const fragment = document.createDocumentFragment();
    glyphs.forEach((glyph) => {
      const particle = document.createElement('span');
      particle.className = 'zion-intro__particle';
      particle.textContent = glyph.letter;
      particle.style.left = (glyph.rect.left-frame.left)+'px';
      particle.style.top = (glyph.rect.top-frame.top)+'px';
      particle.style.fontSize = glyph.fontSize;
      particle.style.fontFamily = glyph.fontFamily;
      fragment.appendChild(particle);
      particles.push(particle);
    });
    overlay.appendChild(fragment);
    overlay.classList.add('is-gathering','is-forming');

    glyphs.forEach((glyph,i) => {
      const target = zPoint(i,glyphs.length,width,height);
      const originX = glyph.rect.left-frame.left+glyph.rect.width/2;
      const originY = glyph.rect.top-frame.top+glyph.rect.height/2;
      const dx = frame.width/2+target.x-originX;
      const dy = frame.height/2+target.y-originY;
      const transform = (x,y,size) =>
        'translate3d('+x.toFixed(1)+'px,'+y.toFixed(1)+'px,0) scale('+size+')';
      particles[i].animate([
        {transform:transform(0,0,1),opacity:1,offset:0},
        {transform:transform(dx*.7,dy*.7,.72),opacity:1,offset:.7},
        {transform:transform(dx,dy,.38),opacity:0,offset:1}
      ],{duration:870,delay:(i%12)*10,easing:'cubic-bezier(.65,.02,.23,1)',fill:'forwards'});
    });
  }

  overlay.hidden = false;
  document.body.classList.add('zion-intro-lock');
  document.getElementById('skipZionIntro')?.addEventListener('click',finish,{once:true});
  document.addEventListener('keydown',onEscape);
  window.requestAnimationFrame(() =>
    window.requestAnimationFrame(() => overlay.classList.add('is-typing'))
  );
  timers.push(window.setTimeout(gatherLetters,timing.gather));
  timers.push(window.setTimeout(() => {if(!ended)overlay.classList.add('is-z-ready');},timing.zReady));
  timers.push(window.setTimeout(() => {if(!ended)overlay.classList.add('is-wordmark');},timing.wordmark));
  timers.push(window.setTimeout(finish,timing.end));
})();
