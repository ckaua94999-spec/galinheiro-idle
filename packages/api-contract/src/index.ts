// Contrato da API /api/v1 (GDD seção 9): tipos dos DTOs + schemas zod das entradas.
import { z } from 'zod';
import type { Inventario, Item, Raridade, Tier, Tipo } from '@galinheiro/game-core';
import { normalizarTelefone } from './telefone';

export { formatarTelefone, mascararTelefone, normalizarTelefone } from './telefone';
export { cpfValido, digitosCpf, formatarCpf, mascararCpf } from './cpf';

export type { Inventario, Item, Raridade, Tier, Tipo };

// ---------------------------------------------------------------- envelopes
export type CodigoErro =
  | 'NAO_AUTENTICADO' | 'JOGADOR_NAO_ENCONTRADO' | 'ENTIDADE_NAO_ENCONTRADA' | 'ENTIDADE_EXPIRADA'
  | 'RENDIMENTO_NAO_PRONTO' | 'SALDO_INSUFICIENTE' | 'SEM_NINHO_LIVRE' | 'GALINHEIRO_NO_MAXIMO'
  | 'ESTOQUE_INSUFICIENTE' | 'VENDA_VAZIA' | 'NOME_INVALIDO' | 'NOME_IMPROPRIO' | 'TUTORIAL_ETAPA_INVALIDA'
  | 'CONFIRMACAO_INVALIDA' | 'PAYLOAD_INVALIDO' | 'IDEMPOTENCY_KEY_AUSENTE' | 'IDEMPOTENCY_CONFLITO'
  | 'RATE_LIMITED' | 'MANUTENCAO' | 'ERRO_INTERNO'
  | 'EMAIL_EM_USO' | 'TELEFONE_EM_USO' | 'CADASTRO_INCOMPLETO' | 'CREDENCIAIS_INVALIDAS' | 'CODIGO_INVALIDO' | 'NAO_ENCONTRADO'
  | 'ACESSO_NEGADO' | 'CONTA_BLOQUEADA' | 'CONVITE_INVALIDO'
  | 'TICKETS_INSUFICIENTES' | 'INTERCAMBIO_FECHADO' | 'COMPRA_DESLIGADA' | 'LIMITE_DIARIO' | 'OFERTA_INDISPONIVEL'
  | 'CUPOM_INVALIDO' | 'CUPOM_JA_USADO' | 'CUPOM_ESGOTADO'
  | 'CPF_INVALIDO' | 'SAQUE_INDISPONIVEL' | 'SAQUE_EM_ANDAMENTO'
  | 'PIX_INDISPONIVEL' | 'USDT_INDISPONIVEL' | 'PAGAMENTO_PENDENTE';

export interface Envelope<T> { ok: true; data: T; serverTime: string; stateVersion?: number }
export interface EnvelopeErro {
  ok: false;
  error: { code: CodigoErro; message: string; details?: Record<string, unknown> };
  serverTime: string;
}

// ---------------------------------------------------------------- DTOs
export interface PlayerDTO {
  id: string;
  apelido: string | null;
  moedasX100: number;
  nivelGalinheiro: number;
  capacidade: number;
  ocupados: number;
  tutorialEtapa: number;
  aposentadoriasVistasAte: string;
  preferencias: Preferencias;
  criadoEm: string;
  /** tickets do Intercâmbio (vales do jogo trocados por ovos ou animais) */
  tickets: number;
  /** giros da roleta ganhos em cupom; cada um entra sem PIX */
  girosGratis: number;
}

export interface EntityDTO {
  id: string;
  nome: string;
  tipo: Tipo;
  raridade: Raridade;
  status: 'ativo' | 'expirado';
  origem: 'ROLETA' | 'BOAS_VINDAS' | 'SUPORTE' | 'INTERCAMBIO';
  nascimento: string;
  expiracao: string;
  expiradoEm: string | null;
  vidaAtual: number;
  vida: { ancora: number; ancoraEm: string; fatorPct: number };
  tier: Tier | null;
  cicloN: number;
  cicloInicio: string;
  cicloTier: Tier;
  proximoRendimento: string;
  pronto: boolean;
  ultimoCiclo: boolean;
  slotId: number | null;
  diasRestantes: number;
  valorOvoX100: number;
  stats: { ovosTotal: number; coletasTotal: number };
  /** Ovos entregues automaticamente na aposentadoria (0 enquanto ativo). */
  presenteOvos: number;
  // ovosPendentes: NUNCA enviado (surpresa + anti-datamining)
}

export interface EntityDetalheDTO extends EntityDTO {
  info: {
    idadeDias: number;
    efeitos: { rendimentoPct: number; chanceTresOvosPct: number; atrasoH: number; duracaoCicloH: number } | null;
    mediaOvosPorColeta: number | null;
  };
}

export interface StateDTO {
  player: PlayerDTO;
  inventario: Inventario;
  ninhos: { slot: number; entityId: string | null }[];
  entidades: EntityDTO[];
  aposentadoriasNaoVistas: EntityDTO[];
  resumo: { prontos: number; proximoProntoEm: string | null; valorInventarioX100: number };
  config: { versao: string };
  conta: ContaDTO;
}

/** Conta do membro. `telefone` em E.164 (+55…); só o próprio dono recebe estes dados. `admin` libera o /admin. */
export interface ContaDTO { email: string; nome: string; telefone: string; admin: boolean }

export interface Eventos { aposentadorias: EntityDTO[] }

export interface ColetaDTO { entityId: string; nome: string; ovos: number; item: Item; tier: Tier; cicloN: number; jackpot: boolean }

