// randomUUID só existe em contexto seguro. Em HTTP a Idempotency-Key precisa nascer de getRandomValues.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chamar, gerarChaveIdempotencia } from '@/cliente/api';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function cryptoSemRandomUUID(): Crypto {
  return { getRandomValues: crypto.getRandomValues.bind(crypto) } as Crypto;
}

describe('gerarChaveIdempotencia', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('usa randomUUID quando a função existe', () => {
    expect(gerarChaveIdempotencia()).toMatch(UUID);
  });

  it('monta um UUID v4 quando randomUUID não é função', () => {
    const original = crypto.getRandomValues.bind(crypto);
    const getRandomValues = vi.fn((destino: ArrayBufferView) => original(destino as NodeJS.ArrayBufferView));
    vi.stubGlobal('crypto', { getRandomValues });
    expect(gerarChaveIdempotencia()).toMatch(UUID);
    expect(getRandomValues).toHaveBeenCalledOnce();
  });

  it('envia a chave mesmo sem randomUUID e reaproveita nas repetições', async () => {
    vi.stubGlobal('crypto', cryptoSemRandomUUID());
    let vezes = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        vezes += 1;
        if (vezes === 1) return Response.json({ ok: false, error: { code: 'ERRO_INTERNO', message: 'falhou' }, serverTime: new Date().toISOString() }, { status: 500 });
        return Response.json({ ok: true, data: { ok: true }, serverTime: new Date().toISOString() });
      }),
    );

    await chamar('POST', '/spin', { idempotente: true, corpo: {} });

    const chamadas = vi.mocked(fetch).mock.calls;
    const chaves = chamadas.map(([, init]) => (init as RequestInit).headers as Record<string, string>).map((h) => h['Idempotency-Key']);
    expect(chaves).toHaveLength(2);
    expect(chaves[0]).toMatch(UUID);
    expect(chaves[1]).toBe(chaves[0]);
  });
});
