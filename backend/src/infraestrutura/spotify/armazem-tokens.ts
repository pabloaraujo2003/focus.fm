import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface TokensPersistidos {
  accessToken: string;
  refreshToken: string;
  expiraEmMs: number; // epoch ms
}

// Persistência síncrona e mínima: é 1 arquivo local de uso pessoal.
export class ArmazemTokens {
  constructor(private readonly caminho: string) {}

  ler(): TokensPersistidos | null {
    if (!existsSync(this.caminho)) return null;
    return JSON.parse(readFileSync(this.caminho, 'utf8')) as TokensPersistidos;
  }

  gravar(tokens: TokensPersistidos): void {
    mkdirSync(dirname(this.caminho), { recursive: true });
    writeFileSync(this.caminho, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  }
}
