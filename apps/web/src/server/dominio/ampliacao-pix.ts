// Cobrança PIX da ampliação. O galinheiro só ganha ninhos depois que a gateway confirma o pagamento.
import { randomUUID } from 'node:crypto';
import { toDataURL } from 'qrcode';
import type { CobrancaRoletaDTO, StatusCobrancaRoleta } from '@galinheiro/api-contract';
import { CONFIG } from '@galinheiro/game-core';
import type { Consulta } from '../db/banco';
import { ErroDominio } from '../erros';
import { consultarStatusDaGateway, criarCobrancaDaGateway } from '../pagamentos/gateway';
import type { StatusPixRemoto } from '../pagamentos/lofypay';
import { VALIDADE_USDT_MS, dadosCobrancaUsdt, meioDoJogador } from '../pagamentos/usdt';
import { exigirJogador } from './repo';

const VALIDADE_MS = 15 * 60 * 1000;
const TABELA = 'ampliacao_pix';
const COLS = `id, centavos, status, copia_cola, qr_data_url, expira_em, id_transacao, meio, usdt_x100, usdt_rede`;

interface LinhaPix {
  id: string;
  centavos: number;
  status: StatusCobrancaRoleta;
  copia_cola: string;
  qr_data_url: string;
  expira_em: Date | string;
  id_transacao: string;
  meio?: string | null;
  usdt_x100?: unknown;
  usdt_rede?: string | null;
}

const paraDto = (l: LinhaPix): CobrancaRoletaDTO => ({
  id: l.id,
  centavos: l.centavos,
  status: l.status,
  copiaCola: l.copia_cola,
  qrDataUrl: l.qr_data_url,
  expiraEm: new Date(l.expira_em).toISOString(),
  meio: l.meio === 'usdt' ? 'usdt' : 'pix',
  rede: l.usdt_rede ?? null,
  valorUsdtX100: l.usdt_x100 == null ? null : Number(l.usdt_x100),
});

async function qrDoCodigo(copiaCola: string, base64: string | null): Promise<string> {
  if (base64) return base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
  return toDataURL(copiaCola, { margin: 1, width: 320, errorCorrectionLevel: 'M' });
}

