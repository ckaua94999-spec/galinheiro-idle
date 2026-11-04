// Popups (avisos) que a equipe coloca na tela dos membros: público (todos ou contas escolhidas), período
// (início/fim), frequência (uma vez, uma vez por dia ou sempre que abrir o jogo) e link opcional (rota do jogo
// ou https externo). Cada exibição e clique fica registrado para as estatísticas.
import type { AdminPopupDTO, AvisosDTO, PopupDTO } from '@galinheiro/api-contract';
import type { Consulta } from '../db/banco';
import { iso } from '../dominio/linhas';
import { ErroDominio } from '../erros';
import { auditar } from './acesso';
import { diaSql } from './painel';
import { naoLidasDoJogador } from './suporte';

const n = (v: unknown): number => Number(v ?? 0);

interface LinhaPopup {
  id: string;
  titulo: string;
  mensagem: string;
  imagem_url: string | null;
  botao_texto: string | null;
  link: string | null;
  publico: 'todos' | 'contas';
  contas: string[];
  frequencia: 'uma_vez' | 'diaria' | 'sempre';
  inicio: Date;
  fim: Date | null;
  ativo: boolean;
  criado_em: Date;
  pessoas?: unknown;
  exibicoes?: unknown;
  cliques?: unknown;
}

const paraPopup = (l: LinhaPopup): PopupDTO => ({
  id: l.id,
  titulo: l.titulo,
  mensagem: l.mensagem,
  imagemUrl: l.imagem_url,
  botaoTexto: l.botao_texto,
  link: l.link,
});

// ---------------------------------------------------------------- lado do jogador

/** Popups que este membro deve ver agora + mensagens do suporte ainda não lidas. */
export async function avisosDoJogador(c: Consulta, contaId: string, agoraMs: number): Promise<AvisosDTO> {
  const agora = new Date(agoraMs);
  const linhas = await c.q<LinhaPopup>(
    `select p.* from popups p
       left join popups_vistos v on v.popup_id = p.id and v.conta_id = $1
      where p.ativo and p.inicio <= $2 and (p.fim is null or p.fim > $2)
        and (p.publico = 'todos' or $1 = any(p.contas))
        and (p.frequencia = 'sempre'
             or (p.frequencia = 'uma_vez' and v.popup_id is null)
             or (p.frequencia = 'diaria' and (v.popup_id is null or ${diaSql('v.ultima_vez_em')} < ${diaSql('$2::timestamptz')})))
      order by p.inicio desc
      limit 5`,
    [contaId, agora],
  );
  return { popups: linhas.map(paraPopup), suporteNaoLidas: await naoLidasDoJogador(c, contaId) };
}

async function existe(c: Consulta, id: string): Promise<void> {
  if (!(await c.um('select 1 from popups where id = $1', [id]))) throw new ErroDominio('NAO_ENCONTRADO', undefined, 'Aviso não encontrado.');
}

export async function registrarVisto(c: Consulta, contaId: string, popupId: string, agoraMs: number): Promise<void> {
  await existe(c, popupId);
  await c.q(
    `insert into popups_vistos (popup_id, conta_id, primeira_vez_em, ultima_vez_em) values ($1, $2, $3, $3)
     on conflict (popup_id, conta_id) do update set ultima_vez_em = $3, vezes = popups_vistos.vezes + 1`,
    [popupId, contaId, new Date(agoraMs)],
  );
}

export async function registrarClique(c: Consulta, contaId: string, popupId: string, agoraMs: number): Promise<void> {
  await existe(c, popupId);
  await c.q(
    `insert into popups_vistos (popup_id, conta_id, primeira_vez_em, ultima_vez_em, clicou_em) values ($1, $2, $3, $3, $3)
     on conflict (popup_id, conta_id) do update set clicou_em = coalesce(popups_vistos.clicou_em, $3)`,
    [popupId, contaId, new Date(agoraMs)],
  );
}

// ---------------------------------------------------------------- lado do painel

const paraAdmin = (l: LinhaPopup): AdminPopupDTO => ({
  ...paraPopup(l),
  publico: l.publico,
  contas: l.contas ?? [],
  frequencia: l.frequencia,
  inicio: iso(l.inicio),
  fim: l.fim ? iso(l.fim) : null,
  ativo: l.ativo,
  criadoEm: iso(l.criado_em),
  estatisticas: { pessoas: n(l.pessoas), exibicoes: n(l.exibicoes), cliques: n(l.cliques) },
});

const SELECT_ADMIN = `
  select p.*, count(v.conta_id) as pessoas, coalesce(sum(v.vezes), 0) as exibicoes, count(v.clicou_em) as cliques
    from popups p left join popups_vistos v on v.popup_id = p.id`;

