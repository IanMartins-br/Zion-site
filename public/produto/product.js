/* Página exclusiva de produto Zion. Frete ilustrativo, sem API Correios/checkout. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const money = amount => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(amount);
  const safeImage = url => typeof url==='string' && (
    /^\/media\/products\/[a-f0-9-]{36}\.(jpg|png|webp|avif)$/.test(url) ||
    /^\/assets\/zion-(0770|0779|0790|0791|0799|cover-wide)\.webp$/.test(url)
  );
  const url = new URL(window.location.href);
  const id = url.searchParams.get('id');
  let item = null, selectedSize = '', quantity = 1;
  const showError = () => {$('#pageLoading').hidden=true;$('#pageError').hidden=false;};

  function renderGallery(photoUrls) {
    const images = [...new Set(photoUrls)].filter(safeImage);
    if(!images.length) images.push('/placeholder.svg');
    let selectedIndex = 0;
    function select(i) {
      selectedIndex=i;
      $('#productImage').src=images[i];
      $('#productImage').alt=item.name+' — foto '+(i+1);
      $('#photoIndex').textContent=String(i+1).padStart(2,'0')+' / '+String(images.length).padStart(2,'0');
      document.querySelectorAll('.thumb').forEach((btn,n)=>{
        btn.classList.toggle('selected',n===i);
        btn.setAttribute('aria-pressed',String(n===i));
      });
    }
    const wrap=$('#productThumbnails');
    wrap.replaceChildren();
    images.forEach((src,i)=>{
      const button=document.createElement('button');
      button.className='thumb';
      button.type='button';
      button.setAttribute('aria-label','Ver foto '+(i+1));
      const img=document.createElement('img');
      img.loading='lazy';img.alt='';img.src=src;
      button.appendChild(img);
      button.addEventListener('click',()=>select(i));
      wrap.appendChild(button);
    });
    select(selectedIndex);
  }

  function updatePurchase() {
    const available=Number(item.stock?.[selectedSize]||0);
    if(available>0 && quantity>available) quantity=available;
    $('#qtyValue').textContent=String(quantity);
    $('#qtyLess').disabled=quantity<=1;
    $('#qtyMore').disabled=!selectedSize || quantity>=available;
    const buy=$('#buyButton');
    buy.disabled=available===0;
    buy.innerHTML=available>0?'ADICIONAR À SACOLA <span>↗</span>':'SELECIONE UM TAMANHO <span>↗</span>';
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
      $('#stockFeedback').textContent='Adicionado à sacola. O checkout da loja ainda não está disponível.';
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
      $('#productName').textContent=item.name;
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
