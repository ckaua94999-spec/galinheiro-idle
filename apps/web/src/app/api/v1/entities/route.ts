import { EntitiesQuery } from '@galinheiro/api-contract';
import { listarEntidades } from '@/server/dominio/colecao';
import { rota } from '@/server/http/rota';

export const GET = rota({ nome: 'entities', limite: 60, consulta: EntitiesQuery }, async ({ c, contaId, consulta, agoraMs }) => ({
  data: await listarEntidades(c, contaId, consulta, agoraMs),
}));
