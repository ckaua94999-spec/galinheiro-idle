'use client';

// Rede de um membro no painel (/admin/afiliados/[id]): quem é (com código e link de convite), quem está acima
// (quem convidou, quem convidou essa pessoa… — clicáveis), quantos há em cada nível abaixo, os indicados diretos
// (com o caminho para a rede de cada um), as comissões recebidas e geradas e as últimas comissões. Celular em
// coluna única (níveis antes da lista); desktop com indicados e níveis lado a lado e as comissões embaixo.
import type { AdminRedeDTO, ConfigAfiliadosDTO } from '@galinheiro/api-contract';
import {
  ArrowLeft, Ban, CalendarDays, ChevronDown, ChevronRight, ChevronUp, Coins, HandCoins, Hash, Layers, Link2, Mail, Network, RefreshCw,
  Sprout, UserPlus, UserRound, UserX, Users,
} from 'lucide-react';
import Link from 'next/link';
import { useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ErroApi } from '../../api';
import { cx } from '../../util';
import { BotaoAdm, Cartao, Carregando, Kpi, Selo, Vazio, fmt, mensagemAdmin } from '../ui';
import { Avatar, BotaoCopiar, UltimoAcesso, plural, primeiroNome, useAgoraLento } from '../usuarios/comum';
import { TituloSecao, useCaminhoPainel, useConfigAfiliados, useRedeMembro } from './comum';
import { NIVEIS_MAX, juntar, nomeNivelAbaixo, pct } from './formato';

const LIMITE_DIRETOS = 12;
const LIMITE_COMISSOES = 8;
const ICONE = 'h-[18px] w-[18px]';
const DATA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const data = (iso: string) => DATA.format(new Date(iso));

/** O que alguém no nível dado (acima de quem vende) recebe, pelas taxas em vigor. */
function recebe(config: ConfigAfiliadosDTO | undefined, nivel: number): { texto: string; paga: boolean } | null {
  if (!config) return null;
  const bp = config.comissoesBp[nivel - 1];
  if (bp === undefined) return { texto: `não recebe (só até o nível ${config.comissoesBp.length})`, paga: false };
  if (!config.ativo) return { texto: `${pct(bp)} · programa pausado`, paga: false };
  if (bp === 0) return { texto: 'nível com 0%', paga: false };
  return { texto: `recebe ${pct(bp)}`, paga: true };
}

// ---------------------------------------------------------------- cabeçalho

