import { verificarConvite } from '@/server/dominio/afiliados';
import { rota } from '@/server/http/rota';

/** Público (tela de cadastro): o código vale e de quem é (só o nome curto). Limite baixo contra varredura. */
export const GET = rota({ nome: 'convites.verificar', autenticado: false, limite: 20 }, async ({ c, params }) => ({
  data: await verificarConvite(c, params.codigo ?? ''),
}));
