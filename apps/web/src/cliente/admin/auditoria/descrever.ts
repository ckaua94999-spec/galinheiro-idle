// Tradução das ações do painel (admin_acoes) para português legível: rótulo ("Ajustou saldo"), cor, ícone e um
// resumo dos detalhes ("+100,00 moedas · saldo ficou 1.234,00", "Motivo: …"). Ações desconhecidas ganham um
// rótulo a partir do próprio nome e os detalhes simples em "chave: valor".
import { formatarTelefone, type AdminAcaoDTO } from '@galinheiro/api-contract';
import {
  ArrowLeftRight, ArrowUpDown, Ban, Banknote, Bird, CheckCheck, CircleDot, Coins, Egg, Gift, KeyRound, Layers, LogOut, Megaphone, MessageSquarePlus, Pause, Pencil,
  Percent, Play, RotateCcw, ShieldCheck, Ticket, TicketPercent, Trash2, UserPen, UserX, Wrench, type LucideIcon,
} from 'lucide-react';
import { lerConfig, mudancasConfig } from '../afiliados/formato';
import { lerRegras, mudancasRegras, textoTickets } from '../intercambio/formato';
import { fmt } from '../ui';

export type TomAcao = 'neutro' | 'verde' | 'azul' | 'ambar' | 'vermelho' | 'roxo';

export interface DescricaoAcao {
  rotulo: string;
  tom: TomAcao;
  Icone: LucideIcon;
  /** o principal do que mudou ("+100,00 moedas", "Nível 2 → 4") */
  resumo: string | null;
  /** complemento ("saldo ficou 1.234,00") */
  extra: string | null;
  motivo: string | null;
  /** quando o alvo é um popup (e não um membro) */
  popup: { id: string | null; titulo: string | null } | null;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const txt = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
/** sinal visível: "+" para crédito, "−" (menos tipográfico) para débito */
const sinal = (v: number): string => (v > 0 ? '+' : v < 0 ? '−' : '');

const ESPECIE: Record<string, string> = { galinha: 'Galinha', pato: 'Pato', ganso: 'Ganso', avestruz: 'Avestruz' };

const CAMPOS_USUARIO: Record<string, string> = { nome: 'Nome', telefone: 'Telefone', email: 'E-mail', papel: 'Papel' };
const PAPEL: Record<string, string> = { admin: 'administrador', jogador: 'jogador' };

const CAMPOS_POPUP: Record<string, string> = {
  titulo: 'título',
  mensagem: 'mensagem',
  imagemUrl: 'imagem',
  botaoTexto: 'texto do botão',
  link: 'link',
  publico: 'público',
  contas: 'membros escolhidos',
  frequencia: 'frequência',
  inicio: 'início',
  fim: 'fim',
  ativo: 'ligado/pausado',
};

// intercâmbio (tickets) e cupons: nomes dos campos editados
const CAMPOS_OFERTA: Record<string, string> = {
  item: 'ovo',
  quantidade: 'quantidade',
  animal: 'espécie',
  custoTickets: 'custo',
  ativo: 'ativa/pausada',
  ordem: 'ordem',
};
const CAMPOS_CUPOM: Record<string, string> = {
  descricao: 'descrição',
  tickets: 'tickets',
  usosMax: 'limite de usos',
  inicio: 'início',
  fim: 'fim',
  ativo: 'ligado/pausado',
};
const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((c): c is string => typeof c === 'string') : []);

