/* Zion Clothing — verso digitado, letras reunidas em Z, depois ZION.
   Abertura independente do catálogo, executada a cada carregamento. */
(() => {
  const overlay = document.getElementById('zionIntro');
  if (!overlay) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    overlay.remove();
    return;
  }

  const timing = {gather:1400,zReady:2220,wordmark:2700,end:4300};
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
        glyphs.push({letter,rect,fontSize:style.fontSize,fontFamily:style.fontFamily,fontWeight:style.fontWeight,lineHeight:style.lineHeight,letterSpacing:style.letterSpacing});
      }
    }
    if (!glyphs.length) {
      overlay.classList.add('is-gathering','is-forming');
      return;
    }

    // A nuvem de letras desenha as mesmas proporções do Z definitivo.
    const solidZ = overlay.querySelector('.zion-intro__z');
    const zRect = solidZ?.getBoundingClientRect();
    const width = Math.max(42,(zRect?.width || Math.min(160,frame.width*.16))*.83);
    const height = Math.max(55,(zRect?.height || Math.min(160,frame.height*.22))*.82);
    const fragment = document.createDocumentFragment();
    glyphs.forEach((glyph) => {
      const particle = document.createElement('span');
      particle.className = 'zion-intro__particle';
      particle.textContent = glyph.letter;
      particle.style.left = (glyph.rect.left-frame.left)+'px';
      particle.style.top = (glyph.rect.top-frame.top)+'px';
      particle.style.fontSize = glyph.fontSize;
      particle.style.fontFamily = glyph.fontFamily;
      particle.style.fontWeight = glyph.fontWeight;
      particle.style.lineHeight = glyph.lineHeight;
      particle.style.letterSpacing = glyph.letterSpacing;
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
      // Morph contínuo: as letras saem exatamente da posição original,
      // percorrem os traços do Z, engrossam e se fundem à letra sólida.
      // Elas encolhem para dentro do Z; nenhuma opacidade é animada.
      particles[i].animate([
        {transform:transform(0,0,1),textShadow:'0 0 0 transparent',offset:0},
        {transform:transform(dx*.36,dy*.36,1.04),textShadow:'0 0 0 transparent',offset:.35},
        {transform:transform(dx,dy,1.68),textShadow:'0 0 7px rgba(240,237,225,.75),1px 0 #f0ede1,-1px 0 #f0ede1',offset:.82},
        {transform:transform(dx,dy,1.12),textShadow:'0 0 3px rgba(240,237,225,.7),1px 0 #f0ede1',offset:.94},
        {transform:transform(dx,dy,.04),textShadow:'0 0 0 transparent',offset:1}
      ],{duration:980,delay:(i%7)*11,easing:'cubic-bezier(.52,.08,.24,1)',fill:'forwards'});
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
  // O Z nasce por baixo das letras enquanto elas se comprimem na
  // silhueta, eliminando a troca instantânea que parecia travada.
  timers.push(window.setTimeout(() => {if(!ended)overlay.classList.add('is-z-ready');},timing.zReady));
  timers.push(window.setTimeout(() => {
    if (ended) return;
    const wordmark = overlay.querySelector('.zion-intro__wordmark');
    const suffix = overlay.querySelector('.zion-intro__ion');
    if (!wordmark || !suffix) {
      overlay.classList.add('is-wordmark');
      return;
    }
    // Calcula a distância antes do primeiro frame. O Z permanece centralizado
    // enquanto a próxima palavra é preparada, sem alteração do layout.
    const width = suffix.getBoundingClientRect().width;
    if (width > 0) {
      wordmark.style.setProperty('--zion-ion-shift',(-width / 2).toFixed(2)+'px');
    }
    if (!width || typeof wordmark.animate !== 'function' ||
        typeof suffix.animate !== 'function') {
      overlay.classList.add('is-wordmark'); // alternativa CSS
      return;
    }

    // Dois movimentos no mesmo relógio: o Z desliza com aceleração suave
    // e ION é descoberto pela máscara, sem empurrar o Z ou piscar.
    overlay.classList.add('is-smooth-wordmark','is-wordmark');
    wordmark.animate([
      {transform:'translate3d(0px,0,0)'},
      {transform:'translate3d('+(-width*.5).toFixed(2)+'px,0,0)'}
    ],{duration:980,easing:'cubic-bezier(.42,0,.17,1)',fill:'forwards'});
    suffix.animate([
      {clipPath:'inset(0 100% 0 0)',transform:'translate3d(-.12em,0,0)'},
      {clipPath:'inset(0 0% 0 0)',transform:'translate3d(0,0,0)'}
    ],{duration:860,delay:105,easing:'cubic-bezier(.35,0,.22,1)',fill:'forwards'});
  },timing.wordmark));
  timers.push(window.setTimeout(finish,timing.end));
})();
