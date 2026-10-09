-- Registro único da primeira importação do catálogo.
-- Impede recriação automática se um produto for removido no painel.
CREATE TABLE IF NOT EXISTS catalog_bootstrap (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