export interface ColetarResposta { coleta: ColetaDTO; entity: EntityDTO; inventario: Inventario; eventos: Eventos }
export interface ColetarTodosResposta {
  coletas: ColetaDTO[];
  totais: Partial<Inventario>;
  totalOvos: number;
  entidades: EntityDTO[];
  inventario: Inventario;
  eventos: Eventos;
}
export interface VenderResposta {
  venda: { itens: Partial<Inventario>; creditoX100: number; transacaoId: string };
  saldoX100: number;
  inventario: Inventario;
}
export interface GirarResposta {
  giro: { id: string; rngValor: number; anguloResultado: number; tipo: Tipo; raridade: Raridade; custoX100: number };
  entity: EntityDTO;
  saldoX100: number;
  /** giros de cupom que ainda restam depois deste giro */
  girosGratis: number;
  capacidade: { ocupados: number; total: number };
  eventos: Eventos;
}
export interface AmpliarResposta {
  nivelGalinheiro: number;
  capacidade: number;
  novosSlots: number[];
  saldoX100: number;
  transacaoId: string;
}
export interface ListaEntidades { itens: EntityDTO[]; total: number; proximoCursor: string | null }
export interface TransacaoDTO {
  id: string;
  tipo: 'BONUS_INICIAL' | 'VENDA_OVOS' | 'GIRO_ROLETA' | 'UPGRADE_NINHO' | 'AJUSTE_SUPORTE' | 'COMISSAO_INDICACAO' | 'COMPRA_TICKET' | 'SAQUE' | 'SAQUE_ESTORNO';
  valorX100: number;
  saldoAposX100: number;
  detalhes: Record<string, unknown>;
  criadoEm: string;
}
export interface ListaTransacoes { itens: TransacaoDTO[]; proximoCursor: string | null }

export interface ConfigPublicaDTO {
  versao: string;
  galinheiro: { nivelMax: number; ninhosPorNivel: number; custoUpgradeX100: number };
  roleta: {
    custoX100: number;
    chances: { tipo: Tipo; raridade: Raridade; pct: number; grauInicio: number; largura: number }[];
  };
  animais: Record<Tipo, { raridade: Raridade; precoOvoX100: number; fatorPct: number }>;
  ciclo: {
    baseH: number;
    janelaGracaH: number;
    tiers: Record<Tier, { acimaDe: number; multPct: number; atrasoH: number; chanceTresOvosPct: number }>;
  };
  vida: { vidaUtilDias: number };
  push: { vapidPublicKey: string | null };
  dev: { relogioAjustavel: boolean };
}

// ---------------------------------------------------------------- preferências
export const PreferenciasSchema = z.object({
  efeitosVolume: z.number().min(0).max(100).default(80),
  /** Vento suave ao fundo (sem piados). Desligado por padrão. */
  somAmbiente: z.boolean().default(false),
  vibracao: z.boolean().default(true),
  reduzirAnimacoes: z.enum(['sistema', 'ligado', 'desligado']).default('sistema'),
  pularAnimacaoRoleta: z.boolean().default(false),
});
export type Preferencias = z.infer<typeof PreferenciasSchema>;
export const PREFERENCIAS_PADRAO: Preferencias = PreferenciasSchema.parse({});

// ---------------------------------------------------------------- entradas (zod)
const itemSchema = z.enum(['ovo_galinha', 'ovo_pato', 'ovo_ganso', 'ovo_avestruz']);

export const CollectBody = z.object({ entityId: z.uuid() });

export const SellBody = z.union([
  z.object({ tudo: z.literal(true) }),
  z.object({ itens: z.partialRecord(itemSchema, z.number().int().min(0).max(1_000_000)) }),
]);

export const RenameBody = z.object({ nome: z.string().max(60) });

export const RetirementsAckBody = z.object({ ate: z.iso.datetime() });

export const TutorialBody = z.object({ etapa: z.number().int().min(1).max(8) });

export const DeleteMeBody = z.object({ confirmacao: z.literal('EXCLUIR MEU GALINHEIRO') });

export const PatchMeBody = z.object({
  apelido: z.string().trim().min(1).max(24).nullable().optional(),
  preferencias: PreferenciasSchema.partial().optional(),
});

export const EntitiesQuery = z.object({
  status: z.enum(['ativo', 'expirado', 'todos']).default('ativo'),
  tipo: z.enum(['galinha', 'pato', 'ganso', 'avestruz']).optional(),
  raridade: z.enum(['comum', 'raro', 'epico', 'lendario']).optional(),
  pronto: z.enum(['true', 'false']).optional(),
  ordenar: z.enum(['slot', 'raridade', 'vida', 'proximoRendimento', 'nome', 'chegada']).default('slot'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(200).optional(),
});

export const TransactionsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(300).optional(),
});

