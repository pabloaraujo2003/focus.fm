import { createHash, randomBytes } from 'node:crypto';

export interface ParPkce {
  readonly verifier: string;
  readonly challenge: string;
}

// PKCE (RFC 7636): o verifier nunca sai do backend; só o challenge
// (hash) vai na URL de autorização. Dispensa client secret.
export function gerarParPkce(): ParPkce {
  const verifier = randomBytes(48).toString('base64url'); // 64 chars
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}
