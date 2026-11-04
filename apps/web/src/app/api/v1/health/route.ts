import { CONFIG_VERSAO } from '@galinheiro/game-core';
import { rota } from '@/server/http/rota';

export const GET = rota({ nome: 'health', autenticado: false, limite: 120, transacao: false }, async ({ banco }) => {
  await banco.q('select 1');
  return { data: { status: 'ok', versao: '1.0.0', configVersao: CONFIG_VERSAO, banco: banco.motor } };
});