// ---------------------------------------------------------------- autenticação (só membros cadastrados)
const email = z.email({ error: 'E-mail inválido.' }).max(254, 'E-mail muito longo.').transform((e) => e.trim().toLowerCase());
const senha = z.string().min(8, 'A senha precisa de pelo menos 8 caracteres.').max(128, 'Senha muito longa (máximo 128).');
const nomeMembro = z
  .string()
  .trim()
  .min(2, 'Digite seu nome.')
  .max(60, 'Nome muito longo (máximo 60 caracteres).')
  .regex(/^\p{L}[\p{L}\p{M}' .-]*$/u, 'Use só letras, espaços, hífen, apóstrofo ou ponto no nome.')
  .transform((n) => n.replace(/\s+/g, ' '));
const telefone = z
  .string()
  .max(30, 'Telefone inválido.')
  .transform((t, ctx) => {
    const n = normalizarTelefone(t);
    if (!n) {
      ctx.addIssue({ code: 'custom', message: 'Telefone inválido: use DDD + número, ex.: (11) 98765-4321.' });
      return z.NEVER;
    }
    return n;
  });

/** Código do link de convite: 6 a 10 letras/dígitos sem os ambíguos (I, O, 0, 1). */
export const CODIGO_CONVITE = /^[A-HJ-NP-Z2-9]{6,10}$/;
/** Código como o membro digitou ("gal 7k3-q9p") → como é guardado ("GAL7K3Q9P"). */
export const normalizarConvite = (s: string): string => s.toUpperCase().replace(/[\s-]/g, '');
const conviteOpcional = z
  .string()
  .max(30, 'Código de convite inválido.')
  .optional()
  .transform((s) => (s ? normalizarConvite(s) : '') || undefined)
  .pipe(z.string().regex(CODIGO_CONVITE, 'Código de convite inválido.').optional());

/** Cadastro de membro: nome, telefone (BR), e-mail e senha — tudo obrigatório; o convite é opcional. */
export const CadastrarBody = z.object({ nome: nomeMembro, telefone, email, senha, convite: conviteOpcional });
export const EntrarEmailBody = z.object({ email, senha: z.string().min(1, 'Digite a senha.').max(128) });
export const RedefinirSenhaBody = z.object({
  email,
  codigoRecuperacao: z.string().trim().min(8, 'Código de recuperação inválido.').max(32),
  novaSenha: senha,
});

export interface SessaoDTO { autenticado: boolean; conta: ContaDTO | null }
/** Resposta do cadastro: o código de recuperação aparece uma única vez. */
export interface CadastroResposta { conta: ContaDTO; codigoRecuperacao: string }

// ---------------------------------------------------------------- avisos (popups) e atendimento: lado do jogador
export interface PopupDTO {
  id: string;
  titulo: string;
  mensagem: string;
  imagemUrl: string | null;
  botaoTexto: string | null;
  /** '/rota' do jogo ou endereço https:// externo; null = o botão só fecha. */
  link: string | null;
}
/** Consultado pelo jogo a cada ~45 s e ao voltar para a aba. */
export interface AvisosDTO { popups: PopupDTO[]; suporteNaoLidas: number }

export type AutorMensagem = 'jogador' | 'admin' | 'sistema';
export interface MensagemSuporteDTO { id: number; autor: AutorMensagem; texto: string; criadoEm: string; adminNome?: string | null }
export interface ConversaSuporteDTO { id: string | null; status: 'aberta' | 'resolvida'; mensagens: MensagemSuporteDTO[] }
export const MensagemSuporteBody = z.object({
  texto: z.string().trim().min(1, 'Escreva uma mensagem.').max(2000, 'Mensagem muito longa (máximo 2000 caracteres).'),
});

// ---------------------------------------------------------------- painel administrador
/** Login próprio do painel (usuário e senha do ambiente, separados da conta do jogo). */
export const AdminEntrarBody = z.object({
  usuario: z.string().trim().min(1, 'Digite o usuário.').max(60, 'Usuário muito longo.'),
  senha: z.string().min(1, 'Digite a senha.').max(128, 'Senha muito longa.'),
});
export interface AdminSessaoDTO {
  autenticado: boolean;
  /** o login do painel está configurado no servidor (ADMIN_USUARIO e ADMIN_SENHA_HASH) */
  configurado: boolean;
  /** 'painel' = login do painel; 'jogo' = conta do jogo com papel de admin */
  via: 'painel' | 'jogo' | null;
  nome: string | null;
  usuario: string | null;
}
const motivo = z.string().trim().min(3, 'Explique o motivo (mínimo 3 caracteres).').max(300, 'Motivo muito longo.');
const ITENS_OVO = ['ovo_galinha', 'ovo_pato', 'ovo_ganso', 'ovo_avestruz'] as const;
const TIPOS_ANIMAL = ['galinha', 'pato', 'ganso', 'avestruz'] as const;

export interface AdminUsuarioLinhaDTO {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  papel: 'jogador' | 'admin';
  bloqueado: boolean;
  bloqueioMotivo: string | null;
  /** quando foi bloqueada (null se não está) */
  bloqueadoEm: string | null;
  criadoEm: string;
  ultimoAcessoEm: string | null;
  moedasX100: number;
  nivel: number;
  animaisAtivos: number;
  ovosEstoque: number;
  suporteNaoLidas: number;
}
export interface AdminListaUsuariosDTO { itens: AdminUsuarioLinhaDTO[]; total: number; pagina: number; porPagina: number }
export const AdminUsuariosQuery = z.object({
  q: z.string().trim().max(100).optional(),
  filtro: z.enum(['todos', 'ativos7d', 'inativos7d', 'bloqueados', 'admins']).default('todos'),
  ordenar: z.enum(['recentes', 'acesso', 'moedas', 'nome']).default('recentes'),
  pagina: z.coerce.number().int().min(1).max(100_000).default(1),
  porPagina: z.coerce.number().int().min(5).max(100).default(25),
  /** só estas contas (ids separados por vírgula, até 100) — ex.: nomes dos membros escolhidos num popup */
  ids: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : undefined))
    .pipe(z.array(z.uuid({ error: 'Id de conta inválido.' })).max(100).optional()),
});

