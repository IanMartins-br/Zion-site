/* Zion: login sem PIN via Cloudflare Access, validando o JWT RS256 na origem.
   A sessão PIN existente permanece até a aplicação Access e seu AUD serem configurados.
   Nunca aceite cabeçalhos de e-mail simples: sempre verifique assinatura, issuer, audience. */
const ADMIN_EMAIL='ianlucas.fm@icloud.com';
const accessConfigured=env=>{
  const t=String(env.ADMIN_ACCESS_TEAM_DOMAIN||'').trim().replace(/\/$/,'');
  const a=String(env.ADMIN_ACCESS_AUD||'').trim();
  return /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(t)&&/^[a-zA-Z0-9_-]{15,150}$/.test(a);
};
const accessRequested=env=>Boolean(env.ADMIN_ACCESS_TEAM_DOMAIN||env.ADMIN_ACCESS_AUD);
const unpack=str=>{
  if(!/^[A-Za-z0-9_-]+$/.test(str)||str.length>10000)throw Error('JWT inválido');
  const norm=str.replace(/-/g,'+').replace(/_/g,'/');
  const bytes=atob(norm+'='.repeat((4-norm.length%4)%4));
  return Uint8Array.from(bytes,ch=>ch.charCodeAt(0));
};
const tokenFrom=request=>{
  const header=request.headers.get('Cf-Access-Jwt-Assertion')||'';
  if(header)return header;
  // O token pode chegar como cookie quando Access protege paths diferentes.
  const cookie=request.headers.get('Cookie')||'';
  return cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/i)?.[1]||'';
};
const keyCache=new Map();
async function fetchKey(team,kid){
  const cached=keyCache.get(team);
  if(cached&&cached.expires>Date.now()){
    const key=cached.keys.find(k=>k.kid===kid&&k.kty==='RSA'&&k.alg==='RS256');
    if(key)return key;
  }
  const res=await fetch(team+'/cdn-cgi/access/certs',{redirect:'error'});
  if(!res.ok)throw Error('Certificado Access indisponível');
  const data=await res.json();
  if(!Array.isArray(data.keys)||data.keys.length<1||data.keys.length>30)throw Error('Certificados Access inválidos');
  const keys=data.keys.filter(k=>k.kty==='RSA'&&k.alg==='RS256'&&typeof k.kid==='string');
  keyCache.set(team,{keys,expires:Date.now()+300000});
  return keys.find(k=>k.kid===kid)||null;
}
export function adminAccessMode(env){
  // Uma configuração parcial não reativa a senha antiga, evitando downgrade.
  return accessRequested(env);
}
export async function adminAccessIdentity(request,env){
  if(!accessConfigured(env))return null;
  const token=tokenFrom(request);
  if(!token||token.length>12000)return null;
  const parts=token.split('.');
  if(parts.length!==3)return null;
  try{
    const head=JSON.parse(new TextDecoder().decode(unpack(parts[0])));
    if(head.alg!=='RS256'||typeof head.kid!=='string'||head.kid.length>250)return null;
    const team=String(env.ADMIN_ACCESS_TEAM_DOMAIN).trim().replace(/\/$/,'');
    const jwk=await fetchKey(team,head.kid);
    if(!jwk)return null;
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    const signed=new TextEncoder().encode(parts[0]+'.'+parts[1]);
    const signature=unpack(parts[2]);
    if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,signature,signed))return null;
    const payload=JSON.parse(new TextDecoder().decode(unpack(parts[1])));
    const now=Math.floor(Date.now()/1000);
    const aud=String(env.ADMIN_ACCESS_AUD).trim();
    const audience=Array.isArray(payload.aud)?payload.aud:[payload.aud];
    if(payload.iss!==team||!audience.includes(aud)||payload.type!=='app')return null;
    if(!Number.isFinite(payload.exp)||payload.exp<=now||
      (payload.nbf!==undefined&&payload.nbf>now+30)||
      (payload.iat!==undefined&&payload.iat>now+30))return null;
    if(String(payload.email||'').trim().toLowerCase()!==ADMIN_EMAIL)return null;
    return {provider:'cloudflare-access',email:ADMIN_EMAIL};
  }catch(error){
    console.warn('Zion admin Access token recusado:',String(error));
    return null;
  }
}
