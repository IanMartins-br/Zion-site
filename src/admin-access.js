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
    const key=cached.keys.find(k=>k.kid===kid&&k.kty==='RSA'&&(k.alg===undefined||k.alg==='RS256'));
    if(key)return key;
  }
  const res=await fetch(team+'/cdn-cgi/access/certs',{redirect:'error'});
  if(!res.ok)throw Error('Certificado Access indisponível');
  const data=await res.json();
  if(!Array.isArray(data.keys)||data.keys.length<1||data.keys.length>30)throw Error('Certificados Access inválidos');
  const keys=data.keys.filter(k=>k.kty==='RSA'&&(k.alg===undefined||k.alg==='RS256')&&typeof k.kid==='string');
  keyCache.set(team,{keys,expires:Date.now()+300000});
  return keys.find(k=>k.kid===kid)||null;
}
export function adminAccessMode(env){
  // Uma configuração parcial não reativa a senha antiga, evitando downgrade.
  return accessRequested(env);
}
// O diagnóstico contém apenas categorias, nunca o token, o cookie ou dados do usuário.
function denyAccess(diagnostic,reason){
  if(diagnostic&&typeof diagnostic==='object')diagnostic.code=reason;
  return null;
}
export async function adminAccessIdentity(request,env,diagnostic){
  if(!accessConfigured(env))return denyAccess(diagnostic,'ACCESS_SETTINGS_INCOMPLETE');
  if(String(env.ADMIN_ALLOWED_EMAIL||'').trim().toLowerCase()!==ADMIN_EMAIL)return denyAccess(diagnostic,'ALLOWED_EMAIL_CONFIG');
  const token=tokenFrom(request);
  if(!token)return denyAccess(diagnostic,'ACCESS_TOKEN_MISSING');
  if(token.length>12000)return denyAccess(diagnostic,'ACCESS_TOKEN_TOO_LARGE');
  const parts=token.split('.');
  if(parts.length!==3)return denyAccess(diagnostic,'ACCESS_TOKEN_FORMAT');
  let phase='HEADER';
  try{
    const head=JSON.parse(new TextDecoder().decode(unpack(parts[0])));
    if(head.alg!=='RS256'||typeof head.kid!=='string'||head.kid.length>250)return denyAccess(diagnostic,'ACCESS_TOKEN_HEADER');
    const team=String(env.ADMIN_ACCESS_TEAM_DOMAIN).trim().replace(/\/$/,'');
    phase='JWKS_FETCH';
    const jwk=await fetchKey(team,head.kid);
    if(!jwk)return denyAccess(diagnostic,'ACCESS_CERT_KEY_NOT_FOUND');
    phase='CRYPTO_VERIFY';
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    const signed=new TextEncoder().encode(parts[0]+'.'+parts[1]);
    const signature=unpack(parts[2]);
    if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,signature,signed))return denyAccess(diagnostic,'ACCESS_SIGNATURE_INVALID');
    phase='CLAIMS';
    const payload=JSON.parse(new TextDecoder().decode(unpack(parts[1])));
    const now=Math.floor(Date.now()/1000);
    const aud=String(env.ADMIN_ACCESS_AUD).trim();
    const audience=Array.isArray(payload.aud)?payload.aud:[payload.aud];
    if(payload.iss!==team||!audience.includes(aud)||payload.type!=='app')return denyAccess(diagnostic,'ACCESS_AUDIENCE_OR_ISSUER');
    if(!Number.isFinite(payload.exp)||payload.exp<=now||
      (payload.nbf!==undefined&&payload.nbf>now+30)||
      (payload.iat!==undefined&&payload.iat>now+30))return denyAccess(diagnostic,'ACCESS_TOKEN_EXPIRED');
    if(String(payload.email||'').trim().toLowerCase()!==ADMIN_EMAIL)return denyAccess(diagnostic,'ACCESS_EMAIL_MISMATCH');
    if(diagnostic&&typeof diagnostic==='object')diagnostic.code='ACCESS_OK';
    return {provider:'cloudflare-access',email:ADMIN_EMAIL};
  }catch(error){
    // Evite registrar token/cookie em mensagens de erro ou respostas.
    console.warn('Zion admin Access: falha na fase',phase);
    return denyAccess(diagnostic,phase==='JWKS_FETCH'?'ACCESS_CERT_FETCH_FAILED':phase==='CRYPTO_VERIFY'?'ACCESS_CRYPTO_FAILED':'ACCESS_TOKEN_DECODE_FAILED');
  }
}
