
/* ZION — protótipo de loja. Substitua os dados abaixo pelos produtos reais. */
const STORE = {
  name: 'ZION',
  currency: 'BRL',
  freeShippingFrom: 399,
  products: [
    {id:1,name:'Blazer alfaiataria fluida',category:'Feminino',price:329.90,tag:'NEW',sizes:['P','M','G'],description:'Corte contemporâneo e caimento impecável. Uma peça essencial para diferentes momentos.',image:'photo-1591047139829-d91aecb6caea'},
    {id:2,name:'Camisa de linho natural',category:'Masculino',price:189.90,tag:'',sizes:['P','M','G','GG'],description:'Leveza e elegância em uma camisa de textura natural, perfeita para todos os dias.',image:'photo-1598032895397-b9472444bf93'},
    {id:3,name:'Vestido midi minimal',category:'Feminino',price:259.90,tag:'BESTSELLER',sizes:['PP','P','M','G'],description:'Linhas limpas e movimento sutil para composições naturalmente sofisticadas.',image:'photo-1539008835657-9e8e9680c956'},
    {id:4,name:'Calça reta essential',category:'Masculino',price:219.90,tag:'',sizes:['38','40','42','44'],description:'Caimento reto, estrutura confortável e versatilidade para acompanhar sua rotina.',image:'photo-1473966968600-fa801b869a1a'},
    {id:5,name:'Conjunto relaxed',category:'Feminino',price:379.90,tag:'NEW',sizes:['P','M','G'],description:'Volumes equilibrados e uma estética contemporânea para usar sempre.',image:'photo-1483985988355-763728e1935b'},
    {id:6,name:'Jaqueta urbana',category:'Masculino',price:349.90,tag:'',sizes:['P','M','G','GG'],description:'Construção leve e design funcional com atitude urbana.',image:'photo-1544923246-77307dd654cb'},
    {id:7,name:'Bolsa de ombro soft',category:'Acessórios',price:179.90,tag:'NEW',sizes:['ÚNICO'],description:'Um acessório com personalidade para acompanhar produções essenciais.',image:'photo-1548036328-c9fa89d128fa'},
    {id:8,name:'Tricot textura leve',category:'Feminino',price:199.90,tag:'',sizes:['P','M','G'],description:'Tramas confortáveis em uma silhueta minimalista.',image:'photo-1434389677669-e08b4cac3105'},
    {id:9,name:'Camisa oversized',category:'Feminino',price:209.90,tag:'',sizes:['P','M','G'],description:'Uma interpretação atual de um clássico absoluto do guarda-roupa.',image:'photo-1598554747436-c9293d6a588f'},
    {id:10,name:'Camiseta premium',category:'Masculino',price:119.90,tag:'ESSENTIAL',sizes:['P','M','G','GG'],description:'A base perfeita de um guarda-roupa versátil, com toque macio.',image:'photo-1503341504253-dff4815485f1'},
    {id:11,name:'Óculos de sol clássico',category:'Acessórios',price:149.90,tag:'',sizes:['ÚNICO'],description:'Design atemporal e identidade marcante para finalizar o look.',image:'photo-1511499767150-a48a237f0083'},
    {id:12,name:'Denim contemporary',category:'Masculino',price:229.90,tag:'NEW',sizes:['38','40','42','44'],description:'Denim contemporâneo de espírito casual e personalidade.',image:'photo-1542272604-787c3835535d'}
  ]
};

