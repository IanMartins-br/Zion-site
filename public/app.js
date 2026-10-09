
/* ZION CLOTHING — catálogo integrado ao D1; campanha editorial via R2. */
const STORE = {
  name: 'ZION',
  currency: 'BRL',
  freeShippingFrom: 399,
  products: []
};

const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const money = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:STORE.currency}).format(value);
const imageUrl = (id, width=700) => !id ? '/placeholder.svg' : /^\/assets\/zion-(0770|0779|0790|0791|0799|cover-wide|go-into-all-world-capa|go-into-world-capa-v2|go-into-world-(786|787|788|789|790)|oba-(capa|77[4-8]))\.webp$/.test(id) ? id : id.startsWith('/media/') ? id : id.startsWith('https://') ? id : `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=82`;
const safeRead = (key,fallback) => {try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const safeSave = (key,value) => {try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
let cart = safeRead('zion-cart',[]);
let favorites = safeRead('zion-favorites',[]);
let currentFilter = 'Todos';
let currentSort = 'featured';
let showAll = false;
let selectedProduct = null;
let selectedSize = null;
let activePanel = null;
let toastTimeout;
const panels = ['menuPanel','searchPanel','cartPanel','favoritesPanel','productModal'];

function announce(text){
  const node=$('#toast');node.textContent=text;node.classList.add('show');
  clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>node.classList.remove('show'),3200);
}
function normalize(text){return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
function updateHeader(){const scrolled=window.scrollY>80;$('#header').classList.toggle('scrolled',scrolled);$('#header').classList.toggle('panel-active',Boolean(activePanel))}
function closePanels(){
  panels.forEach(id=>{const node=document.getElementById(id);node.classList.remove('open');node.setAttribute('aria-hidden','true')});
  $('#overlay').hidden=true;document.body.classList.remove('no-scroll');
  $$('#menuButton, #cartButton, #searchButton').forEach(btn=>btn.setAttribute('aria-expanded','false'));
  activePanel=null;updateHeader();
}
function openPanel(id){
  closePanels();activePanel=id;
  const node=document.getElementById(id);node.classList.add('open');node.setAttribute('aria-hidden','false');
  $('#overlay').hidden=false;document.body.classList.add('no-scroll');
  const trigger={menuPanel:'menuButton',searchPanel:'searchButton',cartPanel:'cartButton'}[id];
  if(trigger)document.getElementById(trigger).setAttribute('aria-expanded','true');
  updateHeader();
  if(id==='searchPanel'){renderSearch();setTimeout(()=>$('#searchInput').focus(),250)}
  if(id==='favoritesPanel')renderFavorites();
  if(id==='cartPanel')renderCart();
  if(id==='productModal')setTimeout(()=>$('#modalTitle').focus?.(),100);
}
const productPageUrl = id => '/produto/?id='+encodeURIComponent(String(id));
function productCard(product){
  const liked=favorites.includes(String(product.id));
  const images=Array.isArray(product.images)?product.images:[];
  const second=images.length>1 && images[1]!==images[0] ? images[1] : null;
  const href=productPageUrl(product.id);
  return `<article class="product-card${second?' has-preview':''}">
    <div class="product-image-wrap">
      <a class="product-photo-trigger" href="${href}" aria-label="Ver ${escapeHtml(product.name)}">
        <img class="product-main-image" src="${imageUrl(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async">
        ${second?`<img class="product-hover-image" src="${imageUrl(second,800)}" alt="" aria-hidden="true" loading="lazy" decoding="async">`:''}
      </a>
      ${product.tag?`<span class="product-flag">${escapeHtml(product.tag)}</span>`:''}
      <button class="wishlist ${liked?'selected':''}" data-favorite="${product.id}" type="button" aria-label="${liked?'Remover dos':'Adicionar aos'} favoritos: ${escapeHtml(product.name)}" aria-pressed="${liked}"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20.7 4 12.6C-1 7.6 6 1.2 12 7.6c6-6.4 13 0 8 5l-8 8.1Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></button>
      <a class="quick-add" href="${href}" aria-label="Comprar ${escapeHtml(product.name)}">COMPRAR <span aria-hidden="true">↗</span></a>
    </div>
    <div class="product-meta"><div><p class="product-title"><a href="${href}">${escapeHtml(product.name)}</a></p><p class="product-category">${escapeHtml(product.category)}</p></div><span class="product-price">${money(product.price)}</span></div>
  </article>`;
}
function sortedProducts(list){
  const result=[...list];
  if(currentSort==='low')result.sort((a,b)=>a.price-b.price);
  if(currentSort==='high')result.sort((a,b)=>b.price-a.price);
  if(currentSort==='newest')result.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  return result;
}
function renderProducts(){
  const filtered=sortedProducts(STORE.products.filter(p=>currentFilter==='Todos'||p.category===currentFilter));
  const visible=(showAll||currentFilter!=='Todos')?filtered:filtered.slice(0,8);
  $('#productsGrid').innerHTML=visible.length ? visible.map(productCard).join('') : '<div class="catalog-empty"><span class="eyebrow">ZION / EM BREVE</span><h3>O próximo drop<br><em>está chegando.</em></h3><p>Ainda estamos preparando as peças. Acompanhe <a href="https://www.instagram.com/usezion.ofc/" target="_blank" rel="noopener noreferrer">@usezion.ofc</a> para descobrir primeiro.</p></div>';
  $('#productCount').textContent=`${visible.length}${visible.length!==filtered.length?' DE '+filtered.length:''} PRODUTO${filtered.length!==1?'S':''}`;
  $('#viewAllButton').textContent=showAll?'MOSTRAR MENOS ↑':'VER TODAS AS PEÇAS ↗';
  $('#viewAllButton').hidden=currentFilter!=='Todos'||filtered.length<=8;
  $$('.tab').forEach(tab=>{const active=tab.dataset.filter===currentFilter;tab.classList.toggle('active',active);tab.setAttribute('aria-pressed',String(active))});
}
function shopCategory(category){
  currentFilter=category;showAll=false;renderProducts();closePanels();
  $('#catalogo').scrollIntoView({behavior:'smooth',block:'start'});
}
function toggleFavorite(id){
  const product=STORE.products.find(p=>String(p.id)===String(id));if(!product)return;
  if(favorites.includes(String(id))){favorites=favorites.filter(item=>item!==String(id));announce('Removido dos favoritos')}
  else{favorites.push(String(id));announce('Adicionado aos favoritos')}
  safeSave('zion-favorites',favorites);updateCounts();renderProducts();if(activePanel==='favoritesPanel')renderFavorites();
}
function updateCounts(){
  const total=cart.reduce((sum,item)=>sum+item.qty,0);
  $('#cartCount').textContent=total;$('#cartCount').classList.toggle('hidden',!total);
  $('#favoritesCount').textContent=favorites.length;$('#favoritesCount').classList.toggle('hidden',!favorites.length);
  $('#cartHeadingCount').textContent=`(${total})`;
}
function openProduct(id){
  const item=STORE.products.find(p=>String(p.id)===String(id));if(!item)return;
  selectedProduct=item;selectedSize=null;
  $('#modalImage').src=imageUrl(item.image,1000);$('#modalImage').alt=item.name;
  $('#modalTitle').textContent=item.name;$('#modalPrice').textContent=money(item.price);$('#modalDescription').textContent=item.description;
  const sizesKnown=item.sizes.length>0;
  $('#sizeFeedback').textContent=sizesKnown?'':'Tamanhos e disponibilidade ainda serão confirmados.';
  $('#sizeOptions').innerHTML=item.sizes.map(size=>`<button type="button" class="size-option" data-size="${escapeHtml(size)}" aria-pressed="false">${escapeHtml(size)}</button>`).join('');
  const buy=$('#addToCartButton');
  buy.disabled=!sizesKnown;
  buy.textContent=sizesKnown?'ADICIONAR À SACOLA ↗':'TAMANHOS A CONFIRMAR';
  openPanel('productModal');
}
function addToCart(){
  if(!selectedProduct||!selectedProduct.sizes.length)return;
  if(!selectedSize){$('#sizeFeedback').textContent='Selecione um tamanho';announce('Escolha um tamanho antes de adicionar');return}
  const line=cart.find(item=>item.id===selectedProduct.id&&item.size===selectedSize);
  if(line)line.qty+=1;else cart.push({id:selectedProduct.id,size:selectedSize,qty:1});
  safeSave('zion-cart',cart);updateCounts();announce('Peça adicionada à sacola');openPanel('cartPanel');
}
function renderCart(){
  cart=cart.filter(line=>STORE.products.some(p=>p.id===line.id)&&line.qty>0);
  const box=$('#cartContents');
  if(!cart.length){box.innerHTML='<p class="empty-message">Sua sacola ainda está vazia.<br>Vamos mudar isso?</p>';$('#cartBottom').classList.add('hidden');updateCounts();return}
  $('#cartBottom').classList.remove('hidden');
  box.innerHTML=cart.map((line,i)=>{const p=STORE.products.find(item=>item.id===line.id);return `<div class="cart-line"><img src="${imageUrl(p.image,250)}" alt="${escapeHtml(p.name)}"><div><p class="cart-line-title">${escapeHtml(p.name)}</p><div class="cart-line-detail">TAMANHO: ${escapeHtml(line.size)}<br>${escapeHtml(p.category)}</div><div class="cart-line-bottom"><div class="qty-controls"><button type="button" data-qty="${i}" data-delta="-1" aria-label="Diminuir quantidade">−</button><span>${line.qty}</span><button type="button" data-qty="${i}" data-delta="1" aria-label="Aumentar quantidade">+</button></div><strong class="cart-line-price">${money(line.qty*p.price)}</strong></div><button type="button" class="remove-line" data-remove="${i}">Remover</button></div></div>`}).join('');
  $('#cartTotal').textContent=money(cart.reduce((sum,line)=>sum+line.qty*STORE.products.find(p=>p.id===line.id).price,0));
  updateCounts();
}
function renderSearch(){
  const q=normalize($('#searchInput').value.trim());
  const filtered=q?STORE.products.filter(p=>normalize(`${escapeHtml(p.name)} ${escapeHtml(p.category)} ${p.description}`).includes(q)):STORE.products.slice(0,5);
  $('#searchResults').innerHTML=filtered.length?filtered.map(miniProduct).join(''):'<p class="empty-message">Nenhuma peça encontrada.</p>';
}
function miniProduct(p){return `<a class="mini-product mini-product-button" href="${productPageUrl(p.id)}"><img src="${imageUrl(p.image,300)}" alt=""><span><p>${escapeHtml(p.name)}</p><small>${escapeHtml(p.category)} · ${money(p.price)}</small></span></a>`}
function renderFavorites(){
  const items=STORE.products.filter(p=>favorites.includes(String(p.id)));
  $('#favoritesResults').innerHTML=items.length?items.map(miniProduct).join(''):'<p class="empty-message">Salve as peças que você mais gosta e encontre tudo por aqui.</p>';
}

$('#menuButton').addEventListener('click',()=>openPanel('menuPanel'));
$('#searchButton').addEventListener('click',()=>openPanel('searchPanel'));
$('#cartButton').addEventListener('click',()=>openPanel('cartPanel'));
$('#favoritesButton').addEventListener('click',()=>openPanel('favoritesPanel'));
$('#menuFavorites').addEventListener('click',()=>openPanel('favoritesPanel'));
$('#overlay').addEventListener('click',closePanels);
$$('[data-close]').forEach(btn=>btn.addEventListener('click',closePanels));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&activePanel)closePanels()});
window.addEventListener('scroll',updateHeader,{passive:true});
$$('[data-shop-category]').forEach(btn=>btn.addEventListener('click',()=>shopCategory(btn.dataset.shopCategory)));
$$('[data-scroll]').forEach(btn=>btn.addEventListener('click',()=>document.querySelector(btn.dataset.scroll)?.scrollIntoView({behavior:'smooth'})));
$$('[data-info]').forEach(btn=>btn.addEventListener('click',()=>{if(btn.dataset.info==='Instagram'){window.open('https://www.instagram.com/usezion.ofc/','_blank','noopener,noreferrer');return;}announce(`${btn.dataset.info}: configure as informações da sua loja para ativar esta área.`);}));
$('#heroShopBtn').addEventListener('click',()=>shopCategory('Todos'));
$('#campaignButton').addEventListener('click',()=>shopCategory('Todos'));
$$('.tab').forEach(btn=>btn.addEventListener('click',()=>shopCategory(btn.dataset.filter)));
$('#sortSelect').addEventListener('change',e=>{currentSort=e.target.value;renderProducts()});
$('#viewAllButton').addEventListener('click',()=>{showAll=!showAll;renderProducts()});
$('#searchInput').addEventListener('input',renderSearch);
$('#sizeOptions').addEventListener('click',e=>{const button=e.target.closest('[data-size]');if(!button)return;selectedSize=button.dataset.size;$$('.size-option').forEach(btn=>{btn.classList.toggle('active',btn===button);btn.setAttribute('aria-pressed',String(btn===button))});$('#sizeFeedback').textContent=''});
$('#addToCartButton').addEventListener('click',addToCart);
$('#checkoutButton').addEventListener('click',()=>announce('A finalização de pedidos será disponibilizada em breve.'));

