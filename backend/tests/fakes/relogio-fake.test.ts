import { describe, expect, it } from 'vitest';
import { RelogioFake } from './relogio-fake';

describe('RelogioFake', () => {
  it('dispara callbacks na ordem, atualizando agora()', async () => {
    const relogio = new RelogioFake();
    const disparos: string[] = [];
    relogio.agendar(2000, () => disparos.push(`b@${relogio.agora().getTime()}`));
    relogio.agendar(1000, () => disparos.push(`a@${relogio.agora().getTime()}`));
    await relogio.avancar(3000);
    expect(disparos).toEqual(['a@1000', 'b@2000']);
    expect(relogio.agora().getTime()).toBe(3000);
  });

  it('callback agendado durante avancar também dispara se couber na janela', async () => {
    const relogio = new RelogioFake();
    const disparos: number[] = [];
    relogio.agendar(1000, () => {
      disparos.push(1);
      relogio.agendar(1000, () => disparos.push(2));
    });
    await relogio.avancar(2500);
    expect(disparos).toEqual([1, 2]);
  });

  it('cancelamento impede o disparo', async () => {
    const relogio = new RelogioFake();
    const disparos: number[] = [];
    const cancelar = relogio.agendar(1000, () => disparos.push(1));
    cancelar();
    await relogio.avancar(2000);
    expect(disparos).toEqual([]);
  });
});