export interface AdminAcaoDTO {
  id: number;
  adminId: string | null;
  adminNome: string | null;
  acao: string;
  alvoContaId: string | null;
  alvoNome: string | null;
  detalhes: Record<string, unknown>;
  criadoEm: string;
}
export interface AdminListaAcoesDTO { itens: AdminAcaoDTO[]; total: number; pagina: number; porPagina: number }
export const AdminAuditoriaQuery = z.object({
  pagina: z.coerce.number().int().min(1).max(100_000).default(1),
  porPagina: z.coerce.number().int().min(5).max(100).default(50),
});

export interface AdminUsuarioDetalheDTO {
  usuario: AdminUsuarioLinhaDTO;
  jogo: { tutorialEtapa: number; capacidade: number; inventario: Inventario; entidades: EntityDTO[]; aposentados: number };
  estatisticas: {
    coletas: number;
    ovosColetados: number;
    ovosVendidos: number;
    giros: number;
    moedasGanhasX100: number;
    moedasGastasX100: number;
    diasAtivos30: number;
  };
  /** 30 mais recentes. */
  transacoes: TransacaoDTO[];
  suporte: { conversaId: string | null; status: 'aberta' | 'resolvida' | null; naoLidas: number; ultimaMensagemEm: string | null };
  /** 30 mais recentes sobre este usuário. */
  auditoria: AdminAcaoDTO[];
  /** tickets do Intercâmbio: saldo e últimos 20 movimentos */
  tickets: { saldo: number; movimentos: MovimentoTicketDTO[] };
  afiliacao: {
    codigo: string | null;
    indicadoPor: { id: string; nome: string } | null;
    diretos: number;
    /** membros na rede abaixo (até 5 níveis) */
    rede: number;
    comissoesRecebidasX100: number;
    /** Bônus de quem se cadastra por este link. Null segue o bônus geral. */
    bonusLinkX100: number | null;
    /** Bônus de quem entra sem valor próprio no link, ou sem convite. */
    bonusGeralX100: number;
  };
  /** Bônus que este membro recebeu no cadastro. A equipe libera na ficha; o plano libera sozinho. */
  bonusSaque: { liberadoPelaEquipe: boolean; liberadoPeloPlano: boolean; recebidoX100: number };
  /** Como este membro paga a roleta e a ampliação. */
  cobranca: {
    meio: 'pix' | 'usdt';
    /** Há carteira USDT configurada em Pagamentos. */
    carteiraPronta: boolean;
    abertas: AdminCobrancaUsdtDTO[];
  };
}

export interface AdminCobrancaUsdtDTO {
  id: string;
  tipo: 'roleta' | 'ampliacao';
  centavos: number;
  valorUsdtX100: number;
  rede: string;
  criadoEm: string;
}

export const AdminEditarUsuarioBody = z
  .object({ nome: nomeMembro.optional(), telefone: telefone.optional(), email: email.optional(), papel: z.enum(['jogador', 'admin']).optional() })
  .refine((o) => Object.values(o).some((v) => v !== undefined), 'Nada para alterar.');
export const AdminBloquearBody = z.object({ motivo });
export const AdminBonusSaqueBody = z.object({ liberado: z.boolean() });
const bonusCadastroX100 = z
  .number()
  .int('Use centavos inteiros.')
  .min(0, 'O bônus não pode ser negativo.')
  .max(100_000, 'O máximo é R$ 1.000,00.');
/** Null volta a usar o bônus geral. */
export const AdminBonusLinkBody = z.object({ bonusX100: bonusCadastroX100.nullable() });
export const AdminBonusGeralBody = z.object({ bonusX100: bonusCadastroX100 });
export const AdminCobrancaBody = z.object({ meio: z.enum(['pix', 'usdt']) });
export const AdminConfirmarUsdtBody = z.object({
  cobrancaId: z.uuid(),
  tipo: z.enum(['roleta', 'ampliacao']),
});
export const AdminUsdtConfigBody = z.object({
  rede: z.enum(['TRC20', 'ERC20', 'BEP20']),
  endereco: z.string().trim().max(128).refine((s) => s === '' || /^[A-Za-z0-9]{20,128}$/.test(s), 'Endereço USDT inválido.'),
  cotacaoCentavos: z.number().int().min(100, 'Mínimo de R$ 1,00 por USDT.').max(100_000, 'Máximo de R$ 1.000,00 por USDT.'),
});
/** Centésimos de USDT (100 = 1,00) para um preço em centavos de real, arredondando para cima. */
export function valorUsdtX100(centavos: number, cotacaoCentavos: number): number {
  if (cotacaoCentavos <= 0) return 0;
  return Math.ceil((centavos * 100) / cotacaoCentavos);
}
export const AdminAjusteSaldoBody = z.object({
  valorX100: z
    .number()
    .int('Use centavos inteiros.')
    .refine((v) => v !== 0, 'O valor não pode ser zero.')
    .refine((v) => Math.abs(v) <= 100_000_000, 'Valor alto demais (máximo 1.000.000,00 por ajuste).'),
  motivo,
});
export const AdminAjusteOvosBody = z.object({
  item: z.enum(ITENS_OVO),
  quantidade: z
    .number()
    .int()
    .refine((v) => v !== 0, 'A quantidade não pode ser zero.')
    .refine((v) => Math.abs(v) <= 100_000, 'Quantidade alta demais.'),
  motivo,
});
export const AdminDarAnimalBody = z.object({ tipo: z.enum(TIPOS_ANIMAL), motivo });
export const AdminNivelBody = z.object({ nivel: z.number().int().min(1).max(32), motivo });
export const AdminExcluirUsuarioBody = z.object({ confirmacao: z.literal('EXCLUIR', { error: 'Digite EXCLUIR para confirmar.' }), motivo });
export interface AdminCodigoRecuperacaoDTO { codigoRecuperacao: string }

