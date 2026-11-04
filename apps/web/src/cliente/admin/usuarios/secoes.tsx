'use client';

// Seções da ficha do membro (painel): cabeçalho, números-chave, economia, galinheiro, atendimento, perfil,
// afiliação (convites), tickets do Intercâmbio, acesso/segurança, extrato, auditoria e zona de perigo. Os botões só chamam
// `abrir(ação)` (os tickets, `aoAjustar`): quem confirma e executa são os modais (modais.tsx).
import {
  formatarTelefone, type AdminAcaoDTO, type AdminUsuarioDetalheDTO, type EntityDTO, type MovimentoTicketDTO, type TransacaoDTO,
} from '@galinheiro/api-contract';
import {
  ANIMAIS, CONFIG, ITENS, NOME_RARIDADE, NOME_TIER, NOME_TIPO, formatarDuracao, tierDe, tipoDoItem, totalDeOvos, vidaExibida,
} from '@galinheiro/game-core';
import {
  ArrowLeftRight, ArrowUpRight, Ban, Banknote, Bird, CalendarDays, ChevronDown, ChevronUp, Clock, Coins, Egg, ExternalLink, Gift, Hammer, Hourglass, KeyRound,
  Layers, Lock, LockOpen, LogOut, Mail, MessageSquarePlus, MessagesSquare, Network, Pencil, Ticket, TicketPercent, Phone, Plus, Minus, ReceiptText,
  ScrollText, Send, ShieldCheck, ShoppingCart, SlidersHorizontal, Sparkles, Trash, TriangleAlert, UserRound, UserRoundCog, Warehouse, Wrench,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { FiguraAnimal } from '../../arte/Animal';
import { IconeRoleta, Moeda, Ovo } from '../../arte/Icones';
import { diasRestantesAgora, estaProntoAgora, humorDe, vidaDe } from '../../derivados';
import { COR_RARIDADE, COR_TIER, cx } from '../../util';
import { IconeTicket } from '../intercambio/comum';
import { descreverMovimento, textoTickets } from '../intercambio/formato';
import { BotaoAdm, Cartao, Kpi, Selo, Vazio, fmt } from '../ui';
import { Avatar, BotaoCopiar, UltimoAcesso, plural, primeiroNome, type AcaoFicha } from './comum';
import { descreverAcao, descreverTransacao, etapaTutorial, nomeOvos, type GrupoAcao } from './textos';

export interface PropsSecao {
  d: AdminUsuarioDetalheDTO;
  agora: number;
  /** a conta aberta é a do próprio admin logado */
  proprio: boolean;
  abrir: (a: AcaoFicha) => void;
  className?: string;
}

const LIMITE_LISTA = 8;

function TituloSecao({ icone: Icone, children }: { icone: LucideIcon; children: ReactNode }) {
  return (
    <span className="adm-us-titulo-secao">
      <Icone className="h-[18px] w-[18px]" aria-hidden />
      {children}
    </span>
  );
}

/** Valor de venda do estoque (sem lançar erro com dados estranhos). */
function valorDoEstoqueX100(inv: AdminUsuarioDetalheDTO['jogo']['inventario']): number {
  return ITENS.reduce((s, i) => s + Math.max(0, inv[i] ?? 0) * ANIMAIS[tipoDoItem(i)].precoOvoX100, 0);
}

// ---------------------------------------------------------------- cabeçalho

export function CabecalhoFicha({ d, agora, proprio, abrir }: PropsSecao) {
  const u = d.usuario;
  const digitos = u.telefone.replace(/\D/g, '');
  const dias = Math.max(0, Math.floor((agora - Date.parse(u.criadoEm)) / 86_400_000));
  return (
    <section className="adm-cartao adm-us-cabeca" aria-label="Membro">
      {u.bloqueado && (
        <div className="adm-us-faixa-bloqueio" role="status">
          <Ban className="h-5 w-5 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1">
            <strong>Conta bloqueada{u.bloqueadoEm ? ` desde ${fmt.dataHora(u.bloqueadoEm)}` : ''}.</strong>{' '}
            {u.bloqueioMotivo ? <>Motivo: “{u.bloqueioMotivo}”. </> : null}
            O membro não consegue entrar no jogo.
          </p>
          <BotaoAdm tamanho="p" onClick={() => abrir({ tipo: 'desbloquear' })}>
            <LockOpen className="h-4 w-4" aria-hidden /> Desbloquear
          </BotaoAdm>
        </div>
      )}
      <div className="adm-us-cabeca-corpo">
        <Avatar id={u.id} nome={u.nome} tamanho="g" />
        <div className="adm-us-cabeca-info">
          <div className="adm-us-cabeca-titulo">
            <h1 className="adm-us-ficha-nome">{u.nome}</h1>
            {u.papel === 'admin' ? (
              <Selo tom="roxo">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Administrador
              </Selo>
            ) : (
              <Selo>Jogador</Selo>
            )}
            {u.bloqueado && (
              <span title={u.bloqueioMotivo ? `Motivo: ${u.bloqueioMotivo}` : undefined}>
                <Selo tom="vermelho">
                  <Ban className="h-3.5 w-3.5" aria-hidden /> Bloqueado
                </Selo>
              </span>
            )}
            {proprio && <Selo tom="azul">Você</Selo>}
          </div>
          <div className="adm-us-contatos">
            <span className="adm-us-contato">
              <Mail className="h-4 w-4 shrink-0" aria-hidden />
              <a href={`mailto:${u.email}`} className="adm-us-link truncate">
                {u.email}
              </a>
              <BotaoCopiar texto={u.email} rotulo="e-mail" />
            </span>
            <span className="adm-us-contato">
              <Phone className="h-4 w-4 shrink-0" aria-hidden />
              <span className="tabular-nums">{formatarTelefone(u.telefone)}</span>
              <BotaoCopiar texto={formatarTelefone(u.telefone)} rotulo="telefone" />
              <a className="adm-us-pilula" href={`tel:${u.telefone}`}>
                Ligar
              </a>
              <a className="adm-us-pilula" data-tom="verde" href={`https://wa.me/${digitos}`} target="_blank" rel="noopener noreferrer">
                WhatsApp <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </span>
          </div>
          <p className="adm-us-meta">
            <span>
              <CalendarDays className="h-4 w-4" aria-hidden />
              Membro desde {new Date(u.criadoEm).toLocaleDateString('pt-BR')} ({dias === 0 ? 'hoje' : `há ${plural(dias, 'dia', 'dias')}`})
            </span>
            <span>
              <Clock className="h-4 w-4" aria-hidden />
              Último acesso: <UltimoAcesso iso={u.ultimoAcessoEm} agora={agora} />
            </span>
          </p>
        </div>
        <div className="adm-us-cabeca-acoes">
          <BotaoAdm onClick={() => abrir({ tipo: 'perfil' })}>
            <Pencil className="h-4 w-4" aria-hidden /> Editar perfil
          </BotaoAdm>
          {d.suporte.conversaId ? (
            <Link href={`/admin/atendimento?c=${d.suporte.conversaId}`} className="adm-botao" data-variante="primario">
              <MessagesSquare className="h-4 w-4" aria-hidden /> Abrir conversa
              {d.suporte.naoLidas > 0 && <span className="adm-us-bolha">{d.suporte.naoLidas}</span>}
            </Link>
          ) : (
            <BotaoAdm variante="primario" onClick={() => abrir({ tipo: 'mensagem' })}>
              <MessageSquarePlus className="h-4 w-4" aria-hidden /> Enviar mensagem
            </BotaoAdm>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- números-chave

export function KpisFicha({ d }: { d: AdminUsuarioDetalheDTO }) {
  const u = d.usuario;
  const ovos = totalDeOvos(d.jogo.inventario);
  const ocupados = d.jogo.entidades.length;
  const livres = Math.max(0, d.jogo.capacidade - ocupados);
  return (
    <div className="adm-us-kpis">
      <Kpi rotulo="Saldo" valor={fmt.moedas(u.moedasX100)} detalhe="moedas do jogo" tom="ambar" icone={<Moeda className="h-5 w-5" />} />
      <Kpi
        rotulo="Ovos"
        valor={fmt.int(ovos)}
        detalhe={`no estoque · valem ${fmt.moedas(valorDoEstoqueX100(d.jogo.inventario))}`}
        tom="azul"
        icone={<Ovo tipo="galinha" className="h-5 w-5" />}
      />
      <Kpi
        rotulo="Animais"
        valor={
          <>
            {ocupados}
            <span className="adm-us-kpi-de">/{d.jogo.capacidade}</span>
          </>
        }
        detalhe={livres ? plural(livres, 'ninho livre', 'ninhos livres') : 'galinheiro cheio'}
        tom="verde"
        icone={<Bird className="h-4 w-4" />}
      />
      <Kpi
        rotulo="Nível"
        valor={
          <>
            {u.nivel}
            <span className="adm-us-kpi-de">/{CONFIG.galinheiro.nivelMax}</span>
          </>
        }
        detalhe={`${d.jogo.capacidade} ninhos`}
        tom="roxo"
        icone={<Warehouse className="h-4 w-4" />}
      />
      <Kpi
        rotulo="Atividade"
        valor={
          <>
            {d.estatisticas.diasAtivos30}
            <span className="adm-us-kpi-de">/30</span>
          </>
        }
        detalhe="dias ativos no último mês"
        icone={<CalendarDays className="h-4 w-4" />}
      />
    </div>
  );
}

// ---------------------------------------------------------------- economia

function Estatistica({ rotulo, valor, tom, fracao }: { rotulo: string; valor: ReactNode; tom?: 'verde' | 'vermelho'; fracao?: number }) {
  return (
    <div className="adm-us-stat" data-tom={tom}>
      <dt>{rotulo}</dt>
      <dd>{valor}</dd>
      {fracao !== undefined && (
        <span className="adm-us-stat-barra" aria-hidden>
          <span style={{ width: `${Math.min(100, Math.max(0, fracao * 100))}%` }} />
        </span>
      )}
    </div>
  );
}

export function SecaoEconomia({ d, abrir, className }: PropsSecao) {
  const u = d.usuario;
  const inv = d.jogo.inventario;
  const e = d.estatisticas;
  return (
    <Cartao className={className} titulo={<TituloSecao icone={Coins}>Economia</TituloSecao>}>
      <div className="adm-us-saldo">
        <div className="min-w-0">
          <p className="adm-us-rotulo">Saldo atual</p>
          <p className="adm-us-saldo-valor">
            <Moeda className="h-8 w-8 shrink-0" />
            {fmt.moedas(u.moedasX100)}
            <span>moedas</span>
          </p>
        </div>
        <div className="adm-us-botoes">
          <BotaoAdm variante="primario" onClick={() => abrir({ tipo: 'saldo', sentido: 'creditar' })}>
            <Plus className="h-4 w-4" aria-hidden /> Creditar
          </BotaoAdm>
          <BotaoAdm onClick={() => abrir({ tipo: 'saldo', sentido: 'debitar' })} disabled={u.moedasX100 <= 0}>
            <Minus className="h-4 w-4" aria-hidden /> Debitar
          </BotaoAdm>
        </div>
      </div>

      <div className="adm-us-subtitulo">
        <h3>
          Bônus inicial no saque <span>· R$ {fmt.moedas(d.bonusSaque.recebidoX100)}</span>
        </h3>
        <BotaoAdm tamanho="p" onClick={() => abrir({ tipo: 'bonus-saque' })}>
          <Banknote className="h-4 w-4" aria-hidden />
          {d.bonusSaque.liberadoPelaEquipe ? 'Exigir a roleta' : 'Liberar para saque'}
        </BotaoAdm>
      </div>
      <p className="adm-us-texto">
        {d.bonusSaque.liberadoPelaEquipe
          ? 'Liberado pela equipe. Este membro saca o bônus sem PIX da roleta.'
          : d.bonusSaque.liberadoPeloPlano
            ? 'Já liberado pelo jogo: há um PIX da roleta pago ou um animal comprado ainda no galinheiro.'
            : 'Bloqueado. Só entra no saque depois do PIX da roleta pago e do giro, ou se a equipe liberar aqui.'}
      </p>

      <div className="adm-us-subtitulo">
        <h3>
          Cobrança <span>· {d.cobranca.meio === 'usdt' ? 'USDT' : 'PIX'}</span>
        </h3>
        <BotaoAdm tamanho="p" onClick={() => abrir({ tipo: 'cobranca' })}>
          <Banknote className="h-4 w-4" aria-hidden /> Alterar
        </BotaoAdm>
      </div>
      <p className="adm-us-texto">
        {d.cobranca.meio === 'usdt'
          ? `Roleta e ampliação mostram endereço, valor e QR em USDT.${d.cobranca.carteiraPronta ? '' : ' A carteira ainda não está configurada em Pagamentos.'}${d.cobranca.abertas.length ? ` ${d.cobranca.abertas.length === 1 ? 'Há 1 cobrança' : `Há ${d.cobranca.abertas.length} cobranças`} aguardando confirmação.` : ''}`
          : 'Roleta e ampliação cobram no PIX da gateway escolhida em Pagamentos.'}
      </p>

      <div className="adm-us-subtitulo">
        <h3>
          Ovos no estoque <span>· {fmt.int(totalDeOvos(inv))}</span>
        </h3>
        <BotaoAdm tamanho="p" onClick={() => abrir({ tipo: 'ovos' })}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden /> Ajustar ovos
        </BotaoAdm>
      </div>
      <div className="adm-us-ovos">
        {ITENS.map((i) => (
          <button key={i} type="button" className="adm-us-ovo" onClick={() => abrir({ tipo: 'ovos', item: i })} title={`Ajustar ${nomeOvos(i)}`}>
            <Ovo tipo={tipoDoItem(i)} className="adm-us-ovo-icone" />
            <span className="adm-us-ovo-n">{fmt.int(inv[i])}</span>
            <span className="adm-us-ovo-nome">{NOME_TIPO[tipoDoItem(i)]}</span>
          </button>
        ))}
      </div>

      <div className="adm-us-subtitulo">
        <h3>Atividade no jogo</h3>
      </div>
      <dl className="adm-us-stats">
        <Estatistica rotulo="Coletas" valor={fmt.int(e.coletas)} />
        <Estatistica rotulo="Ovos coletados" valor={fmt.int(e.ovosColetados)} />
        <Estatistica rotulo="Ovos vendidos" valor={fmt.int(e.ovosVendidos)} />
        <Estatistica rotulo="Giros na roleta" valor={fmt.int(e.giros)} />
        <Estatistica rotulo="Moedas ganhas" valor={`${e.moedasGanhasX100 > 0 ? '+' : ''}${fmt.moedas(e.moedasGanhasX100)}`} tom={e.moedasGanhasX100 > 0 ? 'verde' : undefined} />
        <Estatistica rotulo="Moedas gastas" valor={`${e.moedasGastasX100 > 0 ? '−' : ''}${fmt.moedas(e.moedasGastasX100)}`} tom={e.moedasGastasX100 > 0 ? 'vermelho' : undefined} />
        <Estatistica rotulo="Dias ativos (30 dias)" valor={`${e.diasAtivos30} de 30`} fracao={e.diasAtivos30 / 30} />
      </dl>
    </Cartao>
  );
}

// ---------------------------------------------------------------- galinheiro

const ORIGEM: Record<EntityDTO['origem'], string | null> = {
  ROLETA: null, BOAS_VINDAS: 'boas-vindas', SUPORTE: 'presente da equipe', INTERCAMBIO: 'intercâmbio',
};

function CartaoAnimal({ e, agora }: { e: EntityDTO; agora: number }) {
  const vida = vidaDe(e, agora);
  const tier = tierDe(vida) ?? 'triste';
  const pronto = estaProntoAgora(e, agora);
  const falta = Date.parse(e.proximoRendimento) - agora;
  // (o relógio sincronizado pode estar um tiquinho atrás do servidor: não passa da vida útil)
  const dias = Math.min(diasRestantesAgora(e, agora), Math.round(CONFIG.vida.vidaUtilMs / 86_400_000));
  const origem = ORIGEM[e.origem];
  return (
    <li className="adm-us-animal">
      <span className="adm-us-figura">
        <FiguraAnimal tipo={e.tipo} humor={humorDe(e, agora)} ninho={false} detalhe="p" className="h-12 w-12" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="adm-us-animal-topo">
          <p className="adm-us-animal-nome">{e.nome}</p>
          <span className="adm-us-animal-ninho">ninho {e.slotId ?? '—'}</span>
        </div>
        <p className="adm-us-animal-especie">
          <span className="adm-us-raridade" style={{ '--cor': COR_RARIDADE[e.raridade] } as CSSProperties}>
            {NOME_TIPO[e.tipo]} · {NOME_RARIDADE[e.raridade]}
          </span>
          {origem && <span className="adm-us-origem">{origem}</span>}
        </p>
        <div className="adm-us-vida" title={`Vida ${vidaExibida(vida)}% · humor ${NOME_TIER[tier].toLowerCase()}`}>
          <span className="adm-us-vida-barra" aria-hidden>
            <span style={{ width: `${vida}%`, background: COR_TIER[tier] }} />
          </span>
          <span className="adm-us-vida-n">{vidaExibida(vida)}%</span>
          <span className="adm-us-vida-humor">{NOME_TIER[tier]}</span>
        </div>
        <p className="adm-us-animal-rodape">
          {pronto ? (
            <span className="adm-us-pronto">
              <Egg className="h-3.5 w-3.5" aria-hidden /> Pronto para coletar
            </span>
          ) : (
            <span>
              <Hourglass className="h-3.5 w-3.5" aria-hidden /> {falta < 60_000 ? 'ovos em instantes' : `ovos em ${formatarDuracao(falta)}`}
            </span>
          )}
          <span>aposenta em {plural(dias, 'dia', 'dias')}</span>
        </p>
      </div>
    </li>
  );
}

export function SecaoGalinheiro({ d, agora, abrir, className }: PropsSecao) {
  const [todos, setTodos] = useState(false);
  const { capacidade, entidades, aposentados, tutorialEtapa } = d.jogo;
  const ocupados = entidades.length;
  const cheio = ocupados >= capacidade;
  const tutorial = etapaTutorial(tutorialEtapa);
  return (
    <Cartao
      className={className}
      titulo={<TituloSecao icone={Warehouse}>Galinheiro</TituloSecao>}
      acoes={
        <>
          <BotaoAdm tamanho="p" onClick={() => abrir({ tipo: 'nivel' })}>
            <Layers className="h-4 w-4" aria-hidden /> Definir nível
          </BotaoAdm>
          <BotaoAdm tamanho="p" variante="primario" onClick={() => abrir({ tipo: 'animal' })} title={cheio ? 'O galinheiro está cheio' : undefined}>
            <Plus className="h-4 w-4" aria-hidden /> Dar animal
          </BotaoAdm>
        </>
      }
    >
      <div className="adm-us-galinheiro">
        <div className="adm-us-ocupacao">
          <p>
            <span className="adm-us-ocupacao-nivel">
              <strong>Nível {d.usuario.nivel}</strong> · {plural(capacidade, 'ninho', 'ninhos')}
            </span>
            <span>
              {ocupados} {ocupados === 1 ? 'ocupado' : 'ocupados'}
              {cheio && ' · cheio'}
            </span>
          </p>
          <span className="adm-us-ocupacao-barra" data-cheio={cheio || undefined} aria-hidden>
            <span style={{ width: `${capacidade ? Math.min(100, (ocupados / capacidade) * 100) : 0}%` }} />
          </span>
        </div>
        <dl className="adm-us-galinheiro-info">
          <div>
            <dt>Aposentados</dt>
            <dd>{fmt.int(aposentados)}</dd>
          </div>
          <div>
            <dt>Tutorial</dt>
            <dd>
              {tutorial.concluido ? (
                <Selo tom="verde">Concluído</Selo>
              ) : (
                <span title={tutorial.rotulo}>
                  Etapa {tutorialEtapa} de {tutorial.final} · {tutorial.rotulo}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </div>
      {entidades.length ? (
        <>
          <ul className="adm-us-animais">
            {(todos ? entidades : entidades.slice(0, LIMITE_LISTA)).map((e) => (
              <CartaoAnimal key={e.id} e={e} agora={agora} />
            ))}
          </ul>
          <VerMais total={entidades.length} abertos={todos} aoAlternar={() => setTodos((v) => !v)} rotulo="Mostrar todos" />
        </>
      ) : (
        <Vazio titulo="Nenhum animal no galinheiro">Os animais aposentados não aparecem aqui. Use “Dar animal” para presentear o membro.</Vazio>
      )}
    </Cartao>
  );
}

// ---------------------------------------------------------------- atendimento

export function SecaoAtendimento({ d, agora, abrir, className }: PropsSecao) {
  const s = d.suporte;
  return (
    <Cartao className={className} titulo={<TituloSecao icone={MessagesSquare}>Atendimento</TituloSecao>}>
      {s.conversaId ? (
        <>
          <div className="adm-us-atendimento">
            <Selo tom={s.status === 'aberta' ? 'verde' : 'neutro'}>{s.status === 'aberta' ? 'Conversa aberta' : 'Resolvida'}</Selo>
            {s.naoLidas > 0 ? (
              <span className="adm-us-naolidas">{plural(s.naoLidas, 'não lida', 'não lidas')}</span>
            ) : (
              <span className="adm-us-texto-suave">tudo lido</span>
            )}
          </div>
          <p className="adm-us-texto-suave mt-2">
            {s.ultimaMensagemEm ? (
              <>
                Última mensagem <span title={fmt.dataHora(s.ultimaMensagemEm)}>{fmt.relativo(s.ultimaMensagemEm, agora)}</span>.
              </>
            ) : (
              'Sem mensagens ainda.'
            )}
          </p>
          <div className="adm-us-botoes mt-3">
            <Link href={`/admin/atendimento?c=${s.conversaId}`} className="adm-botao" data-variante="primario">
              <MessagesSquare className="h-4 w-4" aria-hidden /> Abrir conversa
            </Link>
            <BotaoAdm onClick={() => abrir({ tipo: 'mensagem' })}>
              <Send className="h-4 w-4" aria-hidden /> Nova mensagem
            </BotaoAdm>
          </div>
        </>
      ) : (
        <>
          <p className="adm-us-texto-suave">Nenhuma conversa com este membro ainda. Você pode puxar assunto: a mensagem chega no atendimento dentro do jogo.</p>
          <div className="adm-us-botoes mt-3">
            <BotaoAdm variante="primario" onClick={() => abrir({ tipo: 'mensagem' })}>
              <MessageSquarePlus className="h-4 w-4" aria-hidden /> Enviar mensagem
            </BotaoAdm>
          </div>
        </>
      )}
    </Cartao>
  );
}

// ---------------------------------------------------------------- perfil

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="adm-us-dado">
      <dt>{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function SecaoPerfil({ d, abrir, className }: PropsSecao) {
  const u = d.usuario;
  return (
    <Cartao
      className={className}
      titulo={<TituloSecao icone={UserRound}>Perfil</TituloSecao>}
      acoes={
        <BotaoAdm tamanho="p" onClick={() => abrir({ tipo: 'perfil' })}>
          <Pencil className="h-4 w-4" aria-hidden /> Editar
        </BotaoAdm>
      }
    >
      <dl className="adm-us-dados">
        <Dado rotulo="Nome">{u.nome}</Dado>
        <Dado rotulo="E-mail">
          <span className="truncate">{u.email}</span>
          <BotaoCopiar texto={u.email} rotulo="e-mail" />
        </Dado>
        <Dado rotulo="Telefone">
          <span className="tabular-nums">{formatarTelefone(u.telefone)}</span>
          <BotaoCopiar texto={formatarTelefone(u.telefone)} rotulo="telefone" />
        </Dado>
        <Dado rotulo="Papel">
          {u.papel === 'admin' ? (
            <>
              <UserRoundCog className="h-4 w-4 text-violet-600" aria-hidden /> Administrador
            </>
          ) : (
            'Jogador'
          )}
        </Dado>
        <Dado rotulo="Cadastro">{fmt.dataHora(u.criadoEm)}</Dado>
        <Dado rotulo="Último acesso">{u.ultimoAcessoEm ? fmt.dataHora(u.ultimoAcessoEm) : 'nunca entrou'}</Dado>
        <Dado rotulo="ID da conta">
          <code className="adm-us-id">{u.id}</code>
          <BotaoCopiar texto={u.id} rotulo="ID" />
        </Dado>
      </dl>
    </Cartao>
  );
}

// ---------------------------------------------------------------- afiliação (convites; tudo em moedas do jogo)

export function SecaoAfiliacao({ d, abrir, className }: PropsSecao) {
  const a = d.afiliacao;
  const recebidas = a.comissoesRecebidasX100;
  const doLink = a.bonusLinkX100;
  const quemEntra = doLink ?? a.bonusGeralX100;
  const primeiro = primeiroNome(d.usuario.nome);
  return (
    <Cartao
      className={className}
      titulo={<TituloSecao icone={Network}>Afiliação</TituloSecao>}
      acoes={
        <Link href={`/admin/afiliados/${d.usuario.id}`} className="adm-botao" data-tamanho="p">
          <Network className="h-4 w-4" aria-hidden /> Ver rede
        </Link>
      }
    >
      <dl className="adm-us-dados">
        <Dado rotulo="Código">
          {a.codigo ? (
            <>
              <code className="adm-us-id">{a.codigo}</code>
              <BotaoCopiar texto={a.codigo} rotulo="código de convite" />
            </>
          ) : (
            <span className="adm-us-texto-suave">ainda não gerado</span>
          )}
        </Dado>
        <Dado rotulo="Indicado por">
          {a.indicadoPor ? (
            <Link href={`/admin/usuarios/${a.indicadoPor.id}`} className="adm-us-link inline-flex min-w-0 items-center gap-1" title={`Abrir a ficha de ${a.indicadoPor.nome}`}>
              <span className="truncate">{a.indicadoPor.nome}</span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            </Link>
          ) : (
            <span className="adm-us-texto-suave">entrou sem convite</span>
          )}
        </Dado>
        <Dado rotulo="Diretos">{plural(a.diretos, 'indicado', 'indicados')}</Dado>
        <Dado rotulo="Rede">
          {plural(a.rede, 'membro', 'membros')} <span className="adm-us-texto-suave">até o 5º nível</span>
        </Dado>
        <Dado rotulo="Comissões">
          <span className="adm-us-valor" data-sinal={recebidas > 0 ? 'mais' : undefined}>
            {recebidas > 0 ? '+' : ''}
            {fmt.moedas(recebidas)}
          </span>
          <span className="adm-us-texto-suave">moedas recebidas</span>
        </Dado>
        <Dado rotulo="Bônus do link">
          <span className="adm-us-valor">R$ {fmt.moedas(quemEntra)}</span>
          <span className="adm-us-texto-suave">{doLink === null ? 'segue o bônus geral' : 'valor próprio deste link'}</span>
        </Dado>
      </dl>
      <p className="adm-us-texto">
        {doLink === null
          ? `Quem entrar pelo link de ${primeiro} recebe o bônus geral, R$ ${fmt.moedas(a.bonusGeralX100)}.`
          : `Quem entrar pelo link de ${primeiro} recebe R$ ${fmt.moedas(doLink)}. Os outros links, e quem entra sem convite, recebem o bônus geral de R$ ${fmt.moedas(a.bonusGeralX100)}.`}
        {' '}Quem já entrou continua com o bônus que recebeu.
      </p>
      <div className="adm-us-botoes">
        <BotaoAdm tamanho="p" onClick={() => abrir({ tipo: 'bonus-link' })}>
          <Gift className="h-4 w-4" aria-hidden /> Bônus deste link
        </BotaoAdm>
        <BotaoAdm tamanho="p" onClick={() => abrir({ tipo: 'bonus-geral' })}>
          <Coins className="h-4 w-4" aria-hidden /> Bônus geral
        </BotaoAdm>
      </div>
    </Cartao>
  );
}

// ---------------------------------------------------------------- tickets do Intercâmbio (vales do jogo)

const ICONE_MOVIMENTO: Record<MovimentoTicketDTO['motivo'], ReactNode> = {
  compra: <ShoppingCart className="h-4 w-4" />,
  cupom: <TicketPercent className="h-4 w-4" />,
  troca: <ArrowLeftRight className="h-4 w-4" />,
  ajuste: <Wrench className="h-4 w-4" />,
};

export function SecaoTickets({ d, agora, className, aoAjustar }: PropsSecao & { aoAjustar: () => void }) {
  const [todos, setTodos] = useState(false);
  const { saldo, movimentos } = d.tickets;
  const visiveis = todos ? movimentos : movimentos.slice(0, LIMITE_LISTA);
  return (
    <Cartao
      className={className}
      titulo={<TituloSecao icone={Ticket}>Tickets</TituloSecao>}
      acoes={
        <Link href="/admin/intercambio" className="adm-us-link adm-us-texto-suave">
          Intercâmbio
        </Link>
      }
    >
      <div className="itc-ficha-saldo">
        <div className="min-w-0">
          <p className="itc-ficha-rotulo">Saldo de tickets</p>
          <p className="itc-ficha-valor">
            <IconeTicket className="itc-ficha-ticket" />
            {fmt.int(saldo)}
            <span>{saldo === 1 ? 'ticket' : 'tickets'}</span>
          </p>
        </div>
        <BotaoAdm variante="primario" onClick={aoAjustar}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden /> Ajustar tickets
        </BotaoAdm>
      </div>
      <p className="adm-us-texto-suave mt-2">
        Vales do jogo, trocados por ovos e animais no Intercâmbio. Vêm de cupons, de ajustes da equipe e (se ligada) da compra com moedas do jogo.
      </p>
      {movimentos.length ? (
        <>
          <div className="adm-us-subtitulo">
            <h3>
              Últimos movimentos <span>· {movimentos.length}</span>
            </h3>
          </div>
          <ul className="adm-us-extrato">
            {visiveis.map((m) => {
              const { titulo, detalhe } = descreverMovimento(m);
              const entrada = m.delta > 0;
              return (
                <li key={m.id} className="adm-us-extrato-item">
                  <span className="adm-us-extrato-icone itc-mov-icone" data-motivo={m.motivo} aria-hidden>
                    {ICONE_MOVIMENTO[m.motivo] ?? <Ticket className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="adm-us-extrato-titulo">{titulo}</p>
                    {detalhe && <p className="adm-us-extrato-detalhe">{detalhe}</p>}
                    <p className="adm-us-extrato-data">
                      <time dateTime={m.criadoEm} title={fmt.relativo(m.criadoEm, agora)}>
                        {fmt.dataHora(m.criadoEm)}
                      </time>
                    </p>
                  </div>
                  <div className="adm-us-extrato-valores">
                    <p className="adm-us-valor" data-sinal={entrada ? 'mais' : 'menos'}>
                      {entrada ? '+' : '−'}
                      {fmt.int(Math.abs(m.delta))}
                    </p>
                    <p className="adm-us-extrato-saldo">saldo {fmt.int(m.saldoApos)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <VerMais total={movimentos.length} abertos={todos} aoAlternar={() => setTodos((v) => !v)} rotulo="Mostrar todos" />
        </>
      ) : (
        <Vazio titulo="Nenhum movimento de tickets">Ainda não ganhou nem usou tickets. Use “Ajustar tickets” para dar alguns.</Vazio>
      )}
    </Cartao>
  );
}

// ---------------------------------------------------------------- acesso e segurança

function LinhaAcao({ icone: Icone, titulo, texto, botao, tom }: { icone: LucideIcon; titulo: string; texto: string; botao: ReactNode; tom?: 'vermelho' | 'verde' }) {
  return (
    <li className="adm-us-acao" data-tom={tom}>
      <span className="adm-us-acao-icone" aria-hidden>
        <Icone className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="adm-us-acao-titulo">{titulo}</p>
        <p className="adm-us-acao-texto">{texto}</p>
      </div>
      <div className="shrink-0">{botao}</div>
    </li>
  );
}

export function SecaoSeguranca({ d, agora, proprio, abrir, className }: PropsSecao) {
  const u = d.usuario;
  return (
    <Cartao className={className} titulo={<TituloSecao icone={ShieldCheck}>Acesso e segurança</TituloSecao>}>
      <div className="adm-us-situacao" data-tom={u.bloqueado ? 'vermelho' : 'verde'}>
        {u.bloqueado ? <Lock className="h-5 w-5 shrink-0" aria-hidden /> : <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden />}
        <div className="min-w-0">
          <p className="font-extrabold">
            {u.bloqueado ? `Conta bloqueada${u.bloqueadoEm ? ` ${fmt.relativo(u.bloqueadoEm, agora)}` : ''}` : 'Conta ativa'}
          </p>
          <p className="adm-us-situacao-texto">
            {u.bloqueado ? (u.bloqueioMotivo ? `Motivo: ${u.bloqueioMotivo}` : 'Sem motivo registrado.') : 'Pode entrar e jogar normalmente.'}
          </p>
        </div>
      </div>
      <ul className="adm-us-acoes">
        <LinhaAcao
          icone={LogOut}
          titulo="Encerrar sessões"
          texto="Desconecta de todos os aparelhos; precisa entrar de novo com e-mail e senha."
          botao={
            <BotaoAdm tamanho="p" onClick={() => abrir({ tipo: 'sessoes' })}>
              Encerrar
            </BotaoAdm>
          }
        />
        <LinhaAcao
          icone={KeyRound}
          titulo="Código de recuperação"
          texto="Gera um código novo para o membro criar outra senha. O atual deixa de valer."
          botao={
            <BotaoAdm tamanho="p" onClick={() => abrir({ tipo: 'codigo' })}>
              Gerar novo
            </BotaoAdm>
          }
        />
        {u.bloqueado ? (
          <LinhaAcao
            icone={LockOpen}
            tom="verde"
            titulo="Desbloquear conta"
            texto="Devolve o acesso: o membro volta a conseguir entrar."
            botao={
              <BotaoAdm tamanho="p" variante="primario" onClick={() => abrir({ tipo: 'desbloquear' })}>
                Desbloquear
              </BotaoAdm>
            }
          />
        ) : (
          <LinhaAcao
            icone={Ban}
            tom="vermelho"
            titulo="Bloquear conta"
            texto={proprio ? 'Você não pode bloquear a sua própria conta.' : 'Derruba as sessões e impede novos logins. O membro vê o motivo ao tentar entrar.'}
            botao={
              <BotaoAdm tamanho="p" variante="perigo" disabled={proprio} onClick={() => abrir({ tipo: 'bloquear' })}>
                Bloquear
              </BotaoAdm>
            }
          />
        )}
      </ul>
    </Cartao>
  );
}

// ---------------------------------------------------------------- extrato

const ICONE_TRANSACAO: Record<TransacaoDTO['tipo'], ReactNode> = {
  BONUS_INICIAL: <Gift className="h-4 w-4" />,
  VENDA_OVOS: <Egg className="h-4 w-4" />,
  GIRO_ROLETA: <IconeRoleta className="h-5 w-5" />,
  UPGRADE_NINHO: <Hammer className="h-4 w-4" />,
  AJUSTE_SUPORTE: <Wrench className="h-4 w-4" />,
  COMISSAO_INDICACAO: <Network className="h-4 w-4" />,
  COMPRA_TICKET: <Ticket className="h-4 w-4" />,
  SAQUE: <Banknote className="h-4 w-4" />,
  SAQUE_ESTORNO: <Banknote className="h-4 w-4" />,
};

function VerMais({ total, abertos, aoAlternar, rotulo = 'Mostrar todas' }: { total: number; abertos: boolean; aoAlternar: () => void; rotulo?: string }) {
  if (total <= LIMITE_LISTA) return null;
  return (
    <button type="button" className="adm-us-ver-mais" onClick={aoAlternar} aria-expanded={abertos}>
      {abertos ? (
        <>
          Mostrar menos <ChevronUp className="h-4 w-4" aria-hidden />
        </>
      ) : (
        <>
          {rotulo} ({total}) <ChevronDown className="h-4 w-4" aria-hidden />
        </>
      )}
    </button>
  );
}

export function SecaoExtrato({ d, agora, className }: PropsSecao) {
  const [todas, setTodas] = useState(false);
  const itens = d.transacoes;
  const visiveis = todas ? itens : itens.slice(0, LIMITE_LISTA);
  return (
    <Cartao
      className={className}
      titulo={<TituloSecao icone={ReceiptText}>Extrato</TituloSecao>}
      acoes={itens.length ? <span className="adm-us-texto-suave">últimas {itens.length} movimentações</span> : undefined}
    >
      {itens.length ? (
        <>
          <ul className="adm-us-extrato">
            {visiveis.map((t) => {
              const { titulo, detalhe } = descreverTransacao(t);
              const entrada = t.valorX100 >= 0;
              return (
                <li key={t.id} className="adm-us-extrato-item">
                  <span className="adm-us-extrato-icone" data-tipo={t.tipo} aria-hidden>
                    {ICONE_TRANSACAO[t.tipo] ?? <Coins className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="adm-us-extrato-titulo">{titulo}</p>
                    {detalhe && <p className="adm-us-extrato-detalhe">{detalhe}</p>}
                    <p className="adm-us-extrato-data">
                      <time dateTime={t.criadoEm} title={fmt.relativo(t.criadoEm, agora)}>
                        {fmt.dataHora(t.criadoEm)}
                      </time>
                    </p>
                  </div>
                  <div className="adm-us-extrato-valores">
                    <p className="adm-us-valor" data-sinal={entrada ? 'mais' : 'menos'}>
                      {entrada ? '+' : '−'}
                      {fmt.moedas(Math.abs(t.valorX100))}
                    </p>
                    <p className="adm-us-extrato-saldo">saldo {fmt.moedas(t.saldoAposX100)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <VerMais total={itens.length} abertos={todas} aoAlternar={() => setTodas((v) => !v)} />
        </>
      ) : (
        <Vazio titulo="Sem movimentações">Nenhuma entrada ou saída de moedas ainda.</Vazio>
      )}
    </Cartao>
  );
}

// ---------------------------------------------------------------- auditoria

const ICONE_GRUPO: Record<GrupoAcao, LucideIcon> = {
  perfil: Pencil,
  seguranca: KeyRound,
  bloqueio: Ban,
  economia: Coins,
  galinheiro: Warehouse,
  atendimento: MessagesSquare,
  exclusao: Trash,
  outro: Sparkles,
};

/** O ajuste de tickets na linguagem da ficha ("Creditou 5 tickets"); as outras ações ficam com descreverAcao. */
function descreverAcaoFicha(a: AdminAcaoDTO): ReturnType<typeof descreverAcao> {
  if (a.acao !== 'ajustar_tickets') return descreverAcao(a);
  const d = a.detalhes ?? {};
  const q = typeof d.quantidade === 'number' ? d.quantidade : 0;
  const saldo = typeof d.saldoApos === 'number' ? d.saldoApos : null;
  const motivo = typeof d.motivo === 'string' && d.motivo.trim() ? d.motivo.trim() : undefined;
  return {
    titulo: `${q >= 0 ? 'Creditou' : 'Debitou'} ${textoTickets(Math.abs(q))}`,
    detalhe: [motivo, saldo === null ? undefined : `saldo depois: ${textoTickets(saldo)}`].filter(Boolean).join(' · ') || undefined,
    grupo: 'economia',
  };
}

export function SecaoAuditoria({ d, agora, className }: PropsSecao) {
  const [todas, setTodas] = useState(false);
  const acoes = d.auditoria;
  const visiveis = todas ? acoes : acoes.slice(0, LIMITE_LISTA);
  return (
    <Cartao
      className={className}
      titulo={<TituloSecao icone={ScrollText}>Auditoria</TituloSecao>}
      acoes={
        <Link href="/admin/auditoria" className="adm-us-link adm-us-texto-suave">
          Auditoria completa
        </Link>
      }
    >
      {acoes.length ? (
        <>
          <ol className="adm-us-auditoria">
            {visiveis.map((a) => {
              const { titulo, detalhe, grupo } = descreverAcaoFicha(a);
              const Icone = ICONE_GRUPO[grupo];
              return (
                <li key={a.id} className="adm-us-auditoria-item">
                  <span className="adm-us-auditoria-icone" data-grupo={grupo} aria-hidden>
                    <Icone className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="adm-us-auditoria-titulo">{titulo}</p>
                    {detalhe && <p className="adm-us-auditoria-detalhe">{detalhe}</p>}
                    <p className="adm-us-auditoria-meta">
                      por <strong>{a.adminNome ?? 'administrador removido'}</strong> ·{' '}
                      <time dateTime={a.criadoEm} title={fmt.dataHora(a.criadoEm)}>
                        {fmt.relativo(a.criadoEm, agora)}
                      </time>
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
          <VerMais total={acoes.length} abertos={todas} aoAlternar={() => setTodas((v) => !v)} />
        </>
      ) : (
        <Vazio titulo="Nada registrado ainda">As ações do painel sobre este membro (ajustes, bloqueios, edições) aparecem aqui.</Vazio>
      )}
    </Cartao>
  );
}

// ---------------------------------------------------------------- zona de perigo

export function SecaoPerigo({ d, proprio, abrir, className }: PropsSecao) {
  return (
    <Cartao className={cx('adm-us-perigo', className)} titulo={<TituloSecao icone={TriangleAlert}>Zona de perigo</TituloSecao>}>
      <p className="adm-us-texto">
        Excluir apaga a conta de {d.usuario.nome} e todo o progresso no jogo: galinheiro, animais, ovos, moedas, extrato e conversa do atendimento.{' '}
        <strong>Não dá para desfazer.</strong>
      </p>
      {proprio && <p className="adm-us-texto-suave mt-2">Você não pode excluir a sua própria conta pelo painel.</p>}
      <BotaoAdm className="mt-3" variante="perigo" disabled={proprio} onClick={() => abrir({ tipo: 'excluir' })}>
        <Trash className="h-4 w-4" aria-hidden /> Excluir conta
      </BotaoAdm>
    </Cartao>
  );
}
