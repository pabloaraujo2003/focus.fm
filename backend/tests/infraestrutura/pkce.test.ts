import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { gerarParPkce } from '../../src/infraestrutura/spotify/pkce';

describe('gerarParPkce', () => {
  it('verifier tem 43-128 chars no alfabeto permitido', () => {
    const { verifier } = gerarParPkce();
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/);
  });

  it('challenge é base64url(sha256(verifier)) sem padding', () => {
    const { verifier, challenge } = gerarParPkce();
    const esperado = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(esperado);
    expect(challenge).not.toContain('=');
  });

  it('cada chamada gera um par diferente', () => {
    expect(gerarParPkce().verifier).not.toBe(gerarParPkce().verifier);
  });
});
