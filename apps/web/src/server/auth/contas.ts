// Casos de uso de conta. Só membros cadastrados jogam: nome, telefone (E.164, único), e-mail (único) e senha.
// O hash (scrypt) roda fora das transações para não segurar travas.
import type { ContaDTO } from '@galinheiro/api-contract';
import type { Rng } from '@galinheiro/game-core';
import type { Banco, Consulta } from '../db/banco';
import { ErroDominio, ehViolacaoUnica } from '../erros';
import { garantirCodigo, vincularIndicacao } from '../dominio/afiliados';
import { criarJogador } from '../dominio/jogo';
import { paraContaDTO, type LinhaContaDTO } from '../dominio/linhas';
import { conferirHash, gerarCodigoRecuperacao, gerarHash, normalizarCodigo } from './senha';

interface LinhaConta extends LinhaContaDTO {
  id: string;
  tipo: string;
  bloqueado_em: Date | null;
  bloqueio_motivo: string | null;
  senha_hash: string | null;
  codigo_recuperacao_hash: string | null;
  sessao_versao: number;
}

/** Dados do cadastro, já validados e normalizados (CadastrarBody). */
export interface DadosCadastro {
  nome: string;
  telefone: string;
  email: string;
  senha: string;
  /** código de convite de quem convidou (opcional) */
  convite?: string;
}

/** Membro completo = conta com e-mail e senha + nome + telefone (contas antigas não passam). */
export const ehMembro = (l: { tipo: string; nome: string | null; telefone: string | null }): boolean =>
  l.tipo === 'email' && !!l.nome && !!l.telefone;

/**
 * Cadastra um membro já com o galinheiro (bônus, ninhos e galinha de boas-vindas). Devolve o código de
 * recuperação (mostrado uma única vez ao jogador).
 */
export async function cadastrarMembro(
  banco: Banco, dados: DadosCadastro, agoraMs: number, rng: Rng,
): Promise<{ contaId: string; versao: number; conta: ContaDTO; codigoRecuperacao: string }> {
  const codigoRecuperacao = gerarCodigoRecuperacao();
  const [senhaHash, codigoHash] = await Promise.all([gerarHash(dados.senha), gerarHash(normalizarCodigo(codigoRecuperacao))]);
  try {
    return await banco.tx(async (c) => {
      // erro claro para o caso comum; os índices únicos seguram a corrida entre dois cadastros simultâneos
      const ja = await c.um<{ email: string | null; telefone: string | null }>(
        'select email, telefone from contas where email = $1 or telefone = $2 limit 1',
        [dados.email, dados.telefone],
      );
      if (ja) throw new ErroDominio(ja.email === dados.email ? 'EMAIL_EM_USO' : 'TELEFONE_EM_USO');
      const l = (await c.um<LinhaConta>(
        `insert into contas (tipo, email, senha_hash, codigo_recuperacao_hash, nome, telefone, criado_em, atualizado_em)
         values ('email', $1, $2, $3, $4, $5, $6, $6) returning *`,
        [dados.email, senhaHash, codigoHash, dados.nome, dados.telefone, new Date(agoraMs)],
      ))!;
      if (dados.convite) await vincularIndicacao(c, l.id, dados.convite, agoraMs);
      await criarJogador(c, l.id, agoraMs, rng);
      await garantirCodigo(c, l.id);
      return { contaId: l.id, versao: l.sessao_versao, conta: paraContaDTO(l), codigoRecuperacao };
    });
  } catch (erro) {
    if (ehViolacaoUnica(erro)) {
      throw new ErroDominio(String((erro as { message?: unknown }).message ?? '').includes('telefone') ? 'TELEFONE_EM_USO' : 'EMAIL_EM_USO');
    }
    throw erro;
  }
}

export async function lerConta(c: Consulta, contaId: string): Promise<ContaDTO | null> {
  const l = await c.um<LinhaConta>('select * from contas where id = $1', [contaId]);
  return l && ehMembro(l) ? paraContaDTO(l) : null;
}

export async function entrarComEmail(banco: Banco, email: string, senha: string): Promise<{ contaId: string; versao: number }> {
  const conta = await banco.um<LinhaConta>('select * from contas where email = $1', [email]);
  const ok = await conferirHash(senha, conta?.senha_hash ?? null);
  if (!conta || !ok) throw new ErroDominio('CREDENCIAIS_INVALIDAS');
  if (!ehMembro(conta)) throw new ErroDominio('CADASTRO_INCOMPLETO');
  if (conta.bloqueado_em) {
    throw new ErroDominio('CONTA_BLOQUEADA', undefined, `Sua conta está bloqueada${conta.bloqueio_motivo ? `: ${conta.bloqueio_motivo}` : '.'}`);
  }
  return { contaId: conta.id, versao: conta.sessao_versao };
}

/** Troca a senha usando o código de recuperação; derruba as outras sessões e gera um código novo. */
export async function redefinirSenha(
  banco: Banco, email: string, codigo: string, novaSenha: string,
): Promise<{ contaId: string; versao: number; codigoRecuperacao: string }> {
  const conta = await banco.um<LinhaConta>('select * from contas where email = $1', [email]);
  const ok = await conferirHash(normalizarCodigo(codigo), conta?.codigo_recuperacao_hash ?? null);
  if (!conta || !ok) throw new ErroDominio('CODIGO_INVALIDO');
  if (!ehMembro(conta)) throw new ErroDominio('CADASTRO_INCOMPLETO');
  const codigoRecuperacao = gerarCodigoRecuperacao();
  const [senhaHash, codigoHash] = await Promise.all([gerarHash(novaSenha), gerarHash(normalizarCodigo(codigoRecuperacao))]);
  const l = (await banco.um<{ sessao_versao: number }>(
    `update contas set senha_hash = $2, codigo_recuperacao_hash = $3, sessao_versao = sessao_versao + 1, atualizado_em = now()
      where id = $1 returning sessao_versao`,
    [conta.id, senhaHash, codigoHash],
  ))!;
  return { contaId: conta.id, versao: l.sessao_versao, codigoRecuperacao };
}

export async function excluirConta(c: Consulta, contaId: string): Promise<void> {
  await c.q('delete from contas where id = $1', [contaId]);
}