/** Reaproveita um PIX já pago ou ainda válido. Senão cria uma cobrança de R$ 25. */
export async function abrirCobrancaAmpliacao(
  c: Consulta, contaId: string, agoraMs: number, idempotencia: string,
): Promise<CobrancaRoletaDTO> {
  const jogador = await exigirJogador(c, contaId);
  if (jogador.nivel_galinheiro >= CONFIG.galinheiro.nivelMax) {
    throw new ErroDominio('GALINHEIRO_NO_MAXIMO', { nivel: jogador.nivel_galinheiro });
  }
  const agora = new Date(agoraMs);
  const custo = CONFIG.galinheiro.custoUpgradeX100;
  const meio = await meioDoJogador(c, contaId);

  const pago = await c.um<LinhaPix>(
    `select ${COLS}
       from ${TABELA}
      where player_id = $1 and status = 'pago' and centavos = $2 and meio = $3
      order by criado_em
      limit 1
      for update`,
    [contaId, custo, meio],
  );
  if (pago) return paraDto(pago);

  await c.q(
    `update ${TABELA} set status = 'expirado', atualizado_em = $2
      where player_id = $1 and status = 'aguardando' and expira_em <= $2`,
    [contaId, agora],
  );
  const aberta = await c.um<LinhaPix>(
    `select ${COLS}
       from ${TABELA}
      where player_id = $1 and status = 'aguardando' and centavos = $2 and meio = $4 and expira_em > $3
      order by criado_em desc
      limit 1
      for update`,
    [contaId, custo, agora, meio],
  );
  if (aberta) return paraDto(aberta);

  if (meio === 'usdt') {
    const dados = await dadosCobrancaUsdt(c, custo);
    const id = randomUUID();
    const expira = new Date(agoraMs + VALIDADE_USDT_MS);
    const linha = await c.um<LinhaPix>(
      `insert into ${TABELA}
         (id, player_id, centavos, status, id_transacao, copia_cola, qr_data_url, idempotencia, criado_em, atualizado_em, expira_em, provedor, meio, usdt_x100, usdt_rede)
       values ($1::uuid, $2, $3, 'aguardando', $1::text, $4, $5, $6, $7, $7, $8, 'usdt', 'usdt', $9, $10)
       returning ${COLS}`,
      [id, contaId, custo, dados.endereco, dados.qr, idempotencia, agora, expira, dados.usdtX100, dados.rede],
    );
    return paraDto(linha!);
  }

  const conta = await c.um<{ nome: string | null; email: string | null }>(
    'select nome, email from contas where id = $1',
    [contaId],
  );
  const id = randomUUID();
  const criada = await criarCobrancaDaGateway(c, {
    centavos: custo,
    idempotencia,
    referencia: id,
    nome: conta?.nome?.trim() || 'Jogador',
    email: conta?.email ?? null,
    descricao: 'Ampliação do galinheiro',
  });
  const expira = new Date(agoraMs + VALIDADE_MS);
  const qr = await qrDoCodigo(criada.copiaCola, criada.qrBase64);
  const linha = await c.um<LinhaPix>(
    `insert into ${TABELA}
       (id, player_id, centavos, status, id_transacao, copia_cola, qr_data_url, idempotencia, criado_em, atualizado_em, expira_em, provedor, meio)
     values ($1, $2, $3, 'aguardando', $4, $5, $6, $7, $8, $8, $9, $10, 'pix')
     returning ${COLS}`,
    [id, contaId, custo, criada.idTransacao, criada.copiaCola, qr, idempotencia, agora, expira, criada.provedor],
  );
  return paraDto(linha!);
}

function statusLocal(remoto: StatusPixRemoto): StatusCobrancaRoleta | null {
  if (remoto === 'pago' || remoto === 'expirado' || remoto === 'falhou') return remoto;
  return null;
}

/** Consulta a gateway que criou a cobrança e grava pago/expirado/falhou. */
export async function atualizarCobrancaAmpliacao(
  c: Consulta, contaId: string, id: string, agoraMs: number,
): Promise<CobrancaRoletaDTO> {
  await exigirJogador(c, contaId);
  const linha = await c.um<LinhaPix & { provedor: string }>(
    `select id, centavos, status, copia_cola, qr_data_url, expira_em, id_transacao, provedor
       from ${TABELA} where id = $1 and player_id = $2 for update`,
    [id, contaId],
  );
  if (!linha) throw new ErroDominio('NAO_ENCONTRADO');
  if (linha.status !== 'aguardando') return paraDto(linha);

  const agora = new Date(agoraMs);
  if (linha.provedor === 'usdt') {
    if (new Date(linha.expira_em).getTime() > agoraMs) return paraDto(linha);
    const expirada = await c.um<LinhaPix>(
      `update ${TABELA} set status = 'expirado', atualizado_em = $2 where id = $1
       returning ${COLS}`,
      [linha.id, agora],
    );
    return paraDto(expirada!);
  }
  if (new Date(linha.expira_em).getTime() <= agoraMs) {
    const expirada = await c.um<LinhaPix>(
      `update ${TABELA} set status = 'expirado', atualizado_em = $2 where id = $1
       returning ${COLS}`,
      [linha.id, agora],
    );
    return paraDto(expirada!);
  }

  const remoto = await consultarStatusDaGateway(linha.provedor, linha.id_transacao);
  const proximo = statusLocal(remoto);
  if (!proximo) return paraDto(linha);
  const atualizada = await c.um<LinhaPix>(
    `update ${TABELA} set status = $2, atualizado_em = $3 where id = $1
     returning ${COLS}`,
    [linha.id, proximo, agora],
  );
  return paraDto(atualizada!);
}