$('#productsGrid').addEventListener('click',e=>{const favorite=e.target.closest('[data-favorite]');if(favorite){toggleFavorite(favorite.dataset.favorite);return}const open=e.target.closest('[data-open-product]');if(open)openProduct(open.dataset.openProduct)});
$('#searchResults').addEventListener('click',e=>{const btn=e.target.closest('[data-open-product]');if(btn)openProduct(btn.dataset.openProduct)});
$('#favoritesResults').addEventListener('click',e=>{const btn=e.target.closest('[data-open-product]');if(btn)openProduct(btn.dataset.openProduct)});
$('#cartContents').addEventListener('click',e=>{const remove=e.target.closest('[data-remove]');const qty=e.target.closest('[data-qty]');if(remove){cart.splice(Number(remove.dataset.remove),1)}else if(qty){const i=Number(qty.dataset.qty);if(cart[i])cart[i].qty+=Number(qty.dataset.delta)}else{return}cart=cart.filter(item=>item.qty>0);safeSave('zion-cart',cart);renderCart()});
renderProducts();updateCounts();updateHeader();



async function loadCatalog(){
  try {
    const response=await fetch('/api/products',{cache:'no-store'});
    if(!response.ok)throw new Error('Catálogo ainda não conectado.');
    const data=await response.json();
    STORE.products=(data.products||[]).map(p=>({
      id:String(p.id),name:p.name,category:p.category,createdAt:p.created_at,
      price:p.price_cents/100,tag:p.tag||'',description:p.description||'',
      sizes:(p.sizes||[]).filter(size=>(p.stock?.[size]??0)>0),
      image:p.image||null,
      images:Array.isArray(p.images)?p.images:[]
    }));
    cart=cart.filter(item=>STORE.products.some(p=>p.id===String(item.id)));
    favorites=favorites.map(String).filter(id=>STORE.products.some(p=>p.id===id));
    safeSave('zion-cart',cart);safeSave('zion-favorites',favorites);
    renderProducts();updateCounts();
  }catch(err){console.info(err.message);STORE.products=[];renderProducts();}
}
const localZionEditorials=[
  {slot:'hero',url:'/assets/zion-cover-wide.webp'},
  {slot:'feminino',url:'/assets/zion-0791.webp'},
  {slot:'feminino',url:'/assets/zion-0770.webp'},
  {slot:'masculino',url:'/assets/zion-0779.webp'},
  {slot:'masculino',url:'/assets/zion-0790.webp'},
  {slot:'campanha',url:'/assets/zion-0790.webp'},
  {slot:'campanha',url:'/assets/zion-0799.webp'}
];