export async function listarPopups(c: Consulta): Promise<AdminPopupDTO[]> {
  return (await c.q<LinhaPopup>(`${SELECT_ADMIN} group by p.id order by p.criado_em desc limit 500`)).map(paraAdmin);
}

async function popupAdmin(c: Consulta, id: string): Promise<AdminPopupDTO> {
  const l = await c.um<LinhaPopup>(`${SELECT_ADMIN} where p.id = $1 group by p.id`, [id]);
  if (!l) throw new ErroDominio('NAO_ENCONTRADO', undefined, 'Aviso não encontrado.');
  return paraAdmin(l);
}

export interface DadosPopup {
  titulo: string;
  mensagem: string;
  imagemUrl: string | null;
  botaoTexto: string | null;
  link: string | null;
  publico: 'todos' | 'contas';
  contas: string[];
  frequencia: 'uma_vez' | 'diaria' | 'sempre';
  inicio?: string;
  fim: string | null;
  ativo: boolean;
}

const COLUNAS: Record<keyof DadosPopup, string> = {
  titulo: 'titulo',
  mensagem: 'mensagem',
  imagemUrl: 'imagem_url',
  botaoTexto: 'botao_texto',
  link: 'link',
  publico: 'publico',
  contas: 'contas',
  frequencia: 'frequencia',
  inicio: 'inicio',
  fim: 'fim',
  ativo: 'ativo',
};

function validarPeriodo(inicio: string | Date | undefined, fim: string | Date | null | undefined) {
  if (inicio && fim && new Date(fim) <= new Date(inicio)) {
    throw new ErroDominio('PAYLOAD_INVALIDO', { issues: [{ caminho: 'fim', mensagem: 'O fim precisa ser depois do início.' }] }, 'O fim precisa ser depois do início.');
  }
}

export async function criarPopup(c: Consulta, adminId: string, d: DadosPopup, agoraMs: number): Promise<AdminPopupDTO> {
  const inicio = d.inicio ? new Date(d.inicio) : new Date(agoraMs);
  validarPeriodo(inicio, d.fim);
  const l = (await c.um<{ id: string }>(
    `insert into popups (titulo, mensagem, imagem_url, botao_texto, link, publico, contas, frequencia, inicio, fim, ativo, criado_por, criado_em, atualizado_em)
     values ($1, $2, $3, $4, $5, $6, $7::uuid[], $8, $9, $10, $11, $12, $13, $13) returning id`,
    [d.titulo, d.mensagem, d.imagemUrl, d.botaoTexto, d.link, d.publico, d.publico === 'contas' ? d.contas : [], d.frequencia, inicio, d.fim ? new Date(d.fim) : null, d.ativo, adminId, new Date(agoraMs)],
  ))!;
  await auditar(c, adminId, 'criar_popup', null, { popupId: l.id, titulo: d.titulo, publico: d.publico, contas: d.contas.length });
  return popupAdmin(c, l.id);
}

export async function editarPopup(c: Consulta, adminId: string, id: string, d: Partial<DadosPopup>): Promise<AdminPopupDTO> {
  const atual = await popupAdmin(c, id);
  validarPeriodo(d.inicio ?? atual.inicio, d.fim === undefined ? atual.fim : d.fim);
  const sets: string[] = [];
  const params: unknown[] = [id];
  for (const [chave, valor] of Object.entries(d) as [keyof DadosPopup, unknown][]) {
    if (valor === undefined) continue;
    const col = COLUNAS[chave];
    params.push(chave === 'inicio' || chave === 'fim' ? (valor ? new Date(valor as string) : null) : valor);
    sets.push(`${col} = $${params.length}${chave === 'contas' ? '::uuid[]' : ''}`);
  }
  if (sets.length) await c.q(`update popups set ${sets.join(', ')}, atualizado_em = now() where id = $1`, params);
  if ((d.publico ?? atual.publico) === 'contas' && (d.contas ?? atual.contas).length === 0) {
    throw new ErroDominio('PAYLOAD_INVALIDO', { issues: [{ caminho: 'contas', mensagem: 'Escolha pelo menos um usuário.' }] }, 'Escolha pelo menos um usuário.');
  }
  await auditar(c, adminId, 'editar_popup', null, {
    popupId: id,
    titulo: d.titulo ?? atual.titulo,
    campos: Object.keys(d).filter((k) => d[k as keyof DadosPopup] !== undefined),
    // ligou/pausou fica explícito na auditoria
    ...(d.ativo !== undefined && d.ativo !== atual.ativo ? { ativo: d.ativo } : {}),
  });
  return popupAdmin(c, id);
}

export async function excluirPopup(c: Consulta, adminId: string, id: string): Promise<void> {
  const atual = await popupAdmin(c, id);
  await c.q('delete from popups where id = $1', [id]);
  await auditar(c, adminId, 'excluir_popup', null, { popupId: id, titulo: atual.titulo });
}