export interface AdminConversaLinhaDTO {
  id: string;
  contaId: string;
  nome: string;
  email: string;
  telefone: string;
  status: 'aberta' | 'resolvida';
  naoLidas: number;
  ultimaMensagemEm: string | null;
  ultimaMensagem: string | null;
  ultimoAutor: AutorMensagem | null;
}
export interface AdminListaConversasDTO { itens: AdminConversaLinhaDTO[]; naoLidasTotal: number; abertas: number }
export interface AdminConversaDTO { conversa: AdminConversaLinhaDTO; mensagens: MensagemSuporteDTO[] }
export const AdminConversasQuery = z.object({
  status: z.enum(['aberta', 'resolvida', 'todas']).default('aberta'),
  q: z.string().trim().max(100).optional(),
});
export const AdminConversaPatchBody = z.object({ status: z.enum(['aberta', 'resolvida']) });
/** Admin inicia (ou continua) a conversa com um membro a partir da ficha dele. */
export const AdminNovaConversaBody = z.object({ contaId: z.uuid(), texto: MensagemSuporteBody.shape.texto });

const linkPopup = z
  .string()
  .trim()
  .max(500, 'Link muito longo.')
  .refine((l) => /^\/[^/]/.test(l) || /^https:\/\/[^\s]+$/.test(l), 'Use um caminho do jogo (ex.: /roleta) ou um endereço https://');
const imagemPopup = z.string().trim().max(500).regex(/^https:\/\/[^\s]+$/, 'A imagem precisa ser um endereço https://');
export const AdminPopupBody = z
  .object({
    titulo: z.string().trim().min(1, 'Dê um título.').max(80, 'Título muito longo (máximo 80).'),
    mensagem: z.string().trim().min(1, 'Escreva a mensagem.').max(1000, 'Mensagem muito longa (máximo 1000).'),
    imagemUrl: imagemPopup.nullable().default(null),
    botaoTexto: z.string().trim().min(1).max(30, 'Texto do botão muito longo (máximo 30).').nullable().default(null),
    link: linkPopup.nullable().default(null),
    publico: z.enum(['todos', 'contas']).default('todos'),
    contas: z.array(z.uuid()).max(5000).default([]),
    frequencia: z.enum(['uma_vez', 'diaria', 'sempre']).default('uma_vez'),
    inicio: z.iso.datetime({ offset: true }).optional(),
    fim: z.iso.datetime({ offset: true }).nullable().default(null),
    ativo: z.boolean().default(true),
  })
  .refine((p) => p.publico === 'todos' || p.contas.length > 0, { message: 'Escolha pelo menos um usuário.', path: ['contas'] });
export const AdminPopupPatchBody = z.object({
  titulo: z.string().trim().min(1, 'Dê um título.').max(80, 'Título muito longo (máximo 80).').optional(),
  mensagem: z.string().trim().min(1, 'Escreva a mensagem.').max(1000, 'Mensagem muito longa (máximo 1000).').optional(),
  imagemUrl: imagemPopup.nullable().optional(),
  botaoTexto: z.string().trim().min(1).max(30, 'Texto do botão muito longo (máximo 30).').nullable().optional(),
  link: linkPopup.nullable().optional(),
  publico: z.enum(['todos', 'contas']).optional(),
  contas: z.array(z.uuid()).max(5000).optional(),
  frequencia: z.enum(['uma_vez', 'diaria', 'sempre']).optional(),
  inicio: z.iso.datetime({ offset: true }).optional(),
  fim: z.iso.datetime({ offset: true }).nullable().optional(),
  ativo: z.boolean().optional(),
});
export interface AdminPopupDTO extends PopupDTO {
  publico: 'todos' | 'contas';
  contas: string[];
  frequencia: 'uma_vez' | 'diaria' | 'sempre';
  inicio: string;
  fim: string | null;
  ativo: boolean;
  criadoEm: string;
  /** pessoas = quantos membros viram; exibicoes = total de vezes; cliques = quantos tocaram no botão com link. */
  estatisticas: { pessoas: number; exibicoes: number; cliques: number };
}

export interface AdminResumoDTO {
  hoje: string;
  pessoas: { membros: number; novosHoje: number; novos7d: number; ativosHoje: number; ativos7d: number; ativos30d: number; bloqueados: number; admins: number };
  economia: {
    moedasCirculacaoX100: number;
    emitidasHojeX100: number;
    gastasHojeX100: number;
    ovosEstoque: number;
    ovosColetadosHoje: number;
    girosHoje: number;
    animaisAtivos: Record<'galinha' | 'pato' | 'ganso' | 'avestruz', number>;
  };
  suporte: { abertas: number; naoLidas: number };
  popupsAtivos: number;
}

export interface SerieDTO { dia: string; valor: number }
export interface SerieProjetadaDTO { dia: string; valor: number; min: number; max: number }
export interface AdminGraficosDTO {
  geradoEm: string;
  pessoas: {
    novos: SerieDTO[];
    total: SerieDTO[];
    ativos: SerieDTO[];
    projecaoNovos: SerieProjetadaDTO[];
    projecaoTotal: SerieProjetadaDTO[];
    projecaoAtivos: SerieProjetadaDTO[];
  };
  ovos: {
    produzidos: SerieDTO[];
    vendidos: SerieDTO[];
    /** tendência dos últimos dias (regressão linear) */
    projecaoTendencia: SerieProjetadaDTO[];
    /** teto: os animais ativos hoje, se todo ciclo pronto for coletado na hora (sem animais novos) */
    projecaoPotencial: SerieDTO[];
  };
  moedas: {
    emitidasX100: SerieDTO[];
    gastasX100: SerieDTO[];
    circulacaoX100: SerieDTO[];
    projecaoEmitidasX100: SerieProjetadaDTO[];
    projecaoGastasX100: SerieProjetadaDTO[];
    projecaoCirculacaoX100: SerieProjetadaDTO[];
    /** se todos os ovos potenciais forem vendidos */
    potencialEmissaoX100: SerieDTO[];
  };
}
export const AdminGraficosQuery = z.object({
  dias: z.coerce.number().int().min(7).max(365).default(30),
  projecao: z.coerce.number().int().min(7).max(180).default(30),
});

