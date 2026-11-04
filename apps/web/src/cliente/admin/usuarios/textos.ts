// Textos legíveis da ficha do membro: extrato (tipo + detalhe), ações da auditoria e etapas do tutorial.
import { formatarTelefone, type AdminAcaoDTO, type TransacaoDTO } from '@galinheiro/api-contract';
import { CONFIG, NOME_RARIDADE, NOME_TIPO, tipoDoItem, type Item, type Raridade, type Tipo } from '@galinheiro/game-core';
import { fmt } from '../ui';

const texto = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const numero = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const ehItem = (v: unknown): v is Item => typeof v === 'string' && /^ovo_(galinha|pato|ganso|avestruz)$/.test(v);
const ehTipo = (v: unknown): v is Tipo => v === 'galinha' || v === 'pato' || v === 'ganso' || v === 'avestruz';

/** "ovos de pato" */
export const nomeOvos = (item: Item, n = 2): string => `${n === 1 ? 'ovo' : 'ovos'} de ${NOME_TIPO[tipoDoItem(item)].toLowerCase()}`;

// ---------------------------------------------------------------- extrato

export type TipoTransacao = TransacaoDTO['tipo'];

export const NOME_TRANSACAO: Record<TipoTransacao, string> = {
  BONUS_INICIAL: 'Bônus de boas-vindas',
  VENDA_OVOS: 'Venda de ovos',
  GIRO_ROLETA: 'Giro na roleta',
  UPGRADE_NINHO: 'Ampliação do galinheiro',
  AJUSTE_SUPORTE: 'Ajuste da equipe',
  COMISSAO_INDICACAO: 'Comissão de indicação',
  COMPRA_TICKET: 'Compra de tickets',
  SAQUE: 'Saque PIX',
  SAQUE_ESTORNO: 'Saque devolvido',
};

export function descreverTransacao(t: TransacaoDTO): { titulo: string; detalhe?: string } {
  const d = t.detalhes ?? {};
  switch (t.tipo) {
    case 'VENDA_OVOS': {
      const itens = (typeof d.itens === 'object' && d.itens ? d.itens : {}) as Record<string, unknown>;
      const partes = Object.entries(itens)
        .filter((par): par is [Item, number] => ehItem(par[0]) && typeof par[1] === 'number' && par[1] > 0)
        .map(([item, n]) => `${fmt.int(n)} ${NOME_TIPO[tipoDoItem(item)].toLowerCase()}`);
      const total = Object.values(itens).reduce<number>((s, n) => s + (typeof n === 'number' ? n : 0), 0);
      return { titulo: total ? `Venda de ${fmt.int(total)} ${total === 1 ? 'ovo' : 'ovos'}` : NOME_TRANSACAO.VENDA_OVOS, detalhe: partes.join(' · ') || undefined };
    }
    case 'GIRO_ROLETA': {
      const tipo = ehTipo(d.tipo) ? d.tipo : undefined;
      const raridade = texto(d.raridade) as Raridade | undefined;
      return {
        titulo: NOME_TRANSACAO.GIRO_ROLETA,
        detalhe: tipo ? `Saiu ${NOME_TIPO[tipo]}${raridade && NOME_RARIDADE[raridade] ? ` (${NOME_RARIDADE[raridade]})` : ''}` : undefined,
      };
    }
    case 'UPGRADE_NINHO': {
      const para = numero(d.nivelPara);
      const de = numero(d.nivelDe);
      return { titulo: NOME_TRANSACAO.UPGRADE_NINHO, detalhe: para ? `Nível ${de ?? para - 1} → ${para}` : undefined };
    }
    case 'AJUSTE_SUPORTE':
      return { titulo: NOME_TRANSACAO.AJUSTE_SUPORTE, detalhe: texto(d.motivo) };
    case 'BONUS_INICIAL':
      return { titulo: NOME_TRANSACAO.BONUS_INICIAL };
    case 'COMPRA_TICKET': {
      const q = numero(d.quantidade);
      return { titulo: NOME_TRANSACAO.COMPRA_TICKET, detalhe: q ? `${q} ${q === 1 ? 'ticket' : 'tickets'} do Intercâmbio` : undefined };
    }
    case 'COMISSAO_INDICACAO': {
      const nivel = numero(d.nivel);
      const origem = texto(d.origem);
      return { titulo: NOME_TRANSACAO.COMISSAO_INDICACAO, detalhe: [nivel ? `Nível ${nivel}` : null, origem ? `venda de ${origem}` : null].filter(Boolean).join(' · ') || undefined };
    }
    case 'SAQUE':
      return { titulo: NOME_TRANSACAO.SAQUE, detalhe: texto(d.cpf) };
    case 'SAQUE_ESTORNO':
      return { titulo: NOME_TRANSACAO.SAQUE_ESTORNO };
    default:
      return { titulo: 'Movimentação' };
  }
}