const zionEditorialCycleMs=3*60*60*1000;
const zionDriveManifestUrl='/data/zion-drive-photos.json';
const validDriveId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{15,100}$/.test(id);
const driveThumb=(id,width=1150)=>'https://drive.google.com/thumbnail?id='+encodeURIComponent(id)+'&sz=w'+width;
function cycleNumber(){return Math.floor(Date.now()/zionEditorialCycleMs)}
function currentPhoto(items,slot){
  const choices=items.filter(p=>p.slot===slot||p.slot==='geral');
  if(!choices.length)return null;
  const salt=[...slot].reduce((sum,letter)=>sum+letter.charCodeAt(0),0);
  return choices[(cycleNumber()+salt)%choices.length];
}
function setPhotoBackground(selector,url,priority=1){
  const node=document.querySelector(selector);
  if(!node)return;
  const image=new Image();
  image.referrerPolicy='no-referrer';
  image.onload=()=>{
    if(priority>=Number(node.dataset.photoPriority||0)){
      node.style.backgroundImage='url("'+url+'")';
      node.dataset.photoPriority=String(priority);
    }
  };
  image.onerror=()=>{}; // Conserva os WebP da Zion como fallback.
  image.src=url;
}
function cyclePhotos(images,slot,selector,priority=1){
  const photo=currentPhoto(images,slot);
  if(!photo)return;
  const url=photo.url;
  const local=/^\/assets\/zion-(0770|0779|0790|0791|0799|cover-wide)\.webp$/.test(url);
  const r2=/^\/media\/editorials\/[a-f0-9-]{36}\.(jpg|png|webp|avif)$/.test(url);
  if(local||r2)setPhotoBackground(selector,url,priority);
}
function pickDriveEditorials(photos){
  const first=(cycleNumber()*7)%photos.length;
  return Array.from({length:10},(_,i)=>photos[(first+i*11)%photos.length]);
}
async function loadDriveEditorials(){
  const response=await fetch(zionDriveManifestUrl,{cache:'no-store'});
  if(!response.ok)return;
  const manifest=await response.json();
  const photos=Array.isArray(manifest.photos)?manifest.photos.filter(p=>validDriveId(p.id)):[];
  if(!photos.length)return;
  const selection=pickDriveEditorials(photos);
  document.querySelectorAll('[data-zion-photo]').forEach((node,i)=>{
    const source=selection[i];if(!source)return;
    const fallback=node.getAttribute('src');
    const image=new Image();
    image.referrerPolicy='no-referrer';
    image.onload=()=>{node.src=image.src;node.alt='Foto original Zion Clothing — '+source.name;};
    image.onerror=()=>{node.src=fallback;};
    image.src=driveThumb(source.id,1000);
  });
  const positions=[
    ['.hero-bg',6,1750],['.tile-woman .tile-photo',7,1050],
    ['.tile-man .tile-photo',8,1050],['.campaign-photo',9,1300]
  ];
  for(const [selector,index,width] of positions){
    const photo=selection[index];if(photo)setPhotoBackground(selector,driveThumb(photo.id,width),2);
  }
}
async function loadEditorials(){
  const sections=[
    ['hero','.hero-bg'],['feminino','.tile-woman .tile-photo'],
    ['masculino','.tile-man .tile-photo'],['campanha','.campaign-photo']
  ];
  for(const [slot,selector] of sections)cyclePhotos(localZionEditorials,slot,selector,1);
  try{await loadDriveEditorials();}catch(error){console.info('Fotos locais Zion disponíveis.');}
  try{
    const response=await fetch('/api/editorials',{cache:'no-store'});
    if(!response.ok)return;
    const {images=[]}=await response.json();
    for(const [slot,selector] of sections)cyclePhotos(images,slot,selector,3);
  }catch(error){console.info('Galeria R2 ainda não configurada.');}
}
function initZionScrollMotion(){
  if(!('IntersectionObserver' in window)||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  const revealNodes=[...document.querySelectorAll('.collection-intro-body,.editorial-tile,.catalog-heading,.zion-lookbook-item,.movement-banner,.campaign-copy,.community-side')];
  revealNodes.forEach((node,index)=>{node.classList.add('depth-reveal');node.dataset.zionDelay=String(index%3)});
  document.documentElement.classList.add('zion-motion');
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}
    }
  },{threshold:.08,rootMargin:'0px 0px -4% 0px'});
  revealNodes.forEach(node=>observer.observe(node));
  const photos=[...document.querySelectorAll('.hero-bg,.tile-photo,.campaign-photo')];
  const tiltNodes=[...document.querySelectorAll('.zion-lookbook-item')];
  let scheduled=false;
  function updateDepth(){
    scheduled=false;
    const viewport=window.innerHeight||800;
    for(const node of photos){
      const rect=node.getBoundingClientRect();
      if(rect.bottom<0||rect.top>viewport)continue;
      const progress=(rect.top+rect.height*.5-viewport*.5)/viewport;
      const shift=Math.max(-18,Math.min(18,-progress*19));
      node.style.setProperty('--zion-parallax',shift.toFixed(1)+'px');
    }
    for(const node of tiltNodes){
      const rect=node.getBoundingClientRect();
      if(rect.bottom<0||rect.top>viewport)continue;
      const progress=(rect.top+rect.height*.5-viewport*.5)/viewport;
      node.style.setProperty('--zion-depth-tilt',Math.max(-1.6,Math.min(1.6,-progress*2)).toFixed(2)+'deg');
    }
  }
  const tick=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(updateDepth)}};
  window.addEventListener('scroll',tick,{passive:true});
  window.addEventListener('resize',tick,{passive:true});
  tick();
}
// A abertura é inicializada de forma independente em intro.js.
initZionScrollMotion();
loadCatalog();
loadEditorials();
