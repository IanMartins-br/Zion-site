# ZION CLOTHING — vitrine + administração (Cloudflare Workers, D1 e R2)

Projeto da loja Zion. Instagram: https://instagram.com/usezion.ofc

## Estado atual
Esta branch é uma versão de desenvolvimento. Ainda não foi implantada em produção.
- Front-end responsivo em `public/`.
- Vitrine alimentada pelo D1, inicialmente sem produtos fictícios.
- Editorais do R2 com rotação de imagem a cada 3 horas na Home.
- Painel protegido em `/admin`, com cadastro/edição/remoção de produtos, estoque por tamanho, fotos e visibilidade.
- Upload de fotos (JPG/PNG/WEBP/AVIF até 8 MB por arquivo) no R2; acervo editorial separado do catálogo.
- API no Worker em `src/worker.js`.
- **Checkout InfinitePay preparado, mas desativado até configurar a InfiniteTag e o valor real do frete.** O cliente preenche dados de entrega e vai para o pagamento seguro da InfinitePay; a compra só é considerada paga após checagem direta na API.

## Configuração (antes de mesclar/deploy)
1. O `database_id` do D1 `zion` já foi configurado em `wrangler.jsonc` (binding `DB`).
2. Confirme o bucket R2 `zion` no mesmo ambiente Cloudflare (binding `MEDIA`).
3. No Worker, configure **Secrets** (não publique senhas no GitHub):
   - `ADMIN_PASSWORD`: senha forte com 4 dígitos (PIN temporário).
4. Faça a migração do D1 **em produção** (uma vez) antes de acessar o painel:

```bash
npm install
npx wrangler d1 migrations apply zion --remote
```

5. Teste localmente com `npm run dev`. Em projeto Workers conectado ao GitHub, publique na branch principal após confirmar as configurações e migrações. Caso necessário: `npm run deploy`.
6. Visite `/admin.html`, entre com a senha secreta, envie imagens de campanhas e cadastre os produtos.

> **Importante:** A branch principal atualmente contém a prévia estática anterior. Confirme a configuração do Secret `ADMIN_PASSWORD` (PIN de 4 dígitos) no Worker e teste as rotas protegidas antes de usar o painel. O PIN de 4 dígitos oferece proteção fraca: alterar por uma senha forte antes de colocar produtos reais. A conexão do Worker no painel da Cloudflare não pode ser validada somente pelo GitHub.

## Organização das fotos
Envie diretamente de seus arquivos para o painel, não é necessário um link público do iCloud.
- **Editorias:** `hero`, `feminino`, `masculino`, `campanha` ou `geral` (a cada 3 h troca de foto).
- **Produtos:** foto(s) de um produto, escolhidas e ordenadas pelo seu cadastro (limite atual de 8; primeira como capa).

## Segurança e limites
- Sessão por cookie HTTP-only, Secure, SameSite Strict, expira após 12 h.
- Login temporário por PIN de 4 dígitos limitado a seis tentativas por IP por 15 min, via D1. Não é recomendado para produção comercial.
- Mudanças administrativas requerem login e origem do próprio site.
- SQL parametrizado; tamanho e tipo de arquivo restritos.
- Endpoints `/api/products` e `/api/editorials` são públicos e só retornam registros visíveis.
- Antes de lançar venda real, testar ponta a ponta a InfinitePay, revisar disponibilidade/concorrência de estoque, custos de frete, política de trocas e privacidade (LGPD) e processos de separação e envio.

## Arquivos
- `src/worker.js` e `src/checkout.js`: catálogo, pedidos, APIs InfinitePay, verificação via API da provedora e proxy R2.
- `migrations/0001_zion_catalog.sql`: tabelas D1.
- `public/index.html`, `public/styles.css`, `public/app.js`: vitrine.
- `public/admin.html`, `public/admin.css`, `public/admin.js`: admin, incluindo aba de pedidos.
- `public/checkout/` e `public/pedido/`: coleta dos dados do pedido, redirecionamento para pagamento e retorno/consulta do estado.
- `migrations/0003_infinitepay_checkout.sql`: registros de pedido no D1.

## Acesso provisório ao painel

O PIN não é armazenado no repositório. Configure `ADMIN_PASSWORD` como **Secret** no painel Cloudflare Worker `zion-site`. O formulário fica em `/admin`, protegido por sessão HTTP-only e rate limiting. **Não exponha o PIN publicamente.**

## InfinitePay — ativar pagamentos na Zion (ainda pendente)

**Documentação oficial:** https://www.infinitepay.io/checkout-documentacao

A implementação utiliza o **Checkout Integrado** (não o link manual de vendas).
O cliente escolhe as peças, preenche os dados e a API do Worker gera um checkout
na InfinitePay com **valores obtidos do banco D1** (não informados pelo navegador).
A InfinitePay decide as formas de pagamento disponíveis, incluindo Pix e cartão.

### Configurações que faltam

1. No app/site InfinitePay, ative **Checkout Integrado**.
2. No Cloudflare Worker `zion-site`, configure as variáveis:
   - `INFINITEPAY_HANDLE` — sua **InfiniteTag**, sem o caractere `$`.
   - `ZION_SHIPPING_CENTS` — valor **real de frete fixo** em centavos para entrega,
     por exemplo `2000` representaria R$ 20,00 (exemplo apenas, não use sem aprovar).
     Valor `0` somente quando você decidir oferecer **frete grátis**.
   Sem ambas, o botão de pagamento do checkout fica desativado.
3. O preço exibido como simulação de SEDEX na página de produto é **ilustrativo** e
   **não é cobrado**. O checkout exibe o frete configurado antes de solicitar pagamento.
   Para tarifação por CEP, será necessário integrar uma API real de frete; **não**
   ative cobrança nacional com um valor fixo sem confirmar que é adequado.
4. Aplicar a migração D1 `npm run db:migrate` para manter esquema reprodutível.
   O Worker também cria as tabelas faltantes no primeiro acesso às rotas de checkout.
5. Executar uma compra de teste e conferir pagamento, valor total, webhook,
   status no admin, estoque e endereço. Somente depois divulgar o checkout ao público.

### Rotas e proteção

- `GET /api/checkout/config` — informa se a integração está ativada e o frete.
- `POST /api/checkout/create` — recebe itens/tamanhos/quantidades, nome, contato,
  endereço, consulta preços e estoques no D1 e solicita link à InfinitePay.
  Limite de tentativas e validações no servidor. A URL retornada é validada.
- `POST /api/checkout/webhook` — recebe aviso, mas **NUNCA confia cegamente
  nele**: chama a API `payment_check` para confirmar o pedido e o valor.
- `POST /api/checkout/verify` — confere a transação quando a InfinitePay redireciona
  o comprador; o simples retorno à página NÃO é comprovante.
- `GET /api/checkout/status` — mostra somente status e valores ao titular do link,
  sem nome/endereço.
- `GET /api/admin/orders` — lista protegida por sessão administrativa,
  com itens, contato e endereço, na aba Pedidos do admin.

O Worker guarda dados básicos de comprador e entrega no D1 para atender pedidos.
Não armazena número de cartão, CVV ou dados de autenticação da InfinitePay.
Os pedidos pagos com estoque insuficiente ou editado após a criação são marcados
como `paid_review` para conferência manual; ainda é necessário validar o fluxo
com concorrência e pagamentos tardios antes de vender em grande escala.
