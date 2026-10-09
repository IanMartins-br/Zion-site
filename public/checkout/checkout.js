/* Carrinho Zion → checkout hospedado InfinitePay. Valores definitivos vêm do Worker/D1. */
(() => {
  'use strict';
  const $=selector=>document.querySelector(selector);
  const fmt=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
  const validImage=url=>typeof url==='string'&&(/^\/assets\/[a-z0-9-]+\.webp$/.test(url)||/^\/media\/products\/[a-f0-9-]{36}\.(jpg|png|webp|avif)$/.test(url));
  const state={cart:[],lines:[],config:null,working:false};
  function status(message,error=false){
    $('#checkoutStatus').textContent=message;
    $('#checkoutStatus').classList.toggle('error',error);
  }
  async function getJSON(url,options={}){
    const response=await fetch(url,{cache:'no-store',credentials:'same-origin',...options});
    let data;
    try{data=await response.json()}catch{data={error:'Resposta inválida.'}}
    if(!response.ok)throw Error(data.error||'Não foi possível concluir a solicitação.');
    return data;
  }
  function showLines(){
    const box=$('#orderLines');box.replaceChildren();
    let subtotal=0;
    for(const line of state.lines){
      const wrap=document.createElement('div');wrap.className='line';
      const img=document.createElement('img');img.src=validImage(line.product.image)?line.product.image:'/placeholder.svg';img.alt='';
      const details=document.createElement('div');
      const label=document.createElement('strong');label.textContent=line.product.name.replace(/\s*[–-]\s*240g$/i,'');
      const info=document.createElement('small');info.textContent='Tamanho '+line.size+' · '+line.qty+' unidade(s)';
      details.append(label,info);
      const price=document.createElement('span');price.className='line-price';
      const amount=Math.round(line.product.price_cents)*line.qty;price.textContent=fmt(amount);subtotal+=amount;
      wrap.append(img,details,price);box.appendChild(wrap);
    }
    if(!state.lines.length){box.textContent='Sua sacola está vazia. Volte à loja para escolher uma peça.';}
    const shipping=state.config?.enabled?state.config.shipping_cents:null;
    $('#subtotal').textContent=fmt(subtotal);
    $('#shipping').textContent=shipping===null?'A configurar':shipping===0?'Grátis':fmt(shipping);
    $('#total').textContent=shipping===null?'—':fmt(subtotal+shipping);
    $('#payButton').disabled=!state.lines.length||!state.config?.enabled||state.working;
  }
  async function load(){
    let raw;
    try{raw=JSON.parse(localStorage.getItem('zion-cart')||'[]')}catch{raw=[]}
    state.cart=Array.isArray(raw)?raw.slice(0,12):[];
    try{
      const [products,config]=await Promise.all([getJSON('/api/products'),getJSON('/api/checkout/config')]);
      state.config=config;
      const map=new Map((products.products||[]).map(p=>[String(p.id),p]));
      state.lines=[];
      for(const item of state.cart){
        const product=map.get(String(item.id)),size=String(item.size||''),qty=Number(item.qty);
        if(!product||!product.active||!product.sizes?.includes(size)||!Number.isSafeInteger(qty)||qty<1)continue;
        if(qty>Number(product.stock?.[size]||0))continue;
        state.lines.push({product,size,qty});
      }
      showLines();
      if(!state.lines.length)status('Sua sacola está vazia ou contém tamanhos indisponíveis.',true);
      else if(!config.enabled)status('Pagamento ainda não habilitado: faltam a InfiniteTag e/ou o frete no painel da loja.');
      else status('Pronto para ir ao pagamento seguro da InfinitePay.');
    }catch(error){status(error.message||'Não foi possível carregar sua sacola.',true);showLines()}
  }
  const form=$('#checkoutForm');
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(state.working||!state.config?.enabled||!state.lines.length)return;
    if(!form.reportValidity())return;
    const data=new FormData(form);
    const values=Object.fromEntries(data.entries());
    const payload={
      items:state.lines.map(({product,size,qty})=>({id:product.id,size,qty})),
      customer:{name:values.name,email:values.email,phone_number:values.phone_number},
      address:{cep:values.cep,street:values.street,number:values.number,complement:values.complement,
        neighborhood:values.neighborhood,city:values.city,state:values.state}
    };
    state.working=true;showLines();status('Gerando seu pagamento com segurança…');
    try{
      const result=await getJSON('/api/checkout/create',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
      });
      const url=new URL(result.url);
      if(url.protocol!=='https:'||url.hostname!=='checkout.infinitepay.com.br')throw Error('Link de pagamento inválido.');
      window.location.assign(url.href);
    }catch(err){status(err.message||'Falha ao abrir a InfinitePay.',true);state.working=false;showLines();}
  });
  load();
})();