/** "a, b e c" */
export function juntar(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? '';
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

/** "(11) 98765-4321" sem quebrar a linha entre o DDD e o número */
const telefone = (t: string): string => (t.startsWith('+') ? formatarTelefone(t) : t).replace(' ', '\u00a0');

function valorUsuario(campo: string, v: unknown): string {
  const t = txt(v);
  if (t === null) return '—';
  if (campo === 'telefone') return telefone(t);
  if (campo === 'papel') return PAPEL[t] ?? t;
  return t;
}

/** "ajustar_estoque_extra" → "Ajustar estoque extra" */
const humanizar = (acao: string): string => {
  const t = acao.replace(/[_-]+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function detalhesGenericos(d: Record<string, unknown>): string | null {
  const partes = Object.entries(d)
    .filter(([k, v]) => k !== 'motivo' && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'))
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${typeof v === 'boolean' ? (v ? 'sim' : 'não') : String(v)}`);
  return partes.length ? partes.join(' · ') : null;
}

export function descreverAcao(a: AdminAcaoDTO, titulosPopups: ReadonlyMap<string, string>): DescricaoAcao {
  const d = a.detalhes ?? {};
  const motivo = txt(d.motivo);
  const base = { resumo: null, extra: null, motivo, popup: null };
  const popupDe = () => {
    const id = txt(d.popupId);
    // o título atual (se o popup ainda existe) vale mais que o guardado na hora da ação
    return { id, titulo: (id ? titulosPopups.get(id) : undefined) ?? txt(d.titulo) };
  };

  switch (a.acao) {
    case 'ajustar_saldo': {
      const v = num(d.valorX100);
      const saldo = num(d.saldoAposX100);
      return {
        ...base,
        rotulo: 'Ajustou saldo',
        tom: 'ambar',
        Icone: Coins,
        resumo: v === null ? null : `${sinal(v)}${fmt.moedas(Math.abs(v))} moedas`,
        extra: saldo === null ? null : `saldo ficou ${fmt.moedas(saldo)}`,
      };
    }
    case 'ajustar_ovos': {
      const q = num(d.quantidade);
      const especie = (txt(d.item) ?? '').replace(/^ovo_/, '');
      return {
        ...base,
        rotulo: 'Ajustou ovos',
        tom: 'ambar',
        Icone: Egg,
        resumo: q === null ? null : `${sinal(q)}${fmt.int(Math.abs(q))} ${Math.abs(q) === 1 ? 'ovo' : 'ovos'}${especie ? ` de ${especie}` : ''}`,
      };
    }
    case 'dar_animal': {
      const tipo = txt(d.tipo);
      const nome = txt(d.nome);
      const slot = num(d.slot);
      return {
        ...base,
        rotulo: 'Deu animal',
        tom: 'ambar',
        Icone: Bird,
        resumo: [tipo ? (ESPECIE[tipo] ?? tipo) : 'Animal', nome ? `“${nome}”` : null].filter(Boolean).join(' '),
        extra: slot === null ? null : `no ninho ${slot}`,
      };
    }
    case 'definir_nivel': {
      const de = num(d.de);
      const para = num(d.para);
      return {
        ...base,
        rotulo: 'Mudou nível',
        tom: 'ambar',
        Icone: Layers,
        resumo: para === null ? null : de === null ? `Galinheiro no nível ${para}` : `Galinheiro: nível ${de} → ${para}`,
      };
    }
    case 'definir_cobranca': {
      const para = txt(d.para);
      return {
        ...base,
        rotulo: 'Mudou a cobrança',
        tom: 'azul',
        Icone: Banknote,
        resumo: para === 'usdt' ? 'Roleta e ampliação passam a cobrar em USDT' : 'Roleta e ampliação voltam ao PIX',
      };
    }
    case 'confirmar_usdt': {
      const valor = num(d.valorUsdtX100);
      const tipo = txt(d.tipo) === 'ampliacao' ? 'ampliação' : 'roleta';
      return {
        ...base,
        rotulo: 'Confirmou USDT',
        tom: 'verde',
        Icone: Coins,
        resumo: valor === null ? `Pagamento da ${tipo}` : `${fmt.moedas(valor)} USDT na ${tipo}`,
      };
    }
    case 'definir_bonus_link': {
      const para = num(d.para);
      return {
        ...base,
        rotulo: 'Definiu o bônus do link',
        tom: 'azul',
        Icone: Gift,
        resumo: para === null ? 'O link voltou a seguir o bônus geral' : `Quem entrar por este link recebe R$ ${fmt.moedas(para)}`,
      };
    }
    case 'definir_bonus_geral': {
      const para = num(d.para);
      return {
        ...base,
        rotulo: 'Mudou o bônus geral',
        tom: 'ambar',
        Icone: Coins,
        resumo: para === null ? null : `Próximos cadastros sem valor próprio recebem R$ ${fmt.moedas(para)}`,
      };
    }
    case 'liberar_bonus_saque':
      return { ...base, rotulo: 'Liberou bônus para saque', tom: 'verde', Icone: Banknote, resumo: 'O bônus inicial entra no saque sem PIX da roleta' };
    case 'bloquear_bonus_saque':
      return { ...base, rotulo: 'Voltou a exigir a roleta', tom: 'ambar', Icone: Banknote, resumo: 'O bônus inicial só sai no saque com o plano ativo' };
    case 'bloquear':
      return { ...base, rotulo: 'Bloqueou', tom: 'vermelho', Icone: Ban, resumo: 'Sessões encerradas e acesso suspenso' };
    case 'desbloquear':
      return { ...base, rotulo: 'Desbloqueou', tom: 'verde', Icone: ShieldCheck, resumo: 'Acesso liberado de novo' };
    case 'encerrar_sessoes':
      return { ...base, rotulo: 'Encerrou sessões', tom: 'azul', Icone: LogOut, resumo: 'Desconectado de todos os aparelhos' };
    case 'novo_codigo_recuperacao':
      return { ...base, rotulo: 'Gerou código de recuperação', tom: 'azul', Icone: KeyRound, resumo: 'O código antigo deixou de valer' };
    case 'editar_usuario': {
      const mudancas = Object.entries(d)
        .filter(([k, v]) => k in CAMPOS_USUARIO && v && typeof v === 'object')
        .map(([k, v]) => {
          const { de, para } = v as { de?: unknown; para?: unknown };
          return `${CAMPOS_USUARIO[k]}: ${valorUsuario(k, de)} → ${valorUsuario(k, para)}`;
        });
      return { ...base, rotulo: 'Editou cadastro', tom: 'azul', Icone: UserPen, resumo: mudancas.length ? mudancas.join(' · ') : null };
    }
    case 'excluir_usuario': {
      // o nome já aparece no alvo; aqui ficam os contatos que a conta tinha
      const tel = txt(d.telefone);
      return {
        ...base,
        rotulo: 'Excluiu conta',
        tom: 'vermelho',
        Icone: UserX,
        resumo: [txt(d.email), tel ? telefone(tel) : null].filter(Boolean).join(' · ') || null,
        extra: 'todos os dados apagados',
      };
    }
    case 'criar_popup': {
      const contas = num(d.contas);
      const publico = txt(d.publico) === 'contas' ? `para ${fmt.int(contas ?? 0)} ${contas === 1 ? 'membro' : 'membros'}` : 'para todos os membros';
      return { ...base, rotulo: 'Criou popup', tom: 'roxo', Icone: Megaphone, popup: popupDe(), resumo: publico };
    }
    case 'editar_popup': {
      // `ativo` (true/false) só vem quando a edição ligou ou pausou o popup
      const ativo = typeof d.ativo === 'boolean' ? d.ativo : null;
      const campos = (Array.isArray(d.campos) ? d.campos.filter((c): c is string => typeof c === 'string') : [])
        .filter((c) => !(c === 'ativo' && ativo !== null))
        .map((c) => CAMPOS_POPUP[c] ?? c);
      if (ativo !== null && campos.length === 0) {
        return { ...base, rotulo: ativo ? 'Ativou popup' : 'Pausou popup', tom: ativo ? 'verde' : 'neutro', Icone: ativo ? Play : Pause, popup: popupDe() };
      }
      const partes = [campos.length ? `Mudou ${juntar(campos)}` : null, ativo === null ? null : ativo ? 'ativou' : 'pausou'].filter(Boolean);
      return { ...base, rotulo: 'Editou popup', tom: 'roxo', Icone: Pencil, popup: popupDe(), resumo: partes.length ? partes.join(' · ') : null };
    }
    case 'excluir_popup':
      return { ...base, rotulo: 'Excluiu popup', tom: 'vermelho', Icone: Trash2, popup: popupDe(), resumo: 'Estatísticas apagadas junto' };
    case 'iniciar_conversa':
      return { ...base, rotulo: 'Iniciou conversa', tom: 'azul', Icone: MessageSquarePlus, resumo: 'Mensagem enviada a partir da ficha' };
    case 'resolver_conversa':
      return { ...base, rotulo: 'Resolveu conversa', tom: 'verde', Icone: CheckCheck };
    case 'reabrir_conversa':
      return { ...base, rotulo: 'Reabriu conversa', tom: 'azul', Icone: RotateCcw };
    case 'virar_admin_dev':
      return { ...base, rotulo: 'Virou admin (teste)', tom: 'neutro', Icone: Wrench, resumo: 'Atalho do ambiente de desenvolvimento' };
    case 'configurar_afiliados': {
      // detalhes = { de: Config, para: Config } (programa de convites; tudo em moedas do jogo)
      const de = lerConfig(d.de);
      const para = lerConfig(d.para);
      const mudancas = (de && para ? mudancasConfig(de, para) : []).join(' · ');
      return {
        ...base,
        rotulo: 'Mudou taxas e comissões',
        tom: 'ambar',
        Icone: Percent,
        resumo: mudancas ? mudancas.charAt(0).toUpperCase() + mudancas.slice(1) : de && para ? 'Salvou sem mudar nada' : null,
      };
    }
    // ------------------------------------------------ intercâmbio e cupons (tudo em tickets, vales do jogo)
    case 'configurar_intercambio': {
      // detalhes = { de: Regras, para: Regras }
      const de = lerRegras(d.de);
      const para = lerRegras(d.para);
      const mudancas = (de && para ? mudancasRegras(de, para) : []).join(' · ');
      return {
        ...base,
        rotulo: 'Mudou o Intercâmbio',
        tom: 'ambar',
        Icone: ArrowLeftRight,
        resumo: mudancas || (de && para ? 'Salvou sem mudar nada' : null),
      };
    }
    case 'criar_oferta': {
      const oferta = txt(d.oferta);
      const custo = num(d.custoTickets);
      return {
        ...base,
        rotulo: 'Criou oferta',
        tom: 'verde',
        Icone: ArrowLeftRight,
        resumo: oferta ? `${oferta}${custo === null ? '' : ` por ${textoTickets(custo)}`}` : null,
      };
    }
    case 'editar_oferta': {
      // `ativo` só vem quando a edição ativou ou pausou; `custo` ({ de, para }) só quando o custo mudou
      const oferta = txt(d.oferta);
      const ativo = typeof d.ativo === 'boolean' ? d.ativo : null;
      const campos = lista(d.campos);
      const custo = d.custo && typeof d.custo === 'object' ? (d.custo as { de?: unknown; para?: unknown }) : null;
      const custoDe = num(custo?.de);
      const custoPara = num(custo?.para);
      if (campos.length === 1 && campos[0] === 'ordem') {
        return { ...base, rotulo: 'Mudou a ordem', tom: 'neutro', Icone: ArrowUpDown, resumo: oferta, extra: 'subiu ou desceu na tabela de ofertas' };
      }
      if (ativo !== null && campos.every((c) => c === 'ativo')) {
        return { ...base, rotulo: ativo ? 'Ativou oferta' : 'Pausou oferta', tom: ativo ? 'verde' : 'neutro', Icone: ativo ? Play : Pause, resumo: oferta };
      }
      const outros = campos.filter((c) => c !== 'ativo' && !(c === 'custoTickets' && custoDe !== null) && c !== 'ordem').map((c) => CAMPOS_OFERTA[c] ?? c);
      const partes = [
        custoDe !== null && custoPara !== null ? `custo: ${textoTickets(custoDe)} → ${textoTickets(custoPara)}` : null,
        outros.length ? `mudou ${juntar(outros)}` : null,
        ativo === null ? null : ativo ? 'ativou' : 'pausou',
      ].filter((p): p is string => !!p);
      return { ...base, rotulo: 'Editou oferta', tom: 'azul', Icone: Pencil, resumo: oferta, extra: partes.join(' · ') || null };
    }
    case 'excluir_oferta':
      return { ...base, rotulo: 'Excluiu oferta', tom: 'vermelho', Icone: Trash2, resumo: txt(d.oferta), extra: 'as trocas já feitas continuam valendo' };
    case 'criar_cupom': {
      const codigo = txt(d.codigo);
      const tickets = num(d.tickets);
      const usosMax = num(d.usosMax);
      const partes = [
        tickets === null ? null : textoTickets(tickets),
        d.usosMax === null ? 'sem limite de usos' : usosMax === null ? null : `${fmt.int(usosMax)} ${usosMax === 1 ? 'uso' : 'usos'}`,
      ].filter((p): p is string => !!p);
      return {
        ...base,
        rotulo: 'Criou cupom',
        tom: 'roxo',
        Icone: TicketPercent,
        resumo: codigo ? `${codigo}${partes.length ? ` (${partes.join(', ')})` : ''}` : null,
      };
    }
    case 'editar_cupom': {
      // `ativo` (true/false) só vem quando a edição ligou ou pausou o cupom
      const codigo = txt(d.codigo);
      const ativo = typeof d.ativo === 'boolean' ? d.ativo : null;
      const campos = lista(d.campos)
        .filter((c) => !(c === 'ativo' && ativo !== null))
        .map((c) => CAMPOS_CUPOM[c] ?? c);
      if (ativo !== null && campos.length === 0) {
        return { ...base, rotulo: ativo ? 'Ativou cupom' : 'Pausou cupom', tom: ativo ? 'verde' : 'neutro', Icone: ativo ? Play : Pause, resumo: codigo };
      }
      const partes = [campos.length ? `mudou ${juntar(campos)}` : null, ativo === null ? null : ativo ? 'ativou' : 'pausou'].filter(
        (p): p is string => !!p,
      );
      return { ...base, rotulo: 'Editou cupom', tom: 'roxo', Icone: Pencil, resumo: codigo, extra: partes.join(' · ') || null };
    }
    case 'excluir_cupom': {
      const usos = num(d.usos);
      return {
        ...base,
        rotulo: 'Excluiu cupom',
        tom: 'vermelho',
        Icone: Trash2,
        resumo: txt(d.codigo),
        extra: usos ? `${fmt.int(usos)} ${usos === 1 ? 'resgate' : 'resgates'} (os tickets ficaram com os membros)` : 'ninguém tinha resgatado',
      };
    }
    case 'ajustar_tickets': {
      const q = num(d.quantidade);
      const saldo = num(d.saldoApos);
      return {
        ...base,
        rotulo: 'Ajustou tickets',
        tom: 'ambar',
        Icone: Ticket,
        resumo: q === null ? null : `${sinal(q)}${textoTickets(Math.abs(q))}`,
        extra: saldo === null ? null : `saldo ficou ${fmt.int(saldo)}`,
      };
    }
    default:
      return { ...base, rotulo: humanizar(a.acao), tom: 'neutro', Icone: CircleDot, resumo: detalhesGenericos(d) };
  }
}
