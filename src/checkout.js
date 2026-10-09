/* Checkout Zion + InfinitePay (API oficial). Nunca confie em preços fornecidos pelo navegador.
   A cobrança só é habilitada após configuração explícita da InfiniteTag E do frete. */
const result=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const error=(message,status=400)=>result({error:message},status);
const now=()=>new Date().toISOString();
const uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value);
const safeText=(v,max)=>String(v??'').trim().slice(0,max);
const pickJson=(v,def)=>{try{return JSON.parse(v)}catch{return def}};
const handleOf=env=>safeText(env.INFINITEPAY_HANDLE,90).replace(/^\$/,'');
const shippingOf=env=>env.ZION_SHIPPING_CENTS===undefined?null:Number(env.ZION_SHIPPING_CENTS);
const isConfigured=env=>/^[a-zA-Z0-9._-]{2,80}$/.test(handleOf(env))&&
  shippingOf(env)!==null&&Number.isSafeInteger(shippingOf(env))&&shippingOf(env)>=0&&shippingOf(env)<=1000000;
const providerRoot='https://api.checkout.infinitepay.io';
async function checkoutTables(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS zion_orders (
    order_nsu TEXT PRIMARY KEY,
    handle TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    items_json TEXT NOT NULL,
    customer_json TEXT NOT NULL,
    address_json TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    shipping_cents INTEGER NOT NULL,
    checkout_url TEXT NOT NULL DEFAULT '',
    invoice_slug TEXT NOT NULL DEFAULT '',
    transaction_nsu TEXT NOT NULL DEFAULT '',
    receipt_url TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS zion_orders_status ON zion_orders(status,created_at)').run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS zion_checkout_attempts (
    client_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS zion_checkout_attempts_window ON zion_checkout_attempts(client_hash,created_at)').run();
}
const digest=async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(b=>b.toString(16).padStart(2,'0')).join('');
async function limitAttempts(request,env){
  const key=await digest('zion-checkout-v1:'+(request.headers.get('CF-Connecting-IP')||'unknown'));
  const since=Math.floor(Date.now()/1000)-900;
  await env.DB.prepare('DELETE FROM zion_checkout_attempts WHERE created_at < ?').bind(since).run();
  const count=await env.DB.prepare('SELECT count(*) AS total FROM zion_checkout_attempts WHERE client_hash=? AND created_at>=?').bind(key,since).first();
  if(Number(count?.total||0)>=6)return false;
  await env.DB.prepare('INSERT INTO zion_checkout_attempts(client_hash,created_at) VALUES(?,?)').bind(key,Math.floor(Date.now()/1000)).run();
  return true;
}
async function parseInput(request){
  if(!(request.headers.get('content-type')||'').includes('application/json'))throw new Error('Envie os dados da compra em JSON.');
  const raw=await request.text();
  if(raw.length>16000)throw new Error('Dados do pedido muito grandes.');
  return JSON.parse(raw);
}
const checkoutURL=value=>{
  try {const url=new URL(value);return url.protocol==='https:'&&url.hostname==='checkout.infinitepay.com.br'?url.href:null;}
  catch{return null}
};
async function providerPost(endpoint,body){
  const res=await fetch(providerRoot+endpoint,{
    method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify(body)
  });
  if(!res.ok)throw new Error('A InfinitePay não respondeu à solicitação ('+res.status+').');
  return await res.json();
}
async function verifyPayment(env,order,slug,transaction){
  if(order.status==='paid'||order.status==='paid_review')return order.status;
  if(!slug||!transaction||slug.length>180||transaction.length>180)return 'pending';
  const confirmed=await providerPost('/payment_check',{
    handle:order.handle,order_nsu:order.order_nsu,slug,transaction_nsu:transaction
  });
  if(confirmed.paid!==true||confirmed.success!==true)return 'pending';
  if(Number(confirmed.amount)!==Number(order.amount_cents))return 'amount_mismatch';
  // Reivindica a confirmação de modo idempotente para evitar duplicação de estoque.
  const claim=await env.DB.prepare("UPDATE zion_orders SET status='confirming', updated_at=? WHERE order_nsu=? AND status='pending'")
    .bind(now(),order.order_nsu).run();
  if(Number(claim.meta?.changes||0)!==1){
    const reread=await env.DB.prepare('SELECT status FROM zion_orders WHERE order_nsu=?').bind(order.order_nsu).first();
    return reread?.status||'pending';
  }
  const items=pickJson(order.items_json,[]);
  let needsReview=false;
  for(const item of items){
    const row=await env.DB.prepare('SELECT stock_json FROM products WHERE id=?').bind(item.id).first();
    if(!row){needsReview=true;continue;}
    const stock=pickJson(row.stock_json,{});
    if(!Number.isSafeInteger(Number(stock[item.size]))||Number(stock[item.size])<item.quantity){needsReview=true;continue;}
    const adjusted={...stock,[item.size]:Number(stock[item.size])-item.quantity};
    const change=await env.DB.prepare('UPDATE products SET stock_json=?,updated_at=? WHERE id=? AND stock_json=?')
      .bind(JSON.stringify(adjusted),now(),item.id,row.stock_json).run();
    if(Number(change.meta?.changes||0)!==1)needsReview=true;
  }
  const finalStatus=needsReview?'paid_review':'paid';
  await env.DB.prepare('UPDATE zion_orders SET status=?, invoice_slug=?, transaction_nsu=?, updated_at=? WHERE order_nsu=?')
    .bind(finalStatus,slug,transaction,now(),order.order_nsu).run();
  return finalStatus;
}
export async function checkoutRoutes(request,env,path){
  const method=request.method;
  if(path==='/api/checkout/config'&&method==='GET'){
    return result({enabled:isConfigured(env),provider:'InfinitePay',shipping_cents:isConfigured(env)?shippingOf(env):null,
      requires_address:true,checkout_mode:'redirect'});
  }
  if(path==='/api/checkout/create'&&method==='POST'){
    if(!isConfigured(env))return error('Pagamento aguardando configuração da InfinitePay e do frete.',503);
    await checkoutTables(env);
    if(!await limitAttempts(request,env))return error('Muitas tentativas. Aguarde 15 minutos.',429);
    const input=await parseInput(request);
    if(!Array.isArray(input.items)||input.items.length<1||input.items.length>8)return error('Sacola inválida.',400);
    const customer={
      name:safeText(input.customer?.name,120),email:safeText(input.customer?.email,150),
      phone_number:safeText(input.customer?.phone_number,20).replace(/[^\d+]/g,'')
    };
    if(customer.name.length<3||!/^\S+@\S+\.\S+$/.test(customer.email)||customer.phone_number.replace(/\D/g,'').length<10)
      return error('Preencha nome, e-mail e telefone válidos.',400);
    const address={
      cep:safeText(input.address?.cep,10).replace(/\D/g,''),
      street:safeText(input.address?.street,150),
      neighborhood:safeText(input.address?.neighborhood,100),
      number:safeText(input.address?.number,20),
      complement:safeText(input.address?.complement,120),
      city:safeText(input.address?.city,100),
      state:safeText(input.address?.state,2).toUpperCase()
    };
    if(!/^\d{8}$/.test(address.cep)||address.street.length<3||address.neighborhood.length<2||
      !address.number||address.city.length<2||!/^[A-Z]{2}$/.test(address.state))
      return error('Preencha o endereço completo para entrega.',400);
    let subtotal=0,qtyTotal=0;
    const lines=[],merged=new Map();
    for(const raw of input.items){
      const id=safeText(raw.id,50),size=safeText(raw.size,12),quantity=Number(raw.qty);
      if(!uuid(id)||!size||!Number.isSafeInteger(quantity)||quantity<1||quantity>10)return error('Item ou quantidade inválida.',400);
      const key=id+'|'+size;merged.set(key,(merged.get(key)||0)+quantity);
    }
    if(merged.size>8)return error('Limite de itens por pedido atingido.',400);
    for(const [key,quantity] of merged){
      const [id,size]=key.split('|');
      const row=await env.DB.prepare('SELECT id,name,price_cents,sizes_json,stock_json FROM products WHERE id=? AND active=1')
        .bind(id).first();
      if(!row)return error('Um produto não está mais disponível.',409);
      const sizes=pickJson(row.sizes_json,[]),stock=pickJson(row.stock_json,{});
      if(!sizes.includes(size)||!Number.isSafeInteger(Number(stock[size]))||Number(stock[size])<quantity)
        return error('Quantidade indisponível em '+row.name+' / '+size+'.',409);
      if(!Number.isSafeInteger(Number(row.price_cents))||Number(row.price_cents)<1)return error('Preço indisponível.',409);
      subtotal+=Number(row.price_cents)*quantity;qtyTotal+=quantity;
      lines.push({id:row.id,name:row.name,size,quantity,price_cents:Number(row.price_cents)});
    }
    if(qtyTotal>20||subtotal>100000000)return error('Pedido acima do limite permitido.',400);
    const amount=subtotal+shippingOf(env);
    const order_nsu=crypto.randomUUID(),created=now();
    const redirect=new URL('/pedido/',request.url);
    redirect.searchParams.set('order_nsu',order_nsu);
    const hook=new URL('/api/checkout/webhook',request.url);
    await env.DB.prepare(`INSERT INTO zion_orders(order_nsu,handle,status,items_json,customer_json,address_json,
      amount_cents,shipping_cents,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`)
      .bind(order_nsu,handleOf(env),'pending',JSON.stringify(lines),JSON.stringify(customer),JSON.stringify(address),
        amount,shippingOf(env),created,created).run();
    const providerItems=lines.map(v=>({
      quantity:v.quantity,price:v.price_cents,description:v.name+' / '+v.size
    }));
    if(shippingOf(env)>0)providerItems.push({quantity:1,price:shippingOf(env),description:'Entrega do pedido'});
    let link;
    try{
      const response=await providerPost('/links',{
        handle:handleOf(env),order_nsu,items:providerItems,
        redirect_url:redirect.href,webhook_url:hook.href,
        customer,address:{
          cep:address.cep,street:address.street,neighborhood:address.neighborhood,
          number:address.number,complement:address.complement
        }
      });
      link=checkoutURL(response.url);
      if(!link)throw new Error('A InfinitePay retornou um link inválido.');
    }catch(err){
      await env.DB.prepare("UPDATE zion_orders SET status='link_error',updated_at=? WHERE order_nsu=?").bind(now(),order_nsu).run();
      console.error('InfinitePay checkout:',String(err));
      return error('Não foi possível abrir o pagamento. Tente novamente.',502);
    }
    await env.DB.prepare('UPDATE zion_orders SET checkout_url=?,updated_at=? WHERE order_nsu=?')
      .bind(link,now(),order_nsu).run();
    return result({order_nsu,url:link,amount_cents:amount,shipping_cents:shippingOf(env)});
  }
  if(path==='/api/checkout/status'&&method==='GET'){
    await checkoutTables(env);
    const id=new URL(request.url).searchParams.get('order_nsu');
    if(!uuid(id))return error('Pedido inválido.',400);
    const row=await env.DB.prepare('SELECT order_nsu,status,amount_cents,shipping_cents,receipt_url FROM zion_orders WHERE order_nsu=?').bind(id).first();
    return row?result({order_nsu:row.order_nsu,status:row.status,amount_cents:row.amount_cents,
      shipping_cents:row.shipping_cents}):error('Pedido não localizado.',404);
  }
  if((path==='/api/checkout/verify'||path==='/api/checkout/webhook')&&method==='POST'){
    // A confirmação de um pedido antigo continua válida mesmo se o lojista desativar o checkout.
    await checkoutTables(env);
    const data=await parseInput(request);
    const id=safeText(data.order_nsu,50);
    if(!uuid(id))return error('Pedido inválido.',400);
    const order=await env.DB.prepare('SELECT * FROM zion_orders WHERE order_nsu=?').bind(id).first();
    if(!order)return error('Pedido não encontrado.',404);
    if(!/^[a-zA-Z0-9._-]{2,80}$/.test(order.handle||''))return error('Conta do pedido não configurada.',503);
    const slug=safeText(data.slug||data.invoice_slug,180);
    const transaction=safeText(data.transaction_nsu,180);
    let status;
    try{status=await verifyPayment(env,order,slug,transaction)}
    catch(err){console.error('InfinitePay payment_check:',String(err));return error('Não foi possível confirmar o pagamento.',502);}
    if(path==='/api/checkout/webhook' && (status==='pending'||status==='confirming'))
      return error('Confirmação pendente: a InfinitePay deve tentar novamente.',400);
    if(status==='amount_mismatch')return error('Valor de pagamento divergente.',path==='/api/checkout/webhook'?400:409);
    return result({success:true,paid:status==='paid'||status==='paid_review',status,order_nsu:id,
      review_required:status==='paid_review'});
  }
  return error('Rota não encontrada.',404);
}

/* Só chamar depois da autenticação de administrador do Worker. */
export async function adminCheckoutOrders(env){
  await checkoutTables(env);
  const rows=(await env.DB.prepare('SELECT * FROM zion_orders ORDER BY created_at DESC LIMIT 100').all()).results||[];
  return result({orders:rows.map(row=>({
    order_nsu:row.order_nsu,status:row.status,amount_cents:row.amount_cents,
    shipping_cents:row.shipping_cents,items:pickJson(row.items_json,[]),
    customer:pickJson(row.customer_json,{}),address:pickJson(row.address_json,{}),
    created_at:row.created_at,updated_at:row.updated_at
  }))});
}
