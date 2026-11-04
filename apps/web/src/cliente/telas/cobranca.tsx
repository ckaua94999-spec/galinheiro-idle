'use client';

import type { CobrancaRoletaDTO } from '@galinheiro/api-contract';
import { moedas } from '../util';

/** Texto, QR e código de uma cobrança PIX ou USDT. */
export function ConteudoCobranca({ cobranca, custoX100, depois }: {
  cobranca: CobrancaRoletaDTO | null;
  custoX100: number;
  /** O que acontece quando o pagamento entra. */
  depois: string;
}) {
  const usdt = cobranca?.meio === 'usdt';
  return (
    <>
      <p className="text-sm font-semibold text-texto-suave">
        {usdt ? (
          <>
            Envie <span className="numeros">{moedas(cobranca?.valorUsdtX100 ?? 0)} USDT</span> na rede {cobranca?.rede}. {depois} quando a equipe confirmar. Equivale a R$ {moedas(cobranca?.centavos ?? custoX100)}.
          </>
        ) : (
          <>
            R$ {moedas(cobranca?.centavos ?? custoX100)} no PIX. {depois} assim que o pagamento cair.
          </>
        )}
      </p>
      {cobranca?.qrDataUrl && (
        <img className="roleta-pix-qr" src={cobranca.qrDataUrl} alt={usdt ? 'QR Code do endereço USDT' : 'QR Code do PIX'} />
      )}
      <p className="roleta-pix-codigo" aria-label={usdt ? 'Endereço USDT' : 'Código PIX copia e cola'}>{cobranca?.copiaCola}</p>
    </>
  );
}

export function tituloCobranca(meio: string | undefined, acao: 'girar' | 'ampliar'): string {
  if (meio === 'usdt') return acao === 'girar' ? 'Pague em USDT para girar' : 'Pague em USDT para ampliar';
  return acao === 'girar' ? 'Pague o PIX para girar' : 'Pague o PIX para ampliar';
}