// ---------------------------------------------------------------- convites e afiliação (só moedas do jogo)
// Quem convida ganha uma comissão sobre as VENDAS DE OVOS dos indicados, em vários níveis (quem ele convidou,
// quem esses convidaram…). Paga pelo jogo, em moedas do jogo: o indicado não perde nada e nada vira dinheiro.

export interface ConfigAfiliadosDTO {
  ativo: boolean;
  /** % de cada nível em pontos-base (1000 = 10%); o tamanho é o número de níveis (1 a 5) */
  comissoesBp: number[];
  /** teto de comissões que um membro recebe por dia (null = sem teto) */
  tetoDiarioX100: number | null;
}
/** Indicado direto, como o membro que convidou o vê (nome curto, sem contato). */
export interface IndicadoDTO {
  nome: string;
  desde: string;
  ativo7d: boolean;
  /** comissões que este indicado já rendeu para quem convidou */
  rendeuX100: number;
}
export interface ComissaoDTO {
  id: number;
  nivel: number;
  /** nome curto de quem vendeu os ovos ("Ana L.") */
  origem: string | null;
  baseX100: number;
  valorX100: number;
  criadoEm: string;
}
export interface MeuConviteDTO {
  codigo: string;
  /** caminho do link (o app junta com o próprio endereço): /c/CODIGO */
  caminho: string;
  config: ConfigAfiliadosDTO;
  /** quem convidou este membro ("Ana L."), se alguém convidou */
  indicadoPor: string | null;
  /** quantos membros em cada nível da rede (índice 0 = nível 1) */
  rede: number[];
  ganhos: { hojeX100: number; dias30X100: number; totalX100: number };
  /** indicados diretos, mais recentes primeiro (até 50) */
  indicados: IndicadoDTO[];
  totalIndicados: number;
  /** últimas 20 comissões recebidas */
  ultimas: ComissaoDTO[];
}
/** Conferência pública de um código (tela de cadastro): de quem é o convite. */
export interface ConviteValidoDTO { valido: boolean; indicador: string | null }

// painel
export const AdminConfigAfiliadosBody = z.object({
  ativo: z.boolean(),
  comissoesBp: z
    .array(z.number().int().min(0, 'A comissão não pode ser negativa.').max(5000, 'Máximo de 50% por nível.'))
    .min(1, 'Defina pelo menos 1 nível.')
    .max(5, 'No máximo 5 níveis.'),
  tetoDiarioX100: z.number().int().min(100, 'Teto mínimo de 1,00 moeda.').max(100_000_000).nullable(),
});
export const AdminAfiliadosQuery = z.object({
  dias: z.coerce.number().int().min(7).max(365).default(30),
  ordenar: z.enum(['rede', 'diretos', 'comissoes']).default('rede'),
});
export interface AdminAfiliadoLinhaDTO {
  id: string;
  nome: string;
  email: string;
  codigo: string | null;
  diretos: number;
  /** membros na rede abaixo (até 5 níveis) */
  rede: number;
  comissoesPeriodoX100: number;
  comissoesTotalX100: number;
}
export interface AdminAfiliadosDTO {
  config: ConfigAfiliadosDTO;
  configAtualizadaEm: string;
  totais: {
    membros: number;
    /** membros que entraram por convite */
    indicados: number;
    /** membros com pelo menos 1 indicado */
    indicadores: number;
    comissoesPeriodoX100: number;
    comissoesTotalX100: number;
    beneficiariosPeriodo: number;
  };
  /** comissões do período por nível */
  porNivel: { nivel: number; valorX100: number; beneficiarios: number }[];
  /** por dia: cadastros, cadastros por convite e comissões pagas */
  serie: { dia: string; cadastros: number; indicados: number; comissoesX100: number }[];
  /** os 20 primeiros pela ordem pedida */
  ranking: AdminAfiliadoLinhaDTO[];
}
export interface AdminRedeMembroDTO {
  id: string;
  nome: string;
  email: string;
  criadoEm: string;
  ultimoAcessoEm: string | null;
  bloqueado: boolean;
  /** indicados diretos dele */
  diretos: number;
  /** comissões que ele rendeu para o membro consultado */
  rendeuX100: number;
}
export interface AdminRedeDTO {
  conta: { id: string; nome: string; email: string; codigo: string | null; criadoEm: string; indicadoEm: string | null };
  /** quem está acima: nível 1 = quem convidou, 2 = quem convidou essa pessoa… */
  acima: { id: string; nome: string; nivel: number }[];
  /** quantos em cada nível abaixo (índice 0 = nível 1) */
  niveis: number[];
  /** indicados diretos (até 200) */
  diretos: AdminRedeMembroDTO[];
  comissoes: { recebidasX100: number; geradasX100: number };
  ultimas: ComissaoDTO[];
}

// ---------------------------------------------------------------- intercâmbio (tickets) e cupons — só itens do jogo
// TICKET é um vale do jogo que se troca por ovos ou animais no Intercâmbio (tabela de ofertas do painel). Vem de
// cupons (códigos da equipe), de ajustes da equipe e, se o painel ligar, da compra com moedas do jogo. Nunca de
// dinheiro real.

