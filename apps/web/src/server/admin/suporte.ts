// Chat de atendimento: uma conversa contínua por membro. O jogador escreve pelo jogo; a equipe responde pelo
// painel. Contadores de não lidas dos dois lados; a 1ª mensagem (ou a que reabre) ganha uma resposta automática.
import type {
  AdminConversaDTO, AdminConversaLinhaDTO, AdminListaConversasDTO, AutorMensagem, ConversaSuporteDTO, MensagemSuporteDTO,
} from '@galinheiro/api-contract';
import type { Consulta } from '../db/banco';
import { iso } from '../dominio/linhas';
import { ErroDominio } from '../erros';
import { auditar } from './acesso';

const n = (v: unknown): number => Number(v ?? 0);
const RESPOSTA_AUTOMATICA = 'Recebemos sua mensagem! Nossa equipe responde por aqui o quanto antes.';

interface LinhaMensagem { id: unknown; autor: AutorMensagem; texto: string; criado_em: Date; admin_nome: string | null }

async function mensagens(c: Consulta, conversaId: string, limite = 300): Promise<MensagemSuporteDTO[]> {
  const linhas = await c.q<LinhaMensagem>(
    `select * from (
       select m.id, m.autor, m.texto, m.criado_em, a.nome as admin_nome
         from suporte_mensagens m left join contas a on a.id = m.admin_id
        where m.conversa_id = $1 order by m.id desc limit ${limite}
     ) x order by id asc`,
    [conversaId],
  );
  return linhas.map((l) => ({ id: n(l.id), autor: l.autor, texto: l.texto, criadoEm: iso(l.criado_em), adminNome: l.admin_nome }));
}

async function inserirMensagem(c: Consulta, conversaId: string, autor: AutorMensagem, texto: string, agoraMs: number, adminId: string | null = null) {
  await c.q('insert into suporte_mensagens (conversa_id, autor, admin_id, texto, criado_em) values ($1, $2, $3, $4, $5)', [
    conversaId, autor, adminId, texto, new Date(agoraMs),
  ]);
}

// ---------------------------------------------------------------- lado do jogador

export async function conversaDoJogador(c: Consulta, contaId: string): Promise<ConversaSuporteDTO> {
  const conv = await c.um<{ id: string; status: 'aberta' | 'resolvida' }>(
    'update suporte_conversas set nao_lidas_jogador = 0 where conta_id = $1 returning id, status',
    [contaId],
  );
  if (!conv) return { id: null, status: 'aberta', mensagens: [] };
  return { id: conv.id, status: conv.status, mensagens: await mensagens(c, conv.id) };
}

export async function enviarMensagemJogador(c: Consulta, contaId: string, texto: string, agoraMs: number): Promise<ConversaSuporteDTO> {
  const agora = new Date(agoraMs);
  const antes = await c.um<{ status: string }>('select status from suporte_conversas where conta_id = $1', [contaId]);
  const conv = (await c.um<{ id: string }>(
    `insert into suporte_conversas (conta_id, status, nao_lidas_admin, ultima_mensagem_em, criado_em, atualizado_em)
     values ($1, 'aberta', 1, $2, $2, $2)
     on conflict (conta_id) do update
       set status = 'aberta', nao_lidas_admin = suporte_conversas.nao_lidas_admin + 1, ultima_mensagem_em = $2, atualizado_em = $2
     returning id`,
    [contaId, agora],
  ))!;
  await inserirMensagem(c, conv.id, 'jogador', texto, agoraMs);
  if (!antes || antes.status === 'resolvida') await inserirMensagem(c, conv.id, 'sistema', RESPOSTA_AUTOMATICA, agoraMs + 1);
  return conversaDoJogador(c, contaId);
}

export async function naoLidasDoJogador(c: Consulta, contaId: string): Promise<number> {
  const l = await c.um<{ n: unknown }>('select nao_lidas_jogador as n from suporte_conversas where conta_id = $1', [contaId]);
  return n(l?.n);
}

// ---------------------------------------------------------------- lado do painel

interface LinhaConversa {
  id: string; conta_id: string; nome: string; email: string; telefone: string; status: 'aberta' | 'resolvida';
  nao_lidas_admin: unknown; ultima_mensagem_em: Date | null; ultima_mensagem: string | null; ultimo_autor: AutorMensagem | null;
}
const SELECT_CONVERSA = `
  select sc.id, sc.conta_id, c.nome, c.email, c.telefone, sc.status, sc.nao_lidas_admin, sc.ultima_mensagem_em,
         um.texto as ultima_mensagem, um.autor as ultimo_autor
    from suporte_conversas sc
    join contas c on c.id = sc.conta_id
    left join lateral (
      select texto, autor from suporte_mensagens m where m.conversa_id = sc.id order by m.id desc limit 1
    ) um on true`;

