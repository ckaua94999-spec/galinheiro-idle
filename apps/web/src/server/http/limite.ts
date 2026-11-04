// Limite de requisições em janela deslizante de 60 s, em memória (por instância).
// Em produção com várias instâncias serverless, trocar por um armazenamento compartilhado (ex.: Redis).
const CHAVE = Symbol.for('galinheiro.limites');
type GlobalComLimites = typeof globalThis & { [CHAVE]?: Map<string, number[]> };

function janelas(): Map<string, number[]> {
  const g = globalThis as GlobalComLimites;
  g[CHAVE] ??= new Map();
  return g[CHAVE];
}

export function verificarLimite(chave: string, maxPorMinuto: number): { ok: boolean; retryAfterS: number } {
  const mapa = janelas();
  const agora = Date.now();
  const inicio = agora - 60_000;
  const marcas = (mapa.get(chave) ?? []).filter((t) => t > inicio);
  if (marcas.length >= maxPorMinuto) {
    mapa.set(chave, marcas);
    return { ok: false, retryAfterS: Math.max(1, Math.ceil((marcas[0]! + 60_000 - agora) / 1000)) };
  }
  marcas.push(agora);
  mapa.set(chave, marcas);
  if (mapa.size > 20_000) {
    for (const [k, v] of mapa) if (!v.some((t) => t > inicio)) mapa.delete(k);
  }
  return { ok: true, retryAfterS: 0 };
}
