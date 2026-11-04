import { RenameBody } from '@galinheiro/api-contract';
import { z } from 'zod';
import { detalheEntidade } from '@/server/dominio/colecao';
import { renomear } from '@/server/dominio/jogo';
import { ErroDominio } from '@/server/erros';
import { rota } from '@/server/http/rota';

const idValido = (id: string | undefined): string => {
  const r = z.uuid().safeParse(id);
  if (!r.success) throw new ErroDominio('ENTIDADE_NAO_ENCONTRADA', { entityId: id ?? null });
  return r.data;
};

export const GET = rota({ nome: 'entity', limite: 60 }, async ({ c, contaId, params, agoraMs }) => ({
  data: await detalheEntidade(c, contaId, idValido(params.id), agoraMs),
}));

export const PATCH = rota(
  { nome: 'entity.rename', limite: 20, idempotente: true, corpo: RenameBody },
  async ({ c, contaId, params, corpo, agoraMs }) => {
    const r = await renomear(c, contaId, idValido(params.id), corpo.nome, agoraMs);
    return { data: r.data, stateVersion: r.versao };
  },
);
