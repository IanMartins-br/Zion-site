# ZION CLOTHING — vitrine + administração (Cloudflare Workers, D1 e R2)

Projeto da loja Zion. Instagram: https://instagram.com/usezion.ofc

## Estado atual
Esta branch é uma versão de desenvolvimento. Ainda não foi implantada em produção.
- Front-end responsivo em `public/`.
- Vitrine alimentada pelo D1, inicialmente sem produtos fictícios.
- Editorais do R2 com rotação de imagem a cada 3 horas na Home.
- Painel protegido em `/admin.html`, com cadastro/edição/remoção de produtos, estoque por tamanho, fotos e visibilidade.
- Upload de fotos (JPG/PNG/WEBP/AVIF até 8 MB por arquivo) no R2; acervo editorial separado do catálogo.
- API no Worker em `src/worker.js`.
- **Checkout não habilitado**. Não recebe pagamentos ou pedidos nesta fase.

## Configuração (antes de mesclar/deploy)
1. O `database_id` do D1 `zion` já foi configurado em `wrangler.jsonc` (binding `DB`).
2. Confirme o bucket R2 `zion` no mesmo ambiente Cloudflare (binding `MEDIA`).
3. No Worker, configure **Secrets** (não publique senhas no GitHub):
   - `ADMIN_PASSWORD`: senha forte com 12 caracteres ou mais.
   - `SESSION_SECRET`: segredo aleatório de 32 caracteres ou mais, diferente da senha.
4. Faça a migração do D1 **em produção** (uma vez) antes de acessar o painel:

```bash
npm install
npx wrangler d1 migrations apply zion --remote
```

5. Teste localmente com `npm run dev`. Em projeto Workers conectado ao GitHub, publique na branch principal após confirmar as configurações e migrações. Caso necessário: `npm run deploy`.
6. Visite `/admin.html`, entre com a senha secreta, envie imagens de campanhas e cadastre os produtos.

> **Importante:** A branch principal atualmente contém a prévia estática anterior. Não faça merge antes de configurar os secrets, aplicar as migrações e testar as rotas protegidas. A conexão do Worker no painel da Cloudflare não pode ser validada somente pelo GitHub.

## Organização das fotos
Envie diretamente de seus arquivos para o painel, não é necessário um link público do iCloud.
- **Editorias:** `hero`, `feminino`, `masculino`, `campanha` ou `geral` (a cada 3 h troca de foto).
- **Produtos:** foto(s) de um produto, escolhidas e ordenadas pelo seu cadastro (limite atual de 8; primeira como capa).

## Segurança e limites
- Sessão por cookie HTTP-only, Secure, SameSite Strict, expira após 12 h.
- Login limitado a seis tentativas por IP por 15 min, via D1.
- Mudanças administrativas requerem login e origem do próprio site.
- SQL parametrizado; tamanho e tipo de arquivo restritos.
- Endpoints `/api/products` e `/api/editorials` são públicos e só retornam registros visíveis.
- Antes de lançar venda real, implementar checkout/pedidos seguros, cálculo de frete, política de trocas e privacidade, conformidade LGPD e audit trail para alteração de estoque.

## Arquivos
- `src/worker.js`: API e R2 media proxy.
- `migrations/0001_zion_catalog.sql`: tabelas D1.
- `public/index.html`, `public/styles.css`, `public/app.js`: vitrine.
- `public/admin.html`, `public/admin.css`, `public/admin.js`: admin.
