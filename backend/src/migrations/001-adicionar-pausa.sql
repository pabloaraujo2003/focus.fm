-- Migration: Adicionar suporte a pausa/retomada na tabela sessoes
-- Descrição: Adiciona colunas para rastrear estado anterior, timestamp de pausa e tempo total pausado

-- Adicionar coluna para armazenar o estado anterior (antes de pausar)
ALTER TABLE sessoes ADD COLUMN estado_anterior TEXT;

-- Adicionar coluna para rastrear quando a sessão foi pausada
ALTER TABLE sessoes ADD COLUMN pausado_em TIMESTAMPTZ;

-- Adicionar coluna para acumular tempo total pausado (em segundos)
ALTER TABLE sessoes ADD COLUMN tempo_pausa_total_seg INTEGER DEFAULT 0;

-- Índices para otimizar queries futuras
CREATE INDEX idx_sessoes_contexto ON sessoes(contexto);
CREATE INDEX idx_sessoes_iniciada_em ON sessoes(iniciada_em DESC);

-- Comentários explicativos
COMMENT ON COLUMN sessoes.estado_anterior IS 'Estado da sessão antes de pausar (null se não pausada)';
COMMENT ON COLUMN sessoes.pausado_em IS 'Timestamp de quando foi pausado (null se não pausada)';
COMMENT ON COLUMN sessoes.tempo_pausa_total_seg IS 'Acumula tempo total pausado durante a sessão';