function CabecalhoRede({ d, agora }: { d: AdminRedeDTO; agora: number }) {
  const c = d.conta;
  const dias = Math.max(0, Math.floor((agora - Date.parse(c.criadoEm)) / 86_400_000));
  const quem = d.acima.find((a) => a.nivel === 1);
  const link = c.codigo && typeof window !== 'undefined' ? `${window.location.origin}/c/${c.codigo}` : null;
  return (
    <section className="adm-cartao adm-us-cabeca" aria-label="Membro">
      <div className="adm-us-cabeca-corpo">
        <Avatar id={c.id} nome={c.nome} tamanho="g" />
        <div className="adm-us-cabeca-info">
          <p className="afi-sobretitulo">Rede de afiliados de</p>
          <div className="adm-us-cabeca-titulo">
            <h1 className="adm-us-ficha-nome">{c.nome}</h1>
          </div>
          <div className="adm-us-contatos">
            <span className="adm-us-contato">
              <Mail className="h-4 w-4 shrink-0" aria-hidden />
              <a href={`mailto:${c.email}`} className="adm-us-link truncate">
                {c.email}
              </a>
              <BotaoCopiar texto={c.email} rotulo="e-mail" />
            </span>
            <span className="adm-us-contato">
              <Hash className="h-4 w-4 shrink-0" aria-hidden />
              {c.codigo ? (
                <>
                  código <code className="afi-codigo">{c.codigo}</code>
                  <BotaoCopiar texto={c.codigo} rotulo="código" />
                  {link && (
                    <span className="afi-copiar-link" title={link}>
                      <Link2 className="h-3.5 w-3.5" aria-hidden />
                      <span>link</span>
                      <BotaoCopiar texto={link} rotulo="link de convite" />
                    </span>
                  )}
                </>
              ) : (
                <span className="afi-texto-suave">sem código ainda (é criado quando o membro abre “Convide amigos”)</span>
              )}
            </span>
          </div>
          <p className="adm-us-meta">
            <span>
              <CalendarDays className="h-4 w-4" aria-hidden />
              Membro desde {data(c.criadoEm)} ({dias === 0 ? 'hoje' : `há ${plural(dias, 'dia', 'dias')}`})
            </span>
            <span>
              <UserPlus className="h-4 w-4" aria-hidden />
              {quem ? (
                <>
                  Indicado{c.indicadoEm ? ` em ${data(c.indicadoEm)}` : ''} por{' '}
                  <Link href={`/admin/afiliados/${quem.id}`} className="adm-us-link afi-link-forte">
                    {quem.nome}
                  </Link>
                </>
              ) : (
                'Entrou sem convite'
              )}
            </span>
          </p>
        </div>
        <div className="adm-us-cabeca-acoes">
          <Link href={`/admin/usuarios/${c.id}`} className="adm-botao">
            <UserRound className="h-4 w-4" aria-hidden /> Ver ficha
          </Link>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- acima

function TrilhaAcima({ d, config }: { d: AdminRedeDTO; config: ConfigAfiliadosDTO | undefined }) {
  const nome = primeiroNome(d.conta.nome);
  const acima = [...d.acima].sort((a, b) => b.nivel - a.nivel);
  return (
    <Cartao
      className="afi-acima"
      titulo={<TituloSecao Icone={Network} texto="Quem está acima" tom="roxo" sub={acima.length ? `quem ganha com as vendas de ${nome}` : undefined} />}
    >
      {!acima.length ? (
        <p className="afi-acima-vazio">
          <Sprout className="h-5 w-5 shrink-0" aria-hidden />
          <span>
            {nome} entrou sem convite: está no topo da própria rede. As vendas de ovos de {nome} não pagam comissão a ninguém.
          </span>
        </p>
      ) : (
        <ol className="afi-trilha" aria-label={`Corrente de convites até ${d.conta.nome}`}>
          {acima.map((a) => {
            const r = recebe(config, a.nivel);
            return (
              <li key={a.id} className="afi-trilha-item">
                <Link href={`/admin/afiliados/${a.id}`} className="afi-elo" title={`Ver a rede de ${a.nome}`}>
                  <Avatar id={a.id} nome={a.nome} tamanho="p" />
                  <span className="min-w-0">
                    <span className="afi-elo-nome">{a.nome}</span>
                    <span className="afi-elo-sub">
                      nível {a.nivel}
                      {r && (
                        <>
                          {' · '}
                          <span data-paga={r.paga || undefined} className="afi-elo-recebe">
                            {r.texto}
                          </span>
                        </>
                      )}
                    </span>
                  </span>
                </Link>
                <span className="afi-trilha-seta" aria-hidden>
                  <ChevronRight className="h-4 w-4" />
                </span>
                <span className="sr-only">convidou</span>
              </li>
            );
          })}
          <li className="afi-trilha-item">
            <span className="afi-elo afi-elo-atual" aria-current="page">
              <Avatar id={d.conta.id} nome={d.conta.nome} tamanho="p" />
              <span className="min-w-0">
                <span className="afi-elo-nome">{d.conta.nome}</span>
                <span className="afi-elo-sub">este membro (quem vende)</span>
              </span>
            </span>
          </li>
        </ol>
      )}
    </Cartao>
  );
}

// ---------------------------------------------------------------- números

function KpisRede({ d }: { d: AdminRedeDTO }) {
  const rede = d.niveis.reduce((s, n) => s + n, 0);
  const nome = primeiroNome(d.conta.nome);
  return (
    <div className="afi-kpis-rede">
      <Kpi
        rotulo="Diretos"
        valor={fmt.int(d.niveis[0] ?? 0)}
        tom="verde"
        icone={<Users className={ICONE} />}
        detalhe={`indicados por ${nome}`}
      />
      <Kpi
        rotulo="Rede abaixo"
        valor={fmt.int(rede)}
        tom="roxo"
        icone={<Layers className={ICONE} />}
        detalhe={`membros até o ${NIVEIS_MAX}º nível`}
      />
      <Kpi
        rotulo="Recebidas"
        valor={fmt.moedas(d.comissoes.recebidasX100)}
        tom="ambar"
        icone={<HandCoins className={ICONE} />}
        detalhe={`comissões em moedas, das vendas da rede de ${nome}`}
      />
      <Kpi
        rotulo="Geradas"
        valor={fmt.moedas(d.comissoes.geradasX100)}
        tom="azul"
        icone={<Coins className={ICONE} />}
        detalhe={`comissões que as vendas de ${nome} renderam para quem está acima`}
      />
    </div>
  );
}

// ---------------------------------------------------------------- abaixo

function NiveisAbaixo({ d, config }: { d: AdminRedeDTO; config: ConfigAfiliadosDTO | undefined }) {
  const total = d.niveis.reduce((s, n) => s + n, 0);
  const maior = Math.max(1, ...d.niveis);
  // mostra até o último nível que paga comissão ou o mais fundo que tem gente (o que vier depois)
  const fundo = d.niveis.reduce((u, n, i) => (n > 0 ? i + 1 : u), 0);
  const ate = Math.max(1, Math.min(d.niveis.length, Math.max(fundo, config?.comissoesBp.length ?? d.niveis.length)));
  const niveis = d.niveis.slice(0, ate);
  const nome = primeiroNome(d.conta.nome);
  const paga = !!config?.ativo && config.comissoesBp.some((bp) => bp > 0);
  return (
    <Cartao className="afi-sec-niveis" titulo={<TituloSecao Icone={Layers} texto="Rede abaixo" tom="roxo" sub={plural(total, 'membro', 'membros')} />}>
      {total === 0 ? (
        <div className="afi-rede-vazia">
          <p className="afi-rede-vazia-titulo">Ninguém na rede ainda</p>
          <p className="afi-texto-suave">
            {paga
              ? `Pelas taxas em vigor, ${nome} receberia ${juntar(config!.comissoesBp.map((bp, i) => `${pct(bp)} das vendas do nível ${i + 1}`))}.`
              : 'Quando alguém entrar pelo link de convite, aparece aqui, nível por nível.'}
          </p>
        </div>
      ) : (
        <ul className="afi-niveis">
          {niveis.map((n, i) => {
            const r = recebe(config, i + 1);
            return (
              <li key={i} className="afi-nivel" data-desligado={(r && !r.paga) || undefined}>
                <div className="afi-nivel-topo">
                  <span className="afi-nivel-nome">Nível {i + 1}</span>
                  <span className="afi-nivel-pct" title={r ? `Pelas taxas em vigor: ${r.texto}` : undefined}>
                    {r ? (r.paga ? pct(config!.comissoesBp[i]!) : '—') : ''}
                  </span>
                  <span className={cx('afi-nivel-valor', n === 0 && 'afi-zero')}>{plural(n, 'membro', 'membros')}</span>
                </div>
                <span className="afi-barra" aria-hidden>
                  <span style={{ width: `${(n / maior) * 100}%` }} />
                </span>
                <p className="afi-nivel-sub">
                  <span>{nomeNivelAbaixo(i + 1)}</span>
                  {r && <span>{r.paga ? `${nome} recebe ${pct(config!.comissoesBp[i]!)} das vendas deles` : r.texto}</span>}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {total > 0 && ate < d.niveis.length && (
        <p className="afi-nota">
          {ate + 1 === d.niveis.length ? `Nível ${ate + 1}` : `Níveis ${ate + 1} a ${d.niveis.length}`}: ninguém ainda.
        </p>
      )}
    </Cartao>
  );
}

function Diretos({ d, agora }: { d: AdminRedeDTO; agora: number }) {
  const router = useRouter();
  const [todos, setTodos] = useState(false);
  const lista = d.diretos;
  const visiveis = todos ? lista : lista.slice(0, LIMITE_DIRETOS);
  const nome = primeiroNome(d.conta.nome);
  const abrir = (e: MouseEvent, id: string) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    if (window.getSelection()?.toString()) return;
    if (e.ctrlKey || e.metaKey) window.open(`/admin/afiliados/${id}`, '_blank');
    else router.push(`/admin/afiliados/${id}`);
  };
  const total = d.niveis[0] ?? lista.length;
  return (
    <Cartao
      className="afi-sec-diretos"
      titulo={<TituloSecao Icone={Users} texto="Indicados diretos" tom="verde" sub={fmt.int(total)} />}
      acoes={lista.length ? <span className="afi-texto-suave">toque num indicado para ver a rede dele</span> : undefined}
    >
      {!lista.length ? (
        <Vazio titulo="Ainda não convidou ninguém">
          Quando alguém se cadastrar pelo link de convite de {nome}, aparece aqui.
        </Vazio>
      ) : (
        <>
          <div className="afi-diretos-tabela">
            <table className="adm-tabela">
              <caption className="sr-only">Indicados diretos de {d.conta.nome}</caption>
              <thead>
                <tr>
                  <th scope="col">Membro</th>
                  <th scope="col">Entrou · acesso</th>
                  <th scope="col" className="num" title="Indicados diretos de cada um">
                    Diretos
                  </th>
                  <th scope="col" className="num" title={`Comissões que cada um rendeu para ${nome}`}>
                    Rendeu
                  </th>
                  <th scope="col" className="afi-col-ir">
                    <span className="sr-only">Abrir a rede</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((m) => (
                  <tr key={m.id} className="afi-linha" data-bloqueado={m.bloqueado || undefined} onClick={(e) => abrir(e, m.id)}>
                    <td>
                      <div className="adm-us-membro">
                        <Avatar id={m.id} nome={m.nome} tamanho="p" />
                        <div className="min-w-0">
                          <div className="adm-us-membro-linha">
                            <Link href={`/admin/afiliados/${m.id}`} className="adm-us-nome">
                              {m.nome}
                            </Link>
                            {m.bloqueado && (
                              <Selo tom="vermelho">
                                <Ban className="h-3.5 w-3.5" aria-hidden /> Bloqueado
                              </Selo>
                            )}
                          </div>
                          <p className="adm-us-email">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p className="afi-col-data">desde {data(m.criadoEm)}</p>
                      <UltimoAcesso iso={m.ultimoAcessoEm} agora={agora} />
                    </td>
                    <td className="num">{m.diretos ? fmt.int(m.diretos) : <span className="afi-zero">0</span>}</td>
                    <td className="num">
                      <span className={cx('afi-moedas', m.rendeuX100 === 0 && 'afi-zero')}>{fmt.moedas(m.rendeuX100)}</span>
                    </td>
                    <td className="afi-col-ir">
                      <Link href={`/admin/afiliados/${m.id}`} className="afi-ir" aria-label={`Ver a rede de ${m.nome}`} title={`Ver a rede de ${m.nome}`}>
                        Rede <ChevronRight className="h-4 w-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="afi-diretos-cartoes">
            {visiveis.map((m) => (
              <li key={m.id}>
                <Link href={`/admin/afiliados/${m.id}`} className="afi-cartao-membro" data-bloqueado={m.bloqueado || undefined}>
                  <div className="afi-cartao-membro-topo">
                    <Avatar id={m.id} nome={m.nome} tamanho="p" />
                    <div className="min-w-0 flex-1">
                      <div className="adm-us-membro-linha">
                        <span className="adm-us-nome">{m.nome}</span>
                        {m.bloqueado && (
                          <Selo tom="vermelho">
                            <Ban className="h-3.5 w-3.5" aria-hidden /> Bloqueado
                          </Selo>
                        )}
                      </div>
                      <p className="adm-us-email">{m.email}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                  </div>
                  <dl className="afi-cartao-numeros" data-colunas="3">
                    <div>
                      <dt>Desde</dt>
                      <dd>{data(m.criadoEm)}</dd>
                    </div>
                    <div>
                      <dt>Diretos</dt>
                      <dd>{fmt.int(m.diretos)}</dd>
                    </div>
                    <div>
                      <dt>Rendeu</dt>
                      <dd>{fmt.moedas(m.rendeuX100)}</dd>
                    </div>
                  </dl>
                  <p className="afi-cartao-rodape">
                    <UltimoAcesso iso={m.ultimoAcessoEm} agora={agora} />
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {lista.length > LIMITE_DIRETOS && (
            <button type="button" className="adm-us-ver-mais" onClick={() => setTodos((v) => !v)} aria-expanded={todos}>
              {todos ? (
                <>
                  Mostrar menos <ChevronUp className="h-4 w-4" aria-hidden />
                </>
              ) : (
                <>
                  Mostrar todos ({lista.length}) <ChevronDown className="h-4 w-4" aria-hidden />
                </>
              )}
            </button>
          )}
          <p className="afi-nota">
            “Rendeu” = comissões, em moedas do jogo, que cada indicado já gerou para {nome}.
            {total > lista.length && ` Mostrando os ${lista.length} mais recentes de ${fmt.int(total)}.`}
          </p>
        </>
      )}
    </Cartao>
  );
}

// ---------------------------------------------------------------- comissões

function UltimasComissoes({ d, agora }: { d: AdminRedeDTO; agora: number }) {
  const nome = primeiroNome(d.conta.nome);
  const [todas, setTodas] = useState(false);
  const visiveis = todas ? d.ultimas : d.ultimas.slice(0, LIMITE_COMISSOES);
  return (
    <Cartao
      className="afi-sec-ultimas"
      titulo={<TituloSecao Icone={HandCoins} texto="Últimas comissões recebidas" tom="ambar" />}
      acoes={
        d.ultimas.length ? (
          <span className="afi-texto-suave">{d.ultimas.length >= 20 ? 'as 20 mais recentes' : plural(d.ultimas.length, 'comissão', 'comissões')}</span>
        ) : undefined
      }
    >
      {!d.ultimas.length ? (
        <Vazio titulo="Nenhuma comissão recebida ainda">
          Quando alguém da rede de {nome} vender ovos, a comissão (paga pelo jogo, em moedas) aparece aqui.
        </Vazio>
      ) : (
        <>
          <ul className="afi-comissoes">
            {visiveis.map((k) => (
            <li key={k.id} className="afi-comissao">
              <span className="afi-comissao-nivel" title={`Comissão de nível ${k.nivel}`}>
                N{k.nivel}
              </span>
              <div className="min-w-0 flex-1">
                <p className="afi-comissao-titulo">Venda de {k.origem ?? 'membro removido'}</p>
                <p className="afi-comissao-detalhe">
                  venda de {fmt.moedas(k.baseX100)} ·{' '}
                  <time dateTime={k.criadoEm} title={fmt.dataHora(k.criadoEm)}>
                    {fmt.relativo(k.criadoEm, agora)}
                  </time>
                </p>
              </div>
              <p className="adm-us-valor" data-sinal="mais">
                +{fmt.moedas(k.valorX100)}
              </p>
            </li>
          ))}
          </ul>
          {d.ultimas.length > LIMITE_COMISSOES && (
            <button type="button" className="adm-us-ver-mais" onClick={() => setTodas((v) => !v)} aria-expanded={todas}>
              {todas ? (
                <>
                  Mostrar menos <ChevronUp className="h-4 w-4" aria-hidden />
                </>
              ) : (
                <>
                  Mostrar todas ({d.ultimas.length}) <ChevronDown className="h-4 w-4" aria-hidden />
                </>
              )}
            </button>
          )}
        </>
      )}
    </Cartao>
  );
}

// ---------------------------------------------------------------- tela

export function TelaRede({ id }: { id: string }) {
  const voltar = useCaminhoPainel();
  const agora = useAgoraLento();
  const rede = useRedeMembro(id);
  const config = useConfigAfiliados();

  const barra = (
    <div className="adm-us-voltar-barra">
      <Link href={voltar} className="adm-us-voltar">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Rede de afiliados
      </Link>
      {rede.data && (
        <BotaoAdm
          tamanho="p"
          variante="fantasma"
          onClick={() => {
            void rede.refetch();
            void config.refetch();
          }}
          disabled={rede.isFetching}
          title="Recarregar a rede"
        >
          <RefreshCw className={cx('h-4 w-4', rede.isFetching && 'adm-us-girando')} aria-hidden />
          <span className="adm-us-so-largo">{rede.isFetching ? 'Atualizando…' : 'Atualizar'}</span>
        </BotaoAdm>
      )}
    </div>
  );

  if (rede.isPending) {
    return (
      <div className="afi-rede">
        {barra}
        <Cartao>
          <Carregando texto="Abrindo a rede…" />
        </Cartao>
      </div>
    );
  }
  if (rede.isError) {
    const naoExiste = rede.error instanceof ErroApi && rede.error.status === 404;
    return (
      <div className="afi-rede">
        {barra}
        <Cartao>
          {naoExiste && <UserX className="mx-auto -mb-4 mt-4 h-9 w-9 text-slate-400" aria-hidden />}
          <Vazio titulo={naoExiste ? 'Membro não encontrado' : 'Não deu para abrir a rede'}>
            <p>{naoExiste ? 'Esta conta não existe mais (pode ter sido excluída) ou o link está errado.' : mensagemAdmin(rede.error)}</p>
            <div className="adm-us-botoes mt-3 justify-center">
              {!naoExiste && (
                <BotaoAdm onClick={() => void rede.refetch()}>
                  <RefreshCw className="h-4 w-4" aria-hidden /> Tentar de novo
                </BotaoAdm>
              )}
              <Link href={voltar} className="adm-botao" data-variante={naoExiste ? 'primario' : undefined}>
                Voltar para a rede de afiliados
              </Link>
            </div>
          </Vazio>
        </Cartao>
      </div>
    );
  }

  const d = rede.data;
  return (
    <div className="afi-rede">
      {barra}
      <CabecalhoRede d={d} agora={agora} />
      <TrilhaAcima d={d} config={config.data} />
      <KpisRede d={d} />
      <div className="afi-rede-colunas">
        <Diretos d={d} agora={agora} />
        <NiveisAbaixo d={d} config={config.data} />
      </div>
      <UltimasComissoes d={d} agora={agora} />
    </div>
  );
}