// ---------------------------------------------------------------- auditoria

export type GrupoAcao = 'perfil' | 'seguranca' | 'bloqueio' | 'economia' | 'galinheiro' | 'atendimento' | 'exclusao' | 'outro';

const PAPEL: Record<string, string> = { admin: 'Administrador', jogador: 'Jogador' };
const CAMPO: Record<string, string> = { nome: 'Nome', email: 'E-mail', telefone: 'Telefone', papel: 'Papel' };

function valorCampo(campo: string, v: unknown): string {
  if (typeof v !== 'string' || !v) return '—';
  if (campo === 'telefone') return formatarTelefone(v) || v;
  if (campo === 'papel') return PAPEL[v] ?? v;
  return v;
}

/** Ação do painel em português: título, detalhe resumido e grupo (ícone/cor). */
export function descreverAcao(a: AdminAcaoDTO): { titulo: string; detalhe?: string; grupo: GrupoAcao } {
  const d = a.detalhes ?? {};
  const motivo = texto(d.motivo);
  switch (a.acao) {
    case 'editar_usuario': {
      const mudancas = Object.entries(d)
        .filter(([campo]) => campo in CAMPO)
        .map(([campo, v]) => {
          const m = (typeof v === 'object' && v ? v : {}) as { de?: unknown; para?: unknown };
          return `${CAMPO[campo]}: ${valorCampo(campo, m.de)} → ${valorCampo(campo, m.para)}`;
        });
      const virouAdmin = (d.papel as { para?: unknown } | undefined)?.para;
      return {
        titulo: virouAdmin === 'admin' ? 'Deu acesso de administrador' : virouAdmin === 'jogador' ? 'Tirou o acesso de administrador' : 'Editou o perfil',
        detalhe: mudancas.join(' · ') || undefined,
        grupo: 'perfil',
      };
    }
    case 'bloquear':
      return { titulo: 'Bloqueou a conta', detalhe: motivo, grupo: 'bloqueio' };
    case 'desbloquear':
      return { titulo: 'Desbloqueou a conta', grupo: 'seguranca' };
    case 'encerrar_sessoes':
      return { titulo: 'Encerrou todas as sessões', grupo: 'seguranca' };
    case 'novo_codigo_recuperacao':
      return { titulo: 'Gerou um novo código de recuperação', grupo: 'seguranca' };
    case 'ajustar_saldo': {
      const v = numero(d.valorX100) ?? 0;
      const apos = numero(d.saldoAposX100);
      return {
        titulo: `${v >= 0 ? 'Creditou' : 'Debitou'} ${fmt.moedas(Math.abs(v))} moedas`,
        detalhe: [motivo, apos !== undefined ? `saldo depois: ${fmt.moedas(apos)}` : undefined].filter(Boolean).join(' · ') || undefined,
        grupo: 'economia',
      };
    }
    case 'ajustar_ovos': {
      const q = numero(d.quantidade) ?? 0;
      const item = ehItem(d.item) ? d.item : null;
      const nome = item ? nomeOvos(item, Math.abs(q)) : Math.abs(q) === 1 ? 'ovo' : 'ovos';
      return { titulo: `${q >= 0 ? 'Deu' : 'Tirou'} ${fmt.int(Math.abs(q))} ${nome}`, detalhe: motivo, grupo: 'economia' };
    }
    case 'dar_animal': {
      const tipo = ehTipo(d.tipo) ? NOME_TIPO[d.tipo] : 'animal';
      const nome = texto(d.nome);
      const slot = numero(d.slot);
      return {
        titulo: `Deu ${tipo}${nome ? ` “${nome}”` : ''}${slot ? ` (ninho ${slot})` : ''}`,
        detalhe: motivo,
        grupo: 'galinheiro',
      };
    }
    case 'definir_cobranca':
      return {
        titulo: texto(d.para) === 'usdt' ? 'Passou a cobrar em USDT' : 'Voltou a cobrar no PIX',
        grupo: 'economia',
      };
    case 'confirmar_usdt': {
      const valor = numero(d.valorUsdtX100);
      const tipo = texto(d.tipo) === 'ampliacao' ? 'ampliação' : 'roleta';
      return {
        titulo: valor === undefined ? `Confirmou USDT da ${tipo}` : `Confirmou ${fmt.moedas(valor)} USDT da ${tipo}`,
        grupo: 'economia',
      };
    }
    case 'definir_bonus_link': {
      const para = numero(d.para);
      return {
        titulo: para === undefined ? 'O link voltou ao bônus geral' : `Bônus do link: R$ ${fmt.moedas(para)}`,
        grupo: 'economia',
      };
    }
    case 'definir_bonus_geral': {
      const para = numero(d.para);
      return {
        titulo: para === undefined ? 'Mudou o bônus geral' : `Bônus geral: R$ ${fmt.moedas(para)}`,
        detalhe: 'Vale para os próximos cadastros sem valor próprio no link',
        grupo: 'economia',
      };
    }
    case 'definir_nivel':
      return {
        titulo: `Mudou o nível do galinheiro: ${numero(d.de) ?? '?'} → ${numero(d.para) ?? '?'}`,
        detalhe: motivo,
        grupo: 'galinheiro',
      };
    case 'iniciar_conversa':
      return { titulo: 'Enviou mensagem pelo atendimento', grupo: 'atendimento' };
    case 'resolver_conversa':
      return { titulo: 'Marcou a conversa como resolvida', grupo: 'atendimento' };
    case 'reabrir_conversa':
      return { titulo: 'Reabriu a conversa do atendimento', grupo: 'atendimento' };
    case 'excluir_usuario':
      return { titulo: 'Excluiu a conta', detalhe: motivo, grupo: 'exclusao' };
    default: {
      const nome = a.acao.replace(/_/g, ' ');
      const resumo = Object.entries(d)
        .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(' · ');
      return { titulo: nome.charAt(0).toUpperCase() + nome.slice(1), detalhe: resumo || undefined, grupo: 'outro' };
    }
  }
}

// ---------------------------------------------------------------- tutorial

const ETAPAS: Record<number, string> = {
  0: 'Boas-vindas',
  1: 'Conhecendo o galinheiro',
  2: 'Primeira coleta',
  3: 'Primeira venda',
  4: 'Primeiro giro na roleta',
  5: 'Dando nome ao animal',
  6: 'Coletando o animal novo',
  7: 'Pegando o ritmo',
  8: 'Concluído',
};

export function etapaTutorial(etapa: number): { rotulo: string; concluido: boolean; final: number } {
  const final = CONFIG.tutorial.etapaFinal;
  return { rotulo: ETAPAS[etapa] ?? `Etapa ${etapa}`, concluido: etapa >= final, final };
}