export interface OfertaIntercambioDTO {
  id: string;
  tipo: 'ovos' | 'animal';
  /** ovos: qual ovo e quantos */
  item: Item | null;
  quantidade: number | null;
  /** animal: qual espécie */
  animal: Tipo | null;
  custoTickets: number;
  ativo: boolean;
}
export interface MovimentoTicketDTO {
  id: number;
  motivo: 'compra' | 'cupom' | 'troca' | 'ajuste';
  delta: number;
  saldoApos: number;
  detalhes: Record<string, unknown>;
  criadoEm: string;
}
export interface ConfigIntercambioDTO {
  /** a tela de trocas está aberta */
  ativo: boolean;
  /** dá para comprar tickets com moedas do jogo */
  compraAtiva: boolean;
  precoTicketX100: number;
  /** máximo de tickets comprados por membro por dia (null = sem limite) */
  limiteCompraDia: number | null;
}
export interface IntercambioDTO {
  tickets: number;
  config: ConfigIntercambioDTO;
  /** tickets comprados hoje (para o limite diário) */
  compradosHoje: number;
  /** só as ofertas ativas, na ordem do painel */
  ofertas: OfertaIntercambioDTO[];
  /** últimos 20 movimentos de tickets */
  historico: MovimentoTicketDTO[];
}
export const IntercambioComprarBody = z.object({ quantidade: z.number().int().min(1, 'Compre pelo menos 1 ticket.').max(1000) });
export const IntercambioTrocarBody = z.object({ ofertaId: z.uuid() });
export interface CompraTicketsDTO { quantidade: number; custoX100: number; tickets: number; saldoX100: number }
export interface TrocaTicketsDTO {
  oferta: OfertaIntercambioDTO;
  tickets: number;
  inventario: Inventario;
  /** o animal recebido (ofertas de animal) */
  entity: EntityDTO | null;
}

/** Código de cupom: 4 a 20 letras e números (o membro pode digitar em minúsculas, com espaço ou traço). */
export const CODIGO_CUPOM = /^[A-Z0-9]{4,20}$/;
export const normalizarCupom = (s: string): string => s.toUpperCase().replace(/[\s-]/g, '');
const codigoCupom = z
  .string()
  .max(40, 'Código de cupom inválido.')
  .transform(normalizarCupom)
  .pipe(z.string().regex(CODIGO_CUPOM, 'Use de 4 a 20 letras e números.'));
export const CupomResgatarBody = z.object({ codigo: codigoCupom });
export interface CupomResgatadoDTO {
  codigo: string;
  tickets: number;
  saldoTickets: number;
  /** giros da roleta que este resgate deu (0 quando o cupom é de tickets) */
  giros: number;
  saldoGiros: number;
}

// painel
export const AdminIntercambioConfigBody = z.object({
  ativo: z.boolean(),
  compraAtiva: z.boolean(),
  precoTicketX100: z.number().int().min(1, 'Preço mínimo de 0,01 moeda.').max(100_000_000),
  limiteCompraDia: z.number().int().min(1).max(100_000).nullable(),
});
const tipoAnimal = z.enum(['galinha', 'pato', 'ganso', 'avestruz']);
const custoTickets = z.number().int().min(1, 'Custo mínimo de 1 ticket.').max(100_000, 'Custo muito alto.');
export const AdminOfertaBody = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('ovos'), item: itemSchema, quantidade: z.number().int().min(1, 'Pelo menos 1 ovo.').max(100_000), custoTickets, ativo: z.boolean().default(true) }),
  z.object({ tipo: z.literal('animal'), animal: tipoAnimal, custoTickets, ativo: z.boolean().default(true) }),
]);
export const AdminOfertaPatchBody = z
  .object({
    item: itemSchema.optional(),
    quantidade: z.number().int().min(1, 'Pelo menos 1 ovo.').max(100_000).optional(),
    animal: tipoAnimal.optional(),
    custoTickets: custoTickets.optional(),
    ativo: z.boolean().optional(),
    ordem: z.number().int().min(0).max(100_000).optional(),
  })
  .refine((o) => Object.values(o).some((v) => v !== undefined), 'Nada para alterar.');
