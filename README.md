# focus.fm

**Controle Pomodoro com Spotify integrado** — Timer inteligente que toca playlists automaticamente conforme seu estado de foco.

## O que é

focus.fm é uma aplicação web que implementa a técnica Pomodoro com integração nativa ao Spotify. Quando você inicia uma sessão de foco, uma playlist começa a tocar automaticamente. Ao completar o período e entrar em pausa, a música muda. Simples, eficiente, sem distrações.

**Motivação:** Estudar TypeScript estrito, arquitetura limpa (domínio → aplicação → infraestrutura), máquina de estados, injeção de dependência com tsyringe, e como orquestrar APIs externas (Spotify) sem vazamento de lógica.

## Features

### MVP (Fase 1) ✅
- ⏱️ Timer Pomodoro configurável (25 min foco, 5 min pausa curta, 15 min pausa longa)
- 🎵 Integração Spotify: toca playlist ao iniciar, pausa ao trocar de estado
- 📝 Campo de contexto (no que você está focando?)
- 💾 Registro de sessões (duração, ciclos, contexto) em Supabase
- 🔐 Autenticação Spotify via PKCE (sem Client Secret exposto)

### Fase 2 (Em Progresso) 🚀
- ⏸️ **Pausa/retomada** — pause a sessão, o timer para (não perde tempo)
- 📜 **Histórico de contextos** — autocomplete mostra o que você focou antes
- 🎛️ **Vinil com faixa atual** — exibe música/artista tocando em tempo real
- 🔔 **Notificações do navegador** — alerta ao trocar de estado

### Futuro (Fase 3+)
- Perfis de contexto (ex: "estudo" usa playlist lo-fi, "trabalho" usa ambient)
- Dashboard de estatísticas (tempo focado por dia/contexto)
- Fade de volume nas transições
- Detecção de pausa esticada + notificações
- Streaks e gamificação
- Insights semanais com IA

## Tech Stack

**Backend:**
- Node.js + Express + TypeScript (strict mode)
- Domain-driven design: camadas domínio → aplicação → infraestrutura
- tsyringe para injeção de dependência
- Vitest para testes (TDD)
- Supabase (PostgreSQL gerenciado)

**Frontend:**
- Next.js 14+ com App Router
- React hooks
- axios para chamadas HTTP
- Notification API do navegador

**Integração Externa:**
- Spotify Web API (PKCE flow, sem backend secret)
- Rate limiting com backoff exponencial

## Como Usar

### Setup Local

```bash
# Clonar
git clone https://github.com/pabloaraujo2003/focus.fm
cd focus.fm

# Backend
cd backend
npm install
npm run dev  # http://localhost:3333

# Frontend (nova aba/terminal)
cd frontend
npm install
npm run dev  # http://localhost:3000
```

### Variáveis de Ambiente

**Backend** (`.env`):
```
SPOTIFY_CLIENT_ID=seu_client_id_aqui
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3333/auth/spotify/callback
SUPABASE_URL=sua_url_supabase
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
```

**Frontend** (`.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:3333
```

### Setup Spotify

1. Crie app em https://developer.spotify.com/dashboard
2. Solicite desenvolvimento pessoal (até 25 usuários)
3. Ative Premium (obrigatório pra PUT /me/player/play)
4. Copie Client ID para `.env`

### Setup Supabase

1. Crie projeto em https://supabase.com
2. Crie tabela `sessoes` com schema:
   ```sql
   id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   contexto TEXT
   ciclos_completados INT
   iniciada_em TIMESTAMPTZ DEFAULT now()
   finalizada_em TIMESTAMPTZ
   duracao_total_seg INT
   playlist_foco TEXT
   playlist_pausa TEXT
   estado_anterior TEXT
   pausado_em TIMESTAMPTZ
   tempo_pausa_total_seg INT DEFAULT 0
   ```
3. Execute migration em `backend/src/migrations/001-adicionar-pausa.sql`
4. Copie URL e Service Role Key para `.env`

## Arquitetura

```
Next.js Frontend
    ↓ axios
Express API (Backend)
    ├─ Domínio: máquina de estados pura (reducer)
    ├─ Aplicação: orquestração (GerenciadorDeSessao)
    ├─ Infraestrutura: Spotify + Supabase
    └─ HTTP: rotas REST
    ↓
Spotify Web API ↔ Supabase (PostgreSQL)
```

### Máquina de Estados

```
idle
  ↓
focando ←→ pausado
  ↓         ↑
pausa_curta ↗
  ↓
focando
  ↓
pausa_longa
  ↓
idle
```

Estados são imutáveis, transições validadas em compile-time com TypeScript discriminated unions.

## Desenvolvimento

### Rodar Testes

```bash
cd backend && npm test
```

Testes cobrem:
- Domínio: máquina de estados (TDD, 20+ casos)
- Aplicação: gerenciador com relógio falso
- Integração: endpoints REST

### Estrutura de Pastas

```
backend/
├── src/
│   ├── dominio/          # Zero dependências externas
│   │   ├── maquina-de-estados.ts
│   │   ├── sessao.ts
│   │   └── erros.ts
│   ├── aplicacao/        # Portas (interfaces) + casos de uso
│   │   ├── gerenciador-de-sessao.ts
│   │   └── portas/
│   ├── infraestrutura/   # Implementações das portas
│   │   ├── spotify-provider.ts
│   │   ├── supabase-sessao-repository.ts
│   │   └── container.ts  (tsyringe)
│   ├── http/             # Express routes + controllers
│   └── shared/           # Utilitários
├── tests/                # Testes (Vitest)
└── package.json

frontend/
├── src/
│   ├── components/       # React components
│   ├── hooks/            # Custom hooks (usePlayerInfo, useSessaoNotifications)
│   ├── services/         # HTTP clients
│   ├── pages/            # Next.js pages
│   └── styles/
└── package.json
```

## Status

| Feature | Status | Fase |
|---------|--------|------|
| Timer Pomodoro | ✅ Completo | MVP |
| Spotify Play/Pause | ✅ Completo | MVP |
| Registro de Sessões | ✅ Completo | MVP |
| Pausa/Retomada | 🚀 Em progresso | Fase 2 |
| Histórico de Contextos | 🚀 Em progresso | Fase 2 |
| Vinil com Faixa Atual | 🚀 Em progresso | Fase 2 |
| Notificações | 🚀 Em progresso | Fase 2 |
| Dashboard de Stats | 📋 Planejado | Fase 3 |
| Perfis de Contexto | 📋 Planejado | Fase 3 |
| Gamificação | 📋 Planejado | Fase 3+ |

## Aprendizados

Este projeto pratica:
- **TypeScript estrito**: discriminated unions, generics, utility types
- **Domain-driven design**: separação clara de responsabilidades
- **TDD**: testes antes de código (Vitest + relógio falso)
- **Máquinas de estado**: transições validadas em compile-time
- **Injeção de dependência**: tsyringe para desacoplamento
- **APIs externas**: autenticação PKCE, rate limiting, backoff exponencial
- **Next.js App Router**: SSR, API routes, streaming
- **Banco de dados**: schema versionado, migrations

## Como Contribuir

Este é um projeto pessoal de aprendizado. Se encontrar bugs ou tiver sugestões, abra uma issue!

## Licença

MIT

---

**focus.fm** — Porque a melhor playlist é aquela que te mantém focado. 🎵✨
