import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface TokensPersistidos {
  accessToken: string;
  refreshToken: string;
  expiraEmMs: number; // epoch ms
}

interface ArquivoTokens {
  tokens?: TokensPersistidos;
  pkceVerifierPendente?: string;
}

// Persistência síncrona e mínima: é 1 arquivo local de uso pessoal.
export class ArmazemTokens {
  constructor(private readonly caminho: string) {}

  ler(): TokensPersistidos | null {
    const arquivo = this.lerArquivoBruto();
    if (ehFormatoLegado(arquivo)) return arquivo;
    if (arquivo.tokens !== undefined) return arquivo.tokens;
    return null;
  }

  gravar(tokens: TokensPersistidos): void {
    const arquivo = this.lerArquivoAtual();
    this.gravarArquivo({ ...arquivo, tokens });
  }

  lerPkceVerifierPendente(): string | null {
    return this.lerArquivoAtual().pkceVerifierPendente ?? null;
  }

  gravarPkceVerifierPendente(verifier: string): void {
    const arquivo = this.lerArquivoAtual();
    this.gravarArquivo({ ...arquivo, pkceVerifierPendente: verifier });
  }

  limparPkceVerifierPendente(): void {
    const arquivo = this.lerArquivoAtual();
    delete arquivo.pkceVerifierPendente;
    this.gravarArquivo(arquivo);
  }

  private lerArquivoAtual(): ArquivoTokens {
    const arquivo = this.lerArquivoBruto();
    if (ehFormatoLegado(arquivo)) return { tokens: arquivo };
    return arquivo;
  }

  private lerArquivoBruto(): ArquivoTokens | TokensPersistidos {
    if (!existsSync(this.caminho)) return {};
    return JSON.parse(readFileSync(this.caminho, 'utf8')) as ArquivoTokens | TokensPersistidos;
  }

  private gravarArquivo(arquivo: ArquivoTokens): void {
    mkdirSync(dirname(this.caminho), { recursive: true });
    writeFileSync(this.caminho, JSON.stringify(arquivo, null, 2), { mode: 0o600 });
  }
}

function ehFormatoLegado(arquivo: ArquivoTokens | TokensPersistidos): arquivo is TokensPersistidos {
  return (
    'accessToken' in arquivo &&
    'refreshToken' in arquivo &&
    'expiraEmMs' in arquivo
  );
}
