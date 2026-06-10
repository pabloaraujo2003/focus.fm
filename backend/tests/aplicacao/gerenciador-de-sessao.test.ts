import { beforeEach, describe, expect, it } from 'vitest';
import { GerenciadorDeSessao } from '../../src/aplicacao/gerenciador-de-sessao';
import { resolverConfiguracao } from '../../src/dominio/config/configuracao';
import { TransicaoInvalidaError } from '../../src/dominio/erros/transicao-invalida-error';
import { MusicProviderFake } from '../fakes/music-provider-fake';
import { RelogioFake } from '../fakes/relogio-fake';
import { SessaoRepositoryFake } from '../fakes/sessao-repository-fake';

const MIN = 60_000;
const playlists = { foco: 'spotify:playlist:FOCO', pausa: 'spotify:playlist:PAUSA' };

describe('GerenciadorDeSessao', () => {
  let relogio: RelogioFake;
  let music: MusicProviderFake;
  let repositorio: SessaoRepositoryFake;
  let gerenciador: GerenciadorDeSessao;

  beforeEach(() => {
    relogio = new RelogioFake();
    music = new MusicProviderFake();
    repositorio = new SessaoRepositoryFake();
    gerenciador = new GerenciadorDeSessao(
      resolverConfiguracao(), relogio, music, repositorio,
    );
  });

  it('iniciar: entra em foco, toca playlist de foco e agenda o fim', async () => {
    await gerenciador.iniciar('estudar generics', playlists);
    const status = gerenciador.obterStatus();
    expect(status.snapshot.estado).toBe('focando');
    expect(music.chamadas).toEqual(['tocar:spotify:playlist:FOCO']);
    expect(status.terminaEm?.getTime()).toBe(25 * MIN);
  });

  it('ao fim do foco entra em pausa_curta e troca a playlist', async () => {
    await gerenciador.iniciar('x', playlists);
    await relogio.avancar(25 * MIN);
    const status = gerenciador.obterStatus();
    expect(status.snapshot.estado).toBe('pausa_curta');
    expect(status.snapshot.ciclosCompletados).toBe(1);
    expect(music.chamadas).toEqual(['tocar:spotify:playlist:FOCO', 'tocar:spotify:playlist:PAUSA']);
    expect(status.terminaEm?.getTime()).toBe(30 * MIN);
  });

  it('apos 4 focos completos entra em pausa_longa', async () => {
    await gerenciador.iniciar('x', playlists);
    // 3 ciclos completos (foco 25 + pausa curta 5) + 4o foco 25
    await relogio.avancar((3 * 30 + 25) * MIN);
    const status = gerenciador.obterStatus();
    expect(status.snapshot.estado).toBe('pausa_longa');
    expect(status.snapshot.ciclosCompletados).toBe(4);
    expect(status.terminaEm?.getTime()).toBe((3 * 30 + 25 + 15) * MIN);
  });

  it('finalizar: grava sessão com ciclos e duração, pausa música, volta a idle', async () => {
    await gerenciador.iniciar('estudar generics', playlists);
    await relogio.avancar(55 * MIN); // 25 foco + 5 pausa + 25 foco = 2 ciclos
    const sessao = await gerenciador.finalizar();
    expect(sessao.ciclosCompletados).toBe(2);
    expect(sessao.duracaoTotalSeg).toBe(55 * 60);
    expect(sessao.contexto).toBe('estudar generics');
    expect(repositorio.salvas).toEqual([sessao]);
    expect(music.chamadas.at(-1)).toBe('pausar');
    expect(gerenciador.obterStatus()).toEqual({
      snapshot: { estado: 'idle', ciclosCompletados: 0, contexto: null },
      terminaEm: null,
    });
  });

  it('finalizar cancela o timer pendente (nada dispara depois)', async () => {
    await gerenciador.iniciar('x', playlists);
    await gerenciador.finalizar();
    const chamadasAntes = music.chamadas.length;
    await relogio.avancar(120 * MIN);
    expect(music.chamadas.length).toBe(chamadasAntes);
  });

  it('finalizar limpa a sessão e pausa música mesmo se o repositório falhar', async () => {
    repositorio.falharAoSalvar = true;

    await gerenciador.iniciar('x', playlists);

    await expect(gerenciador.finalizar()).rejects.toThrow('falha simulada');

    expect(music.chamadas.at(-1)).toBe('pausar');
    expect(gerenciador.obterStatus()).toEqual({
      snapshot: { estado: 'idle', ciclosCompletados: 0, contexto: null },
      terminaEm: null,
    });
  });

  it('iniciar com sessão ativa e finalizar sem sessão lançam TransicaoInvalidaError', async () => {
    await expect(gerenciador.finalizar()).rejects.toThrow(TransicaoInvalidaError);
    await gerenciador.iniciar('x', playlists);
    await expect(gerenciador.iniciar('y', playlists)).rejects.toThrow(TransicaoInvalidaError);
  });

  it('iniciar restaura idle se o provider de música falhar', async () => {
    const musicComFalha = new MusicProviderFake();
    musicComFalha.falharAoTocar = true;
    gerenciador = new GerenciadorDeSessao(
      resolverConfiguracao(), relogio, musicComFalha, repositorio,
    );

    await expect(gerenciador.iniciar('x', playlists)).rejects.toThrow('falha simulada');

    expect(gerenciador.obterStatus()).toEqual({
      snapshot: { estado: 'idle', ciclosCompletados: 0, contexto: null },
      terminaEm: null,
    });
  });
});