function paraConversa(l: LinhaConversa): AdminConversaLinhaDTO {
  return {
    id: l.id,
    contaId: l.conta_id,
    nome: l.nome ?? '',
    email: l.email ?? '',
    telefone: l.telefone ?? '',
    status: l.status,
    naoLidas: n(l.nao_lidas_admin),
    ultimaMensagemEm: l.ultima_mensagem_em ? iso(l.ultima_mensagem_em) : null,
    ultimaMensagem: l.ultima_mensagem,
    ultimoAutor: l.ultimo_autor,
  };
}

export async function listarConversas(c: Consulta, filtro: { status: string; q?: string }): Promise<AdminListaConversasDTO> {
  const onde: string[] = [];
  const params: unknown[] = [];
  if (filtro.status !== 'todas') {
    params.push(filtro.status);
    onde.push(`sc.status = $${params.length}`);
  }
  if (filtro.q?.trim()) {
    params.push(`%${filtro.q.trim()}%`);
    onde.push(`(c.nome ilike $${params.length} or c.email ilike $${params.length})`);
  }
  const linhas = await c.q<LinhaConversa>(
    `${SELECT_CONVERSA} ${onde.length ? `where ${onde.join(' and ')}` : ''}
      order by sc.nao_lidas_admin > 0 desc, sc.ultima_mensagem_em desc nulls last
      limit 200`,
    params,
  );
  const t = (await c.um<Record<string, unknown>>(
    `select coalesce(sum(nao_lidas_admin), 0) as nao_lidas, count(*) filter (where status = 'aberta') as abertas from suporte_conversas`,
  ))!;
  return { itens: linhas.map(paraConversa), naoLidasTotal: n(t.nao_lidas), abertas: n(t.abertas) };
}

async function linhaConversa(c: Consulta, id: string): Promise<LinhaConversa> {
  const l = await c.um<LinhaConversa>(`${SELECT_CONVERSA} where sc.id = $1`, [id]);
  if (!l) throw new ErroDominio('NAO_ENCONTRADO', undefined, 'Conversa não encontrada.');
  return l;
}

/** Abre a conversa no painel (zera as não lidas do lado da equipe). */
export async function conversaAdmin(c: Consulta, id: string): Promise<AdminConversaDTO> {
  await c.q('update suporte_conversas set nao_lidas_admin = 0 where id = $1', [id]);
  const l = await linhaConversa(c, id);
  return { conversa: paraConversa(l), mensagens: await mensagens(c, id) };
}

export async function responder(c: Consulta, adminId: string, id: string, texto: string, agoraMs: number): Promise<AdminConversaDTO> {
  await linhaConversa(c, id);
  await inserirMensagem(c, id, 'admin', texto, agoraMs, adminId);
  await c.q(
    `update suporte_conversas set nao_lidas_jogador = nao_lidas_jogador + 1, nao_lidas_admin = 0, status = 'aberta',
            ultima_mensagem_em = $2, atualizado_em = $2 where id = $1`,
    [id, new Date(agoraMs)],
  );
  return conversaAdmin(c, id);
}

/** A equipe puxa conversa com um membro (pela ficha dele): cria ou reaproveita a conversa. */
export async function iniciarConversa(c: Consulta, adminId: string, contaId: string, texto: string, agoraMs: number): Promise<AdminConversaDTO> {
  const conta = await c.um<{ id: string }>('select id from contas where id = $1', [contaId]);
  if (!conta) throw new ErroDominio('NAO_ENCONTRADO', undefined, 'Usuário não encontrado.');
  const agora = new Date(agoraMs);
  const conv = (await c.um<{ id: string }>(
    `insert into suporte_conversas (conta_id, status, ultima_mensagem_em, criado_em, atualizado_em) values ($1, 'aberta', $2, $2, $2)
     on conflict (conta_id) do update set atualizado_em = $2
     returning id`,
    [contaId, agora],
  ))!;
  await auditar(c, adminId, 'iniciar_conversa', contaId);
  return responder(c, adminId, conv.id, texto, agoraMs);
}

export async function mudarStatusConversa(c: Consulta, adminId: string, id: string, status: 'aberta' | 'resolvida'): Promise<AdminConversaDTO> {
  const l = await linhaConversa(c, id);
  await c.q('update suporte_conversas set status = $2, atualizado_em = now() where id = $1', [id, status]);
  await auditar(c, adminId, status === 'resolvida' ? 'resolver_conversa' : 'reabrir_conversa', l.conta_id);
  return conversaAdmin(c, id);
}