export interface AdminOfertaDTO extends OfertaIntercambioDTO {
  ordem: number;
  /** quanto os ovos valem no mercado (só ofertas de ovos) */
  valorMercadoX100: number | null;
  trocasTotal: number;
  trocas30d: number;
}
export interface AdminIntercambioDTO {
  config: ConfigIntercambioDTO;
  configAtualizadaEm: string;
  /** soma das comissões de afiliação em vigor (pontos-base): entra na conta da regra "sem lucro" */
  comissaoTotalBp: number;
  ofertas: AdminOfertaDTO[];
  /** últimos 30 dias, exceto a circulação (agora) */
  estatisticas: {
    ticketsCirculacao: number;
    comprados30d: number;
    cupons30d: number;
    ajustes30d: number;
    trocados30d: number;
    moedasCompra30dX100: number;
  };
}
export type BeneficioCupom = 'tickets' | 'giros';
export interface AdminCupomDTO {
  id: string;
  codigo: string;
  descricao: string | null;
  beneficio: BeneficioCupom;
  tickets: number;
  giros: number;
  usosMax: number | null;
  usos: number;
  inicio: string;
  fim: string | null;
  ativo: boolean;
  criadoEm: string;
  criadoPor: string | null;
}
const beneficioCupom = z.enum(['tickets', 'giros']);
export const AdminCupomBody = z.object({
  codigo: codigoCupom,
  descricao: z.string().trim().max(200, 'Descrição muito longa (máximo 200).').nullable().default(null),
  beneficio: beneficioCupom.default('tickets'),
  tickets: z.number().int().min(0).max(10_000).default(0),
  giros: z.number().int().min(0).max(10_000).default(0),
  usosMax: z.number().int().min(1).max(10_000_000).nullable().default(null),
  inicio: z.iso.datetime({ offset: true }).optional(),
  fim: z.iso.datetime({ offset: true }).nullable().default(null),
  ativo: z.boolean().default(true),
}).superRefine((d, ctx) => {
  if (d.beneficio === 'tickets' && d.tickets < 1) {
    ctx.addIssue({ code: 'custom', path: ['tickets'], message: 'Pelo menos 1 ticket.' });
  }
  if (d.beneficio === 'giros' && d.giros < 1) {
    ctx.addIssue({ code: 'custom', path: ['tickets'], message: 'Pelo menos 1 giro.' });
  }
});
export const AdminCupomPatchBody = z
  .object({
    descricao: z.string().trim().max(200, 'Descrição muito longa (máximo 200).').nullable().optional(),
    beneficio: beneficioCupom.optional(),
    tickets: z.number().int().min(0).max(10_000).optional(),
    giros: z.number().int().min(0).max(10_000).optional(),
    usosMax: z.number().int().min(1).max(10_000_000).nullable().optional(),
    inicio: z.iso.datetime({ offset: true }).optional(),
    fim: z.iso.datetime({ offset: true }).nullable().optional(),
    ativo: z.boolean().optional(),
  })
  .refine((o) => Object.values(o).some((v) => v !== undefined), 'Nada para alterar.');
export interface AdminCupomResgateDTO { contaId: string; nome: string; email: string; tickets: number; giros: number; criadoEm: string }
export interface AdminCupomDetalheDTO { cupom: AdminCupomDTO; resgates: AdminCupomResgateDTO[] }
export const AdminAjusteTicketsBody = z.object({
  quantidade: z.number().int().min(-100_000).max(100_000).refine((v) => v !== 0, 'Informe uma quantidade diferente de zero.'),
  motivo,
});

// ---------------------------------------------------------------- saque PIX (LofyPay)
export type StatusSaque = 'processando' | 'pago' | 'falhou';
export interface SaqueDTO {
  id: string;
  /** Valor debitado do saldo. */
  centavos: number;
  taxaCentavos: number;
  /** O que segue para o PIX, depois da taxa. */
  liquidoCentavos: number;
  cpfMascarado: string;
  status: StatusSaque;
  criadoEm: string;
}
export interface ListaSaquesDTO {
  itens: SaqueDTO[];
  /** Menor valor debitado do saldo. O PIX recebe pelo menos o mínimo líquido. */
  minimoCentavos: number;
  taxaFixaCentavos: number;
  /** 400 = 4%. */
  taxaPercentualBp: number;
  /** Quanto pode sair agora. Sem plano, o bônus fica de fora. Venda de ovos das últimas 24 h também fica de fora. */
  disponivelCentavos: number;
  bonusBloqueadoCentavos: number;
  /** Vendas de ovos das últimas 24 h que ainda não entram no saque. Só nos 3 primeiros dias da conta. */
  rendimentosBloqueadosCentavos: number;
  /** Nos 3 primeiros dias, o rendimento das galinhas espera 24 h. Depois disso entra na hora. */
  carenciaRendimento: boolean;
  planoAtivo: boolean;
  /** Bônus que este membro recebeu no cadastro. É o valor travado no saque até o plano. */
  bonusCentavos: number;
}
export interface SaqueCriadoDTO { saque: SaqueDTO; saldoX100: number }
export const SaqueBody = z.object({
  centavos: z.number().int().min(100, 'O mínimo é R$ 1,00.').max(100_000_00, 'Valor acima do limite.'),
  cpf: z.string().trim().min(11, 'Informe o CPF.').max(14),
  nome: z.string().trim().min(3, 'Informe o nome completo.').max(80, 'Nome muito longo.'),
});

// ---------------------------------------------------------------- giro da roleta pago com PIX
export type StatusCobrancaRoleta = 'aguardando' | 'pago' | 'usado' | 'expirado' | 'falhou';
export interface CobrancaRoletaDTO {
  id: string;
  centavos: number;
  status: StatusCobrancaRoleta;
  copiaCola: string;
  qrDataUrl: string;
  expiraEm: string;
  meio: 'pix' | 'usdt';
  /** Rede do USDT (TRC20, ERC20, BEP20). Null no PIX. */
  rede: string | null;
  /** Centésimos de USDT. Null no PIX. */
  valorUsdtX100: number | null;
}
export const ConsultaCobrancaRoleta = z.object({ id: z.uuid() });
export const SpinBody = z.object({ cobrancaId: z.uuid().optional() });
export const AmpliarBody = z.object({ cobrancaId: z.uuid().optional() });

// ---------------------------------------------------------------- notificações push
export const PushAssinaturaBody = z.object({
  endpoint: z.url().max(2048),
  keys: z.object({ p256dh: z.string().min(10).max(512), auth: z.string().min(8).max(256) }),
  fusoMin: z.number().int().min(-14 * 60).max(14 * 60),
});
export const PushRemoverBody = z.object({ endpoint: z.url().max(2048) });

// ---------------------------------------------------------------- relógio de desenvolvimento
export const DevRelogioBody = z.object({ horas: z.number().min(-24 * 365).max(24 * 365) });
