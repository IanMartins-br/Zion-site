const json = (value,status=200,headers={}) => new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const fail = (message,status=400) => json({error:message},status);
const asText = (v,max=200) => String(v ?? '').trim().slice(0,max);
const pickJSON = (value,fallback) => {try{return JSON.parse(value)}catch{return fallback}};
const now = () => Math.floor(Date.now()/1000);
const bytesToHex = buf => Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
const sha256 = async s => bytesToHex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
const requireSameOrigin = req => {
  const origin=req.headers.get('Origin');
  if(origin && origin!==new URL(req.url).origin)return false;
  const site=req.headers.get('Sec-Fetch-Site');
  return !site || site==='same-origin'||site==='none';
};
const validKey = key => /^(editorials|products)\/[a-f0-9-]{36}\.(jpg|png|webp|avif)$/.test(key);
const parseBody=async req=>{
  const ct=req.headers.get('content-type')||'';
  if(!ct.toLowerCase().includes('application/json'))throw new Error('Envie JSON válido.');
  const raw=await req.text();
  if(raw.length>100000)throw new Error('Dados muito grandes.');
  return JSON.parse(raw);
};
const sessionCookie=(value,maxAge=0)=>'__Host-zion_session='+value+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+maxAge;
async function session(request,env){
  const token=(request.headers.get('Cookie')||'').match(/(?:^|;\s*)__Host-zion_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if(!token)return null;
  const tokenHash=await sha256(token);
  return env.DB.prepare('SELECT token_hash FROM sessions WHERE token_hash = ? AND expires_at > ?').bind(tokenHash,now()).first();
}
function cleanProduct(input){
  const name=asText(input.name,140);
  if(name.length<2)throw new Error('Informe o nome do produto.');
  const category=asText(input.category,40);
  if(!['Masculino','Feminino','Unissex','Acessórios'].includes(category))throw new Error('Categoria inválida.');
  const price=Number(input.price_cents);
  if(!Number.isSafeInteger(price)||price<0||price>100000000)throw new Error('Preço inválido (em centavos).');
  const sizes=Array.isArray(input.sizes)?[...new Set(input.sizes.map(s=>asText(s,12)).filter(Boolean))].slice(0,20):[];
  if(!sizes.length)throw new Error('Escolha ao menos um tamanho.');
  const stock={};
  for(const size of sizes){
    const count=Number(input.stock?.[size]??0);
    if(!Number.isSafeInteger(count)||count<0||count>1000000)throw new Error('Quantidade inválida para '+size);
    stock[size]=count;
  }
  const keys=Array.isArray(input.imageKeys)?[...new Set(input.imageKeys)].slice(0,8):[];
  if(keys.some(key=>typeof key!=='string'||!validKey(key)||!key.startsWith('products/')))throw new Error('Imagem de produto inválida.');
  return {name,category,description:asText(input.description,2000),price,tag:asText(input.tag,35),sizes,stock,keys,active:input.active===false?0:1};
}
const publicProduct=row=>({
  id:row.id,name:row.name,category:row.category,description:row.description,
  price_cents:row.price_cents,tag:row.tag,sizes:pickJSON(row.sizes_json,[]),
  stock:pickJSON(row.stock_json,{}),imageKeys:pickJSON(row.images_json,[]),
  image:(pickJSON(row.images_json,[])[0] ? '/media/'+pickJSON(row.images_json,[])[0]:null),
  images:pickJSON(row.images_json,[]).map(key=>'/media/'+key),
  active:!!row.active,created_at:row.created_at,updated_at:row.updated_at
});
const publicMedia=row=>({id:row.id,kind:row.kind,slot:row.slot,title:row.title,key:row.object_key,url:'/media/'+row.object_key,active:!!row.active,created_at:row.created_at});
async function publicRoutes(request,env,path){
  if(path==='/api/products' && request.method==='GET'){
    const rows=(await env.DB.prepare('SELECT * FROM products WHERE active = 1 ORDER BY created_at DESC').all()).results;
    return json({products:rows.map(publicProduct)});
  }
  if(path==='/api/editorials' && request.method==='GET'){
    const rows=(await env.DB.prepare("SELECT * FROM media WHERE kind = 'editorial' AND active = 1 ORDER BY created_at DESC").all()).results;
    return json({images:rows.map(publicMedia)});
  }
  return null;
}
async function adminRoutes(request,env,path){
  if(path==='/api/admin/login' && request.method==='POST'){
    if(!env.ADMIN_PASSWORD || !/^\\d{4}$/.test(env.ADMIN_PASSWORD))return fail('Configure ADMIN_PASSWORD com o PIN temporário de 4 dígitos no Secret do Worker.',503);
    const identity=await sha256('zion-login-attempts-v1|'+(request.headers.get('CF-Connecting-IP')||'local'));
    const windowStart=now()-900;
    await env.DB.prepare('DELETE FROM login_attempts WHERE attempted_at < ?').bind(windowStart).run();
    const attempted=await env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE ip_hash = ? AND attempted_at >= ?').bind(identity,windowStart).first();
    if(attempted.n>=6)return fail('Muitas tentativas. Tente novamente em 15 minutos.',429);
    const data=await parseBody(request);
    const supplied=typeof data.password==='string'?data.password:'';
    const actual=await sha256(env.ADMIN_PASSWORD+'|zion-login-v1');
    const trial=await sha256(supplied+'|zion-login-v1');
    if(actual!==trial){
      await env.DB.prepare('INSERT INTO login_attempts (ip_hash,attempted_at) VALUES (?,?)').bind(identity,now()).run();
      return fail('Senha incorreta.',401);
    }
    await env.DB.prepare('DELETE FROM login_attempts WHERE ip_hash = ?').bind(identity).run();
    const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('');
    const hash=await sha256(token);
    await env.DB.prepare('INSERT INTO sessions (token_hash, expires_at) VALUES (?,?)').bind(hash,now()+43200).run();
    return json({ok:true},200,{'Set-Cookie':sessionCookie(token,43200)});
  }
  const verified=await session(request,env);
  if(!verified)return fail('Acesso restrito. Faça login.',401);
  if(path==='/api/admin/me'&&request.method==='GET')return json({authenticated:true});
  if(path==='/api/admin/logout'&&request.method==='POST'){
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(verified.token_hash).run();
    return json({ok:true},200,{'Set-Cookie':sessionCookie('',0)});
  }
  if(path==='/api/admin/products'&&request.method==='GET'){
    const rows=(await env.DB.prepare('SELECT * FROM products ORDER BY created_at DESC').all()).results;
    return json({products:rows.map(publicProduct)});
  }
  if(path==='/api/admin/products'&&request.method==='POST'){
    const p=cleanProduct(await parseBody(request));
    for(const key of p.keys){if(!await env.DB.prepare("SELECT id FROM media WHERE object_key = ? AND kind = 'product'").bind(key).first())return fail('Cadastre as imagens primeiro.',400);}
    const id=crypto.randomUUID(),stamp=new Date().toISOString();
    await env.DB.prepare('INSERT INTO products(id,name,category,description,price_cents,tag,sizes_json,stock_json,images_json,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id,p.name,p.category,p.description,p.price,p.tag,JSON.stringify(p.sizes),JSON.stringify(p.stock),JSON.stringify(p.keys),p.active,stamp,stamp).run();
    return json({ok:true,id},201);
  }
  const productId=path.match(/^\/api\/admin\/products\/([a-f0-9-]{36})$/)?.[1];
  if(productId&&request.method==='PUT'){
    if(!await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(productId).first())return fail('Produto não encontrado.',404);
    const p=cleanProduct(await parseBody(request));
    for(const key of p.keys){if(!await env.DB.prepare("SELECT id FROM media WHERE object_key = ? AND kind = 'product'").bind(key).first())return fail('Imagem inválida.',400);}
    await env.DB.prepare('UPDATE products SET name=?,category=?,description=?,price_cents=?,tag=?,sizes_json=?,stock_json=?,images_json=?,active=?,updated_at=? WHERE id=?')
      .bind(p.name,p.category,p.description,p.price,p.tag,JSON.stringify(p.sizes),JSON.stringify(p.stock),JSON.stringify(p.keys),p.active,new Date().toISOString(),productId).run();
    return json({ok:true});
  }
  if(productId&&request.method==='DELETE'){
    await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(productId).run();
    return json({ok:true});
  }
  if(path==='/api/admin/media'&&request.method==='GET'){
    const rows=(await env.DB.prepare('SELECT * FROM media ORDER BY created_at DESC').all()).results;
    return json({images:rows.map(publicMedia)});
  }
  if(path==='/api/admin/media'&&request.method==='POST'){
    const length=Number(request.headers.get('Content-Length')||0);
    if(length>9_000_000)return fail('Imagem muito grande (máximo 8 MB).',413);
    const form=await request.formData();
    const file=form.get('file'),kind=asText(form.get('kind'),20);
    if(!(file instanceof File)||!['editorial','product'].includes(kind))return fail('Selecione uma imagem e o tipo.',400);
    const allowed={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif'};
    const ext=allowed[file.type];
    if(!ext||file.size>8_000_000||file.size===0)return fail('Envie JPG, PNG, WEBP ou AVIF de até 8 MB.',400);
    const slot=kind==='editorial'?asText(form.get('slot'),30):'produto';
    if(kind==='editorial'&&!['hero','feminino','masculino','campanha','geral'].includes(slot))return fail('Posição editorial inválida.',400);
    const id=crypto.randomUUID(),key=(kind==='editorial'?'editorials/':'products/')+id+'.'+ext,title=asText(form.get('title'),140);
    await env.MEDIA.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type,cacheControl:'public, max-age=86400'},customMetadata:{kind}});
    try{await env.DB.prepare('INSERT INTO media (id,kind,slot,title,object_key,active,created_at) VALUES (?,?,?,?,?,?,?)')
      .bind(id,kind,slot,title,key,1,new Date().toISOString()).run();}
    catch(e){await env.MEDIA.delete(key);throw e;}
    return json({ok:true,image:{id,kind,slot,title,key,url:'/media/'+key,active:true}},201);
  }
  const mediaId=path.match(/^\/api\/admin\/media\/([a-f0-9-]{36})$/)?.[1];
  if(mediaId&&request.method==='PATCH'){
    const m=await env.DB.prepare('SELECT * FROM media WHERE id = ?').bind(mediaId).first();
    if(!m)return fail('Imagem não encontrada.',404);
    const data=await parseBody(request);
    const slot=asText(data.slot,30);
    if(m.kind==='editorial'&&!['hero','feminino','masculino','campanha','geral'].includes(slot))return fail('Posição inválida.',400);
    await env.DB.prepare('UPDATE media SET slot=?,title=?,active=? WHERE id=?')
      .bind(m.kind==='product'?'produto':slot,asText(data.title,140),data.active===false?0:1,mediaId).run();
    return json({ok:true});
  }
  if(mediaId&&request.method==='DELETE'){
    const m=await env.DB.prepare('SELECT * FROM media WHERE id = ?').bind(mediaId).first();
    if(!m)return fail('Imagem não encontrada.',404);
    if(m.kind==='product'){
      const referenced=await env.DB.prepare('SELECT id FROM products WHERE instr(images_json, ?) > 0 LIMIT 1').bind(m.object_key).first();
      if(referenced)return fail('Remova esta imagem do produto antes de apagá-la.',409);
    }
    await env.DB.prepare('DELETE FROM media WHERE id = ?').bind(mediaId).run();
    await env.MEDIA.delete(m.object_key);
    return json({ok:true});
  }
  return fail('Rota não encontrada.',404);
}
export default {
  async fetch(request,env){
    const url=new URL(request.url),path=url.pathname;
    try {
      // Caminho curto para o painel; mantém autenticação da API separada.
      if ((path === '/admin' || path === '/admin/') && (request.method === 'GET' || request.method === 'HEAD')) {
        const target=new URL('/admin.html',request.url);
        return env.ASSETS.fetch(new Request(target.toString(),request));
      }
      if(path.startsWith('/media/')){
        if(request.method!=='GET'&&request.method!=='HEAD')return fail('Método não permitido.',405);
        if(!env.MEDIA)return fail('R2 MEDIA ainda não configurado.',503);
        const key=decodeURIComponent(path.slice(7));
        if(!validKey(key))return fail('Arquivo inválido.',404);
        const obj=await env.MEDIA.get(key);
        if(!obj)return fail('Imagem não encontrada.',404);
        const headers=new Headers({'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff','Content-Type':obj.httpMetadata?.contentType||'application/octet-stream'});
        return new Response(request.method==='HEAD'?null:obj.body,{headers});
      }
      if(path.startsWith('/api/')){
        if(!requireSameOrigin(request))return fail('Origem não autorizada.',403);
        if(!env.DB)return fail('D1 DB ainda não configurado.',503);
        if(path.startsWith('/api/admin/'))return await adminRoutes(request,env,path);
        const response=await publicRoutes(request,env,path);
        return response||fail('Rota não encontrada.',404);
      }
      return env.ASSETS.fetch(request);
    }catch(error){
      if(error instanceof SyntaxError)return fail('JSON inválido.',400);
      if(error.message && (/inválid|Informe|Escolha|Envie|muito|grande/i).test(error.message))return fail(error.message,400);
      console.error('Zion API:',error);
      return fail('Não foi possível concluir a operação. Confira o D1, R2 e as migrações.',500);
    }
  }
};
