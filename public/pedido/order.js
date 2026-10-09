/* O redirect do navegador não é comprovante. Somente payment_check confirma venda. */
(() => {
 'use strict';
 const qs=new URLSearchParams(location.search),id=qs.get('order_nsu');
 const $=s=>document.querySelector(s);
 const head=$('#orderHeading'),details=$('#orderDetails'),retry=$('#retryButton');
 if(!id||!/^[a-f0-9-]{36}$/i.test(id)){head.textContent='PEDIDO NÃO IDENTIFICADO';details.textContent='Retorne à loja e consulte o suporte para localizar o pagamento.';return}
 $('#orderReference').textContent='PEDIDO '+id.slice(0,8).toUpperCase();
 async function request(url,options={}){
   const response=await fetch(url,{cache:'no-store',credentials:'same-origin',...options});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível consultar seu pagamento.');return data;
 }
 async function check(){
   retry.hidden=true;head.textContent='VERIFICANDO PAGAMENTO…';
   details.textContent='Aguarde enquanto confirmamos a situação do pedido na InfinitePay.';
   try{
     const slug=qs.get('slug'),transaction=qs.get('transaction_nsu');
     if(slug&&transaction){
       await request('/api/checkout/verify',{method:'POST',headers:{'Content-Type':'application/json'},
         body:JSON.stringify({order_nsu:id,slug,transaction_nsu:transaction})});
     }
     const data=await request('/api/checkout/status?order_nsu='+encodeURIComponent(id));
     if(data.status==='paid'||data.status==='paid_review'){
       head.textContent='PAGAMENTO CONFIRMADO';
       details.textContent=data.status==='paid_review'?'Recebemos seu pagamento. A equipe Zion vai conferir a disponibilidade e entrar em contato antes do envio.':'Seu pagamento foi confirmado. Nossa equipe dará continuidade à preparação e ao envio do seu pedido.';
       try{localStorage.removeItem('zion-cart')}catch{}
     }else if(data.status==='pending'||data.status==='confirming'){
       head.textContent='AGUARDANDO CONFIRMAÇÃO';
       details.textContent='Ainda não recebemos a confirmação da InfinitePay. Se você acabou de pagar, aguarde um momento e consulte novamente. Não realize outro pagamento sem verificar o primeiro.';
       retry.hidden=false;
     }else{
       head.textContent='PAGAMENTO NÃO CONFIRMADO';
       details.textContent='O pedido não está pago. Confira a situação no aplicativo InfinitePay ou entre em contato com a loja antes de fazer outra tentativa.';
       retry.hidden=false;
     }
   }catch(e){head.textContent='NÃO FOI POSSÍVEL VERIFICAR';details.textContent=e.message||'Tente novamente em alguns instantes.';retry.hidden=false}
 }
 retry.addEventListener('click',check);
 check();
})();