const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const money = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:STORE.currency}).format(value);
const imageUrl = (id, width=700) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=82`;
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
function productCard(product){
  const liked=favorites.includes(product.id);
  return `<article class="product-card">
    <div class="product-image-wrap">
      <button class="product-photo-trigger" type="button" data-open-product="${product.id}" aria-label="Ver ${product.name}"><img src="${imageUrl(product.image)}" alt="${product.name}" loading="lazy"></button>
      ${product.tag?`<span class="product-flag">${product.tag}</span>`:''}
      <button class="wishlist ${liked?'selected':''}" data-favorite="${product.id}" type="button" aria-label="${liked?'Remover dos':'Adicionar aos'} favoritos: ${product.name}" aria-pressed="${liked}"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20.7 4 12.6C-1 7.6 6 1.2 12 7.6c6-6.4 13 0 8 5l-8 8.1Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></button>
      <button class="quick-add" type="button" data-open-product="${product.id}">+ VER DETALHES</button>
    </div>
    <div class="product-meta"><div><p class="product-title">${product.name}</p><p class="product-category">${product.category}</p></div><span class="product-price">${money(product.price)}</span></div>
  </article>`;
}
function sortedProducts(list){
  const result=[...list];
  if(currentSort==='low')result.sort((a,b)=>a.price-b.price);
  if(currentSort==='high')result.sort((a,b)=>b.price-a.price);
  if(currentSort==='newest')result.sort((a,b)=>b.id-a.id);
  return result;
}
function renderProducts(){
  const filtered=sortedProducts(STORE.products.filter(p=>currentFilter==='Todos'||p.category===currentFilter));
  const visible=(showAll||currentFilter!=='Todos')?filtered:filtered.slice(0,8);
  $('#productsGrid').innerHTML=visible.map(productCard).join('');
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
  const product=STORE.products.find(p=>p.id===id);if(!product)return;
  if(favorites.includes(id)){favorites=favorites.filter(item=>item!==id);announce('Removido dos favoritos')}
  else{favorites.push(id);announce('Adicionado aos favoritos')}
  safeSave('zion-favorites',favorites);updateCounts();renderProducts();if(activePanel==='favoritesPanel')renderFavorites();
}
function updateCounts(){
  const total=cart.reduce((sum,item)=>sum+item.qty,0);
  $('#cartCount').textContent=total;$('#cartCount').classList.toggle('hidden',!total);
  $('#favoritesCount').textContent=favorites.length;$('#favoritesCount').classList.toggle('hidden',!favorites.length);
  $('#cartHeadingCount').textContent=`(${total})`;
}
function openProduct(id){
  const item=STORE.products.find(p=>p.id===id);if(!item)return;
  selectedProduct=item;selectedSize=null;
  $('#modalImage').src=imageUrl(item.image,1000);$('#modalImage').alt=item.name;
  $('#modalTitle').textContent=item.name;$('#modalPrice').textContent=money(item.price);$('#modalDescription').textContent=item.description;
  $('#sizeFeedback').textContent='';
  $('#sizeOptions').innerHTML=item.sizes.map(size=>`<button type="button" class="size-option" data-size="${size}" aria-pressed="false">${size}</button>`).join('');
  openPanel('productModal');
}
function addToCart(){
  if(!selectedProduct)return;
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
  box.innerHTML=cart.map((line,i)=>{const p=STORE.products.find(item=>item.id===line.id);return `<div class="cart-line"><img src="${imageUrl(p.image,250)}" alt="${p.name}"><div><p class="cart-line-title">${p.name}</p><div class="cart-line-detail">TAMANHO: ${line.size}<br>${p.category}</div><div class="cart-line-bottom"><div class="qty-controls"><button type="button" data-qty="${i}" data-delta="-1" aria-label="Diminuir quantidade">−</button><span>${line.qty}</span><button type="button" data-qty="${i}" data-delta="1" aria-label="Aumentar quantidade">+</button></div><strong class="cart-line-price">${money(line.qty*p.price)}</strong></div><button type="button" class="remove-line" data-remove="${i}">Remover</button></div></div>`}).join('');
  $('#cartTotal').textContent=money(cart.reduce((sum,line)=>sum+line.qty*STORE.products.find(p=>p.id===line.id).price,0));
  updateCounts();
}
function renderSearch(){
  const q=normalize($('#searchInput').value.trim());
  const filtered=q?STORE.products.filter(p=>normalize(`${p.name} ${p.category} ${p.description}`).includes(q)):STORE.products.slice(0,5);
  $('#searchResults').innerHTML=filtered.length?filtered.map(miniProduct).join(''):'<p class="empty-message">Nenhuma peça encontrada.</p>';
}
function miniProduct(p){return `<button type="button" class="mini-product mini-product-button" data-open-product="${p.id}"><img src="${imageUrl(p.image,300)}" alt=""><span><p>${p.name}</p><small>${p.category} · ${money(p.price)}</small></span></button>`}
function renderFavorites(){
  const items=STORE.products.filter(p=>favorites.includes(p.id));
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
$('[data-info]').forEach(btn=>btn.addEventListener('click',()=>{if(btn.dataset.info==='Instagram'){window.open('https://www.instagram.com/usezion.ofc/','_blank','noopener,noreferrer');return;}announce(`${btn.dataset.info}: configure as informações da sua loja para ativar esta área.`);}));
$('#heroShopBtn').addEventListener('click',()=>shopCategory('Todos'));
$('#campaignButton').addEventListener('click',()=>shopCategory('Todos'));
$$('.tab').forEach(btn=>btn.addEventListener('click',()=>shopCategory(btn.dataset.filter)));
$('#sortSelect').addEventListener('change',e=>{currentSort=e.target.value;renderProducts()});
$('#viewAllButton').addEventListener('click',()=>{showAll=!showAll;renderProducts()});
$('#searchInput').addEventListener('input',renderSearch);
$('#sizeOptions').addEventListener('click',e=>{const button=e.target.closest('[data-size]');if(!button)return;selectedSize=button.dataset.size;$$('.size-option').forEach(btn=>{btn.classList.toggle('active',btn===button);btn.setAttribute('aria-pressed',String(btn===button))});$('#sizeFeedback').textContent=''});
$('#addToCartButton').addEventListener('click',addToCart);
$('#checkoutButton').addEventListener('click',()=>announce('Checkout de demonstração — falta conectar um meio de pagamento real.'));
$('#newsletterForm').addEventListener('submit',e=>{e.preventDefault();announce('Newsletter demonstrativa: cadastro ainda não integrado.');e.target.reset()});
$('#productsGrid').addEventListener('click',e=>{const favorite=e.target.closest('[data-favorite]');if(favorite){toggleFavorite(Number(favorite.dataset.favorite));return}const open=e.target.closest('[data-open-product]');if(open)openProduct(Number(open.dataset.openProduct))});
$('#searchResults').addEventListener('click',e=>{const btn=e.target.closest('[data-open-product]');if(btn)openProduct(Number(btn.dataset.openProduct))});
$('#favoritesResults').addEventListener('click',e=>{const btn=e.target.closest('[data-open-product]');if(btn)openProduct(Number(btn.dataset.openProduct))});
$('#cartContents').addEventListener('click',e=>{const remove=e.target.closest('[data-remove]');const qty=e.target.closest('[data-qty]');if(remove){cart.splice(Number(remove.dataset.remove),1)}else if(qty){const i=Number(qty.dataset.qty);if(cart[i])cart[i].qty+=Number(qty.dataset.delta)}else{return}cart=cart.filter(item=>item.qty>0);safeSave('zion-cart',cart);renderCart()});
renderProducts();updateCounts();updateHeader();

