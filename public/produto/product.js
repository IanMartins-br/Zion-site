/* Página exclusiva de produto Zion. Frete ilustrativo, sem API Correios/checkout. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const money = amount => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(amount);
  const displayName = name => String(name??'').replace(/\s*[-–—]\s*(?:240|170)\s*g\s*$/i,'').trim();
  const safeImage = url => typeof url==='string' && (
    /^\/media\/products\/[a-f0-9-]{36}\.(jpg|png|webp|avif)$/.test(url) ||
    /^\/assets\/zion-(0770|0779|0790|0791|0799|cover-wide|go-into-all-world-capa|go-into-world-capa-v2|go-into-world-capa-v3|go-into-world-(786|787|788|789|790)|oba-(capa|capa-v3|77[4-8]))\.webp$/.test(url)
  );
  const url = new URL(window.location.href);
  const id = url.searchParams.get('id');
  let item = null, selectedSize = '', quantity = 1;
  const showError = () => {$('#pageLoading').hidden=true;$('#pageError').hidden=false;};

  function renderGallery(photoUrls) {
    const images=[...new Set(photoUrls)].filter(safeImage);
    const list=$('#productPhotoStack');
    const scroller=$('#productGalleryScroll');
    list.replaceChildren();
    if(!images.length){
      list.textContent='Fotos deste produto disponíveis em breve.';
      $('#photoIndex').textContent='00 / 00';
      return;
    }
    images.forEach((src,i)=>{
      const figure=document.createElement('figure');
      figure.className='gallery-shot';
      const photo=document.createElement('img');
      photo.src=src;
      photo.alt=item.name+' — imagem '+(i+1)+' de '+images.length;
      photo.loading=i===0?'eager':'lazy';
      photo.decoding='async';
      figure.appendChild(photo);
      const caption=document.createElement('figcaption');
      caption.textContent='ZION / '+String(i+1).padStart(2,'0');
      figure.appendChild(caption);
      list.appendChild(figure);
    });
    const shots=Array.from(list.children);
    let pending=false;
    function updateGallery(){
      pending=false;
      const parent=scroller.getBoundingClientRect();
      const center=parent.top+parent.height/2;
      let best=0,dist=Infinity;
      shots.forEach((shot,index)=>{
        const rect=shot.getBoundingClientRect();
        const distance=(rect.top+rect.height/2-center)/Math.max(parent.height,1);
        if(Math.abs(distance)<dist){dist=Math.abs(distance);best=index}
        shot.style.setProperty('--scroll-tilt',Math.max(-1.8,Math.min(1.8,distance*1.8)).toFixed(2)+'deg');
        shot.style.setProperty('--scroll-depth',(-Math.min(8,Math.abs(distance)*8)).toFixed(1)+'px');
      });
      $('#photoIndex').textContent=String(best+1).padStart(2,'0')+' / '+String(images.length).padStart(2,'0');
    }
    scroller.addEventListener('scroll',()=>{
      if(!pending){pending=true;requestAnimationFrame(updateGallery)}
    },{passive:true});
    requestAnimationFrame(updateGallery);
  }

  function updatePurchase() {
    const available=Number(item.stock?.[selectedSize]||0);
    if(available>0 && quantity>available) quantity=available;
    $('#qtyValue').textContent=String(quantity);
    $('#qtyLess').disabled=quantity<=1;
    $('#qtyMore').disabled=!selectedSize || quantity>=available;
    const buy=$('#buyButton');
    buy.disabled=available===0;
    buy.innerHTML=available>0?'COMPRAR AGORA <span>↗</span>':'SELECIONE UM TAMANHO <span>↗</span>';
    $('#stockFeedback').textContent=available>0
      ? available===1?'Última unidade disponível neste tamanho.':'Disponível: '+available+' unidade(s).'
      :selectedSize?'Este tamanho está esgotado.':'Escolha um tamanho disponível.';
  }

  function renderSizes(product) {
    const sizes=['P','M','G','GG'];
    for(const size of Array.isArray(product.sizes)?product.sizes:[]) {
      if(!sizes.includes(size)) sizes.push(size);
    }
    const box=$('#sizePicker');
    box.replaceChildren();
    sizes.forEach(size=>{
      const btn=document.createElement('button');
      btn.type='button';btn.className='size';btn.textContent=size;
      btn.setAttribute('aria-label','Tamanho '+size+(product.stock?.[size]>0?' disponível':' esgotado'));
      const qty=Number(product.stock?.[size]||0);
      btn.disabled=qty<=0;
      btn.setAttribute('aria-pressed','false');
      btn.addEventListener('click',()=>{
        selectedSize=size;quantity=1;
        box.querySelectorAll('.size').forEach(b=>{
          b.classList.toggle('selected',b===btn);
          b.setAttribute('aria-pressed',String(b===btn));
        });
        updatePurchase();
      });
      box.appendChild(btn);
    });
    updatePurchase();
  }

  function simulateShipping(zip) {
    const prefix=Number(zip.slice(0,2));
    // Valores DEMONSTRATIVOS baseados apenas em regiões postais amplas.
    // Não são tarifas de SEDEX, não geram etiqueta e nunca serão cobrados.
    let estimate=39.90;
    if(prefix>=30 && prefix<=39) estimate=24.90;
    else if(prefix>=1 && prefix<=19) estimate=34.90;
    else if(prefix>=20 && prefix<=29) estimate=35.90;
    else if(prefix>=40 && prefix<=65) estimate=45.90;
    else if(prefix>=66 && prefix<=79) estimate=52.90;
    else if(prefix>=80 && prefix<=99) estimate=42.90;
    return estimate;
  }

  function setupShipping() {
    const input=$('#zipCode');
    input.addEventListener('input',()=>{
      const clean=input.value.replace(/\D/g,'').slice(0,8);
      input.value=clean.length>5?clean.slice(0,5)+'-'+clean.slice(5):clean;
    });
    $('#shippingForm').addEventListener('submit',event=>{
      event.preventDefault();
      const clean=input.value.replace(/\D/g,'');
      const out=$('#shippingResult');
      if(!/^\d{8}$/.test(clean) || /^0{8}$/.test(clean)){
        out.textContent='Informe um CEP válido com 8 dígitos.';
        return;
      }
      out.replaceChildren();
      const name=document.createElement('strong');
      name.textContent='Simulação expressa: '+money(simulateShipping(clean));
      const label=document.createElement('span');
      label.textContent=' Referência ilustrativa inspirada no SEDEX, sem cotação oficial ou prazo garantido.';
      out.append(name,label);
    });
  }

  function addToCart() {
    if(!item||!selectedSize||!(Number(item.stock?.[selectedSize])>=quantity))return;
    let current=[];
    try{const data=JSON.parse(localStorage.getItem('zion-cart')||'[]');if(Array.isArray(data))current=data;}catch{}
    const row=current.find(c=>String(c.id)===String(item.id)&&c.size===selectedSize);
    const available=Number(item.stock?.[selectedSize]||0);
    if(row)row.qty=Math.min(available,(Number(row.qty)||0)+quantity);
    else current.push({id:String(item.id),size:selectedSize,qty:quantity});
    try{
      localStorage.setItem('zion-cart',JSON.stringify(current));
      window.location.assign('/checkout/');
    }catch{
      $('#stockFeedback').textContent='Não foi possível salvar a sacola neste navegador.';
    }
  }

  async function load() {
    setupShipping();
    if(!id || !/^[a-f0-9-]{36}$/.test(id)){showError();return}
    try{
      const response=await fetch('/api/products',{cache:'no-store'});
      if(!response.ok)throw Error('API de produtos indisponível');
      const data=await response.json();
      item=(Array.isArray(data.products)?data.products:[]).find(p=>String(p.id)===id);
      if(!item){showError();return}
      document.title=item.name+' | Zion Clothing';
      $('#productName').textContent=displayName(item.name);
      $('#breadcrumbProduct').textContent=displayName(item.name);
      $('#productPrice').textContent=money(Number(item.price_cents||0)/100);
      $('#productDescription').textContent=item.description||'';
      renderGallery(item.images?.length?item.images:[item.image]);
      renderSizes(item);
      $('#qtyLess').addEventListener('click',()=>{quantity=Math.max(1,quantity-1);updatePurchase()});
      $('#qtyMore').addEventListener('click',()=>{quantity++;updatePurchase()});
      $('#buyButton').addEventListener('click',addToCart);
      $('#pageLoading').hidden=true;
      $('#productPage').hidden=false;
    }catch(error){console.info('Produto indisponível:',error);showError()}
  }
  load();
})();
