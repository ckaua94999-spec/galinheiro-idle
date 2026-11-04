// Validação de parâmetros de rota ([id]): id fora do formato de uuid vira 404 (não chega ao banco).
import { ErroDominio } from '../erros';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function exigirUuid(id: string | undefined, mensagem = 'Não encontrado.'): string {
  if (!id || !UUID.test(id)) throw new ErroDominio('NAO_ENCONTRADO', undefined, mensagem);
  return id;
}
