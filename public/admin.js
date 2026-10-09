
const $=id=>document.getElementById(id);
const $$=(q,root=document)=>Array.from(root.querySelectorAll(q));
const state={products:[],media:[],editing:null,selected:[]};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currency=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((v||0)/100);
const stamp=()=>Date.now();
let notifyTimer;
function notify(message,error=false){
 const node=$('feedback');node.textContent=message;node.className='status visible'+(error?' error':'');
 clearTimeout(notifyTimer);notifyTimer=setTimeout(()=>node.className='status',6500);
}
async function api(path,options={}){
 const r=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});
 let data;try{data=await r.json()}catch{data={error:'Falha na comunicação.'}}
 if(!r.ok)throw new Error(data.error||'Não foi possível concluir a operação.');
 return data;
}
const body=val=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(val)});
function showDashboard(visible){$('loginView').hidden=visible;$('dashboard').hidden=!visible;$('logoutButton').hidden=!visible}
function changeTab(tab){
 $$('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
 $('productsSection').hidden=tab!=='products';$('mediaSection').hidden=tab!=='media';
}
async function refresh(){
 const [products,media]=await Promise.all([api('/api/admin/products'),api('/api/admin/media')]);
 state.products=products.products||[];state.media=media.images||[];
 renderProducts();renderMedia();renderPicker();
}
function imgsrc(key){return (key==='/assets/zion-0790.webp'||key==='/assets/zion-go-into-all-world-capa.webp')?key:/^\/(media)\/(products|editorials)\/[a-f0-9-]{36}\.(jpg|png|webp|avif)$/.test(key)?key:'/placeholder.svg'}
function renderProducts(){
 $('productTotal').textContent=state.products.length+' cadastrados';
 $('productList').innerHTML=state.products.length?state.products.map(p=>`
 <div class="item"><img src="${esc(imgsrc(p.image))}" alt=""><div class="item-details"><strong>${esc(p.name)}</strong>
 <small>${esc(p.category)} · ${currency(p.price_cents)} · ${p.active?'Publicado':'Oculto'}</small>
 <small>${Object.entries(p.stock||{}).map(([s,n])=>esc(s)+': '+n).join(' / ')}</small>
 </div><div class="item-actions"><button class="outline" type="button" data-edit="${p.id}">Editar</button><button class="outline" type="button" data-delete="${p.id}">Excluir</button></div></div>`).join(''):'<p class="muted">Nenhum produto cadastrado. Comece pelo formulário ao lado.</p>';
}
function renderPicker(){
 const list=state.media.filter(m=>m.kind==='product'&&m.active);
 $('productImagePicker').innerHTML=list.length?list.map(m=>{
 const chosen=state.selected.includes(m.key);
 return `<button class="photo-choice ${chosen?'selected':''}" type="button" data-select="${esc(m.key)}" aria-label="Selecionar foto ${esc(m.title)}" aria-pressed="${chosen}"><img src="${esc(m.url)}" alt="${esc(m.title)}"><span>${chosen?'✓':'+'}</span></button>`
 }).join(''):'<p class="muted">Adicione imagens ao banco ou pelo campo abaixo.</p>';
}
function renderMedia(){
 $('mediaTotal').textContent=state.media.length+' arquivos';
 $('mediaList').innerHTML=state.media.length?state.media.map(m=>`
 <article class="media-item"><img src="${esc(m.url)}" alt="${esc(m.title)}" loading="lazy">
 <p><strong>${esc(m.kind==='editorial'?m.slot:'Produto')}</strong> · ${esc(m.title||'Sem legenda')}</p>
 <div class="media-actions"><button class="outline" data-visible="${m.id}" type="button">${m.active?'Ocultar':'Mostrar'}</button><button class="outline" data-delete-media="${m.id}" type="button">Excluir</button></div></article>`).join(''):'<p class="muted">Nenhuma foto cadastrada.</p>';
}
function resetForm(){
 state.editing=null;state.selected=[];
 $('productForm').reset();$('formTitle').textContent='Cadastrar produto';$('saveProduct').textContent='Salvar produto ↗';renderPicker();
}
function fillForm(id){
 const p=state.products.find(item=>item.id===id);if(!p)return;
 resetForm();state.editing=id;
 const f=$('productForm');f.elements.name.value=p.name;f.elements.price.value=(p.price_cents/100).toFixed(2);
 f.elements.category.value=p.category;f.elements.description.value=p.description;
 f.elements.stock.value=(p.sizes||[]).map(s=>s+':'+(p.stock?.[s]||0)).join(', ');
 f.elements.tag.value=p.tag;f.elements.active.checked=p.active;
 state.selected=p.imageKeys||[];renderPicker();
 $('formTitle').textContent='Editar produto';$('saveProduct').textContent='Salvar alterações ↗';
 changeTab('products');window.scrollTo({top:0,behavior:'smooth'});
}
function parseStock(raw){
 const values={};const entries=raw.split(',').map(s=>s.trim()).filter(Boolean);
 for(const entry of entries){
  const match=/^([^:]+):\s*(\d+)$/.exec(entry);
  if(!match)throw new Error('Use o formato P:10, M:5, G:8.');
  const size=match[1].trim();
  if(!size||size.length>12||Object.hasOwn(values,size))throw new Error('Tamanho duplicado ou inválido.');
  const quantity=Number(match[2]);if(!Number.isSafeInteger(quantity)||quantity>1000000)throw new Error('Estoque inválido.');
  values[size]=quantity;
 }
 if(!Object.keys(values).length||Object.keys(values).length>20)throw new Error('Informe entre 1 e 20 tamanhos.');
 return values;
}
async function uploadPhotos(files,kind,slot,title){
 let uploaded=0;
 for(const file of files){
  if(!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)||file.size>8000000)throw new Error('Envie JPG, PNG, WEBP ou AVIF de até 8 MB.');
  const data=new FormData();data.set('file',file);data.set('kind',kind);data.set('slot',slot);data.set('title',title||file.name);
  const saved=await api('/api/admin/media',{method:'POST',body:data});
  if(kind==='product'&&!state.selected.includes(saved.image.key)&&state.selected.length<8)state.selected.push(saved.image.key);
  uploaded++;
 }
 return uploaded;
}
$('loginForm').addEventListener('submit',async e=>{
 e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;
 try{
  await api('/api/admin/login',body({password:$('password').value}));
  $('password').value='';showDashboard(true);await refresh();notify('Bem-vindo ao painel da Zion.');
 }catch(err){notify(err.message,true)}finally{button.disabled=false}
});
$('logoutButton').addEventListener('click',async()=>{try{await api('/api/admin/logout',{method:'POST'})}catch{}showDashboard(false);resetForm();notify('Sessão encerrada.')});
$$('[data-tab]').forEach(b=>b.addEventListener('click',()=>changeTab(b.dataset.tab)));
$('resetProduct').addEventListener('click',resetForm);
$('productImagePicker').addEventListener('click',e=>{
 const button=e.target.closest('[data-select]');if(!button)return;
 const key=button.dataset.select;
 if(state.selected.includes(key))state.selected=state.selected.filter(k=>k!==key);
 else if(state.selected.length<8)state.selected.push(key);
 else return notify('Máximo de oito fotos por produto.',true);
 renderPicker();
});
$('quickProductPhotos').addEventListener('change',async e=>{
 const files=[...e.target.files];if(!files.length)return;
 const input=e.target;input.disabled=true;
 try{const count=await uploadPhotos(files,'product','produto','Foto de produto');await refresh();notify(count+' foto(s) adicionada(s).')}
 catch(err){notify(err.message,true)}finally{input.value='';input.disabled=false}
});
$('productForm').addEventListener('submit',async e=>{
 e.preventDefault();const btn=$('saveProduct');btn.disabled=true;
 try{
 const f=e.target,stock=parseStock(f.elements.stock.value);
 const amount=Number(f.elements.price.value);
 if(!Number.isFinite(amount)||amount<0)throw new Error('Preço inválido.');
 const product={name:f.elements.name.value.trim(),category:f.elements.category.value,description:f.elements.description.value,
 price_cents:Math.round(amount*100),stock,sizes:Object.keys(stock),tag:f.elements.tag.value,
 imageKeys:state.selected,active:f.elements.active.checked};
 if(state.editing)await api('/api/admin/products/'+state.editing,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(product)});
 else await api('/api/admin/products',body(product));
 resetForm();await refresh();notify('Produto salvo com sucesso.');
 }catch(err){notify(err.message,true)}finally{btn.disabled=false}
});
$('productList').addEventListener('click',async e=>{
 const edit=e.target.closest('[data-edit]');if(edit)return fillForm(edit.dataset.edit);
 const del=e.target.closest('[data-delete]');if(!del)return;
 const p=state.products.find(p=>p.id===del.dataset.delete);
 if(!p||!confirm('Excluir "'+p.name+'"? Esta ação não pode ser desfeita.'))return;
 try{await api('/api/admin/products/'+p.id,{method:'DELETE'});if(state.editing===p.id)resetForm();await refresh();notify('Produto excluído.')}
 catch(err){notify(err.message,true)}
});
$('mediaKind').addEventListener('change',()=>{$('slotLabel').hidden=$('mediaKind').value==='product'});
$('uploadForm').addEventListener('submit',async e=>{
 e.preventDefault();const f=e.target,files=[...f.elements.photos.files];const btn=$('uploadButton');
 if(!files.length)return notify('Selecione imagens.',true);
 btn.disabled=true;btn.textContent='Enviando...';
 try{const n=await uploadPhotos(files,f.elements.kind.value,f.elements.slot.value,f.elements.title.value);f.reset();$('slotLabel').hidden=false;await refresh();notify(n+' foto(s) enviada(s) ao R2.')}
 catch(err){notify(err.message,true)}finally{btn.disabled=false;btn.textContent='Enviar imagens ao R2 ↗'}
});
$('mediaList').addEventListener('click',async e=>{
 const visible=e.target.closest('[data-visible]'),deleteButton=e.target.closest('[data-delete-media]');
 const id=visible?.dataset.visible||deleteButton?.dataset.deleteMedia;
 if(!id)return;const item=state.media.find(m=>m.id===id);if(!item)return;
 try{
 if(visible)await api('/api/admin/media/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({slot:item.slot,title:item.title,active:!item.active})});
 else if(confirm('Excluir definitivamente esta foto?'))await api('/api/admin/media/'+id,{method:'DELETE'});
 await refresh();notify('Banco de imagens atualizado.');
 }catch(err){notify(err.message,true)}
});
api('/api/admin/me').then(async()=>{showDashboard(true);await refresh()}).catch(()=>showDashboard(false));
