import express, { type Express } from 'express';
import type { DependencyContainer } from 'tsyringe';
import type { GerenciadorDeSessao } from '../aplicacao/gerenciador-de-sessao';
import type { MusicProvider } from '../aplicacao/portas/music-provider';
import { ValidationError } from '../dominio/erros/validation-error';
import type { SpotifyAuth } from '../infraestrutura/spotify/spotify-auth';
import { TOKENS } from '../infraestrutura/tokens';
import { middlewareErro } from './middleware-erro';

export function criarApp(container: DependencyContainer): Express {
  const app = express();
  app.use(express.json());

  const gerenciador = (): GerenciadorDeSessao => container.resolve(TOKENS.GerenciadorDeSessao);
  const auth = (): SpotifyAuth => container.resolve(TOKENS.SpotifyAuth);
  const music = (): MusicProvider => container.resolve(TOKENS.MusicProvider);

  app.post('/sessao', async (req, res) => {
    const body = req.body as CorpoIniciarSessao | undefined;
    const contexto = String(body?.contexto ?? '');
    await gerenciador().iniciar(contexto, {
      foco: normalizarPlaylist(body?.playlistFoco, 'playlistFoco'),
      pausa: normalizarPlaylist(body?.playlistPausa, 'playlistPausa'),
    });
    res.status(201).json(gerenciador().obterStatus());
  });

  app.get('/sessao', (_req, res) => {
    res.json(gerenciador().obterStatus());
  });

  app.post('/sessao/finalizar', async (_req, res) => {
    const sessao = await gerenciador().finalizar();
    res.json({
      id: sessao.id,
      contexto: sessao.contexto,
      ciclosCompletados: sessao.ciclosCompletados,
      duracaoTotalSeg: sessao.duracaoTotalSeg,
      iniciadaEm: sessao.iniciadaEm,
      finalizadaEm: sessao.finalizadaEm,
    });
  });

  app.get('/auth/spotify', (_req, res) => {
    res.redirect(auth().urlDeAutorizacao());
  });

  app.get('/spotify/playlists', async (_req, res) => {
    res.json({ playlists: await music().listarPlaylists() });
  });

  app.get('/auth/spotify/callback', async (req, res) => {
    const code = String(req.query.code ?? '').trim();
    if (code.length === 0) {
      throw new ValidationError('parametro code ausente no callback do Spotify');
    }
    await auth().trocarCodigo(code);
    res.send('Spotify autorizado. Pode fechar esta aba e voltar ao pomodoro.');
  });

  app.use(middlewareErro);
  return app;
}

interface CorpoIniciarSessao {
  readonly contexto?: unknown;
  readonly playlistFoco?: unknown;
  readonly playlistPausa?: unknown;
}

function normalizarPlaylist(valor: unknown, campo: string): string {
  if (typeof valor !== 'string') {
    throw new ValidationError(`${campo} é obrigatório`);
  }
  const texto = valor.trim();
  const uri = /^spotify:playlist:([A-Za-z0-9]+)$/.exec(texto);
  if (uri) return texto;
  const url = /^https:\/\/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/.exec(texto);
  if (url?.[1] !== undefined) return `spotify:playlist:${url[1]}`;
  throw new ValidationError(`${campo} inválida: use uma playlist do Spotify`);
}
