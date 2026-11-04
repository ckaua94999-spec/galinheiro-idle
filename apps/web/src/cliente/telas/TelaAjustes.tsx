'use client';

// Configurações (GDD 3.7.10 e 6.15): som, vibração, animações, notificações, instalação, conta e extrato.
// Visual: seções com placa de madeira pregada, painéis pergaminho com azulejos coloridos por ajuste,
// interruptores do design system, volume com botão de moeda e seletor segmentado para as animações.
import { formatarTelefone, type ConfigPublicaDTO, type Preferencias } from '@galinheiro/api-contract';
import { CONFIG_VERSAO } from '@galinheiro/game-core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote, Bell, BellOff, ChevronRight, Clapperboard, Clock, Download, FastForward, Headphones, LogOut, Mail, Megaphone,
  MessagesSquare, Music, Phone, RotateCcw, Share, ShieldCheck, Smartphone, Sparkles, SquarePlus, Trash2, UserRound,
  Vibrate, Volume2, Wrench,
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { chamar } from '../api';
import { IconeAjustes, Moeda } from '../arte/Icones';
import { useNaoLidasSuporte } from '../avisos/consultas';
import { IconeConvite } from '../convites/IconeConvite';
import { IconeTicket } from '../intercambio/IconeTicket';
import { Modal } from '../componentes/Modal';
import { limparCacheEstado, useAtualizarPerfil, useEstado, CHAVE_ESTADO } from '../estado';
import { MOLA } from '../movimento';
import {
  VERSAO_APP, ativarNotificacoes, desativarNotificacoes, ehIOS, instalarApp, notificacoesAtivas, pushSuportado, usePwa,
} from '../pwa';
import { useUi, toast } from '../ui';
import { cx, mensagemDeErro } from '../util';

type IconeLucide = typeof Bell;
type CorTile = 'laranja' | 'verde' | 'azul' | 'roxo' | 'rosa' | 'vermelho' | 'ouro' | 'madeira' | 'cinza' | 'creme';

/** Azulejo colorido com ícone branco contornado. */
export function Azulejo({ Icone, cor = 'laranja' }: { Icone: IconeLucide; cor?: CorTile }) {
  return (
    <span className="tile-icone" data-cor={cor === 'laranja' ? undefined : cor} aria-hidden>
      <span className="icone-contorno">
        <Icone />
        <Icone />
      </span>
    </span>
  );
}

export function Interruptor({ ligado, aoMudar, rotulo }: { ligado: boolean; aoMudar: (v: boolean) => void; rotulo: string }) {
  return <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} onClick={() => aoMudar(!ligado)} className="interruptor" />;
}

/** Seletor segmentado (radiogroup) com a "pílula" azul deslizando até a opção marcada.
 *  `curto` (opcional): rótulo usado abaixo de 380 px (ex.: "Sistema" no lugar de "Como o sistema"), para
 *  as três opções ficarem numa linha só; o nome acessível continua sendo o rótulo completo. */
export function Segmentado<T extends string>({
  valor,
  opcoes,
  aoMudar,
  rotulo,
}: {
  valor: T;
  opcoes: { valor: T; rotulo: string; curto?: string }[];
  aoMudar: (v: T) => void;
  rotulo: string;
}) {
  const id = useId();
  const mover = (atual: number, passo: number) => {
    const prox = opcoes[(atual + passo + opcoes.length) % opcoes.length];
    if (prox) aoMudar(prox.valor);
  };
  return (
    <div className="segmentado" role="radiogroup" aria-label={rotulo}>
      {opcoes.map((o, i) => {
        const marcado = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={marcado}
            tabIndex={marcado ? 0 : -1}
            aria-label={o.curto ? o.rotulo : undefined}
            onClick={() => aoMudar(o.valor)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                mover(i, 1);
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                mover(i, -1);
              }
            }}
          >
            {marcado && <motion.span layoutId={`seg-${id}`} className="segmentado-indicador" transition={MOLA.aba} />}
            {o.curto ? (
              <>
                <span className="segmentado-longo">{o.rotulo}</span>
                <span className="segmentado-curto" aria-hidden>
                  {o.curto}
                </span>
              </>
            ) : (
              o.rotulo
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Linha de ajuste: azulejo, título/descrição e o controle à direita. */
export function Linha({ Icone, cor, titulo, descricao, children }: { Icone: IconeLucide; cor?: CorTile; titulo: string; descricao?: string; children?: ReactNode }) {
  return (
    <div className="linha-ajuste">
      <Azulejo Icone={Icone} cor={cor} />
      <div className="linha-ajuste-texto">
        <p className="linha-ajuste-titulo">{titulo}</p>
        {descricao && <p className="linha-ajuste-desc">{descricao}</p>}
      </div>
      {children}
    </div>
  );
}

/** Seção: placa de madeira com ícone + painel pergaminho com as linhas. */
export function Secao({ titulo, Icone, cor, children }: { titulo: string; Icone: IconeLucide; cor?: CorTile; children: ReactNode }) {
  return (
    <section>
      <h2 className="placa-secao">
        <Azulejo Icone={Icone} cor={cor} />
        {titulo}
      </h2>
      <div className="painel ajustes-painel lista-painel">{children}</div>
    </section>
  );
}

export function TelaAjustes() {
  const { data: estado } = useEstado();
  const qc = useQueryClient();
  const router = useRouter();
  const prefs = useUi((s) => s.preferencias);
  const definirPreferencias = useUi((s) => s.definirPreferencias);
  const atualizar = useAtualizarPerfil();
  const pwa = usePwa();
  const config = useQuery({ queryKey: ['config'], queryFn: async () => (await chamar<ConfigPublicaDTO>('GET', '/config')).data, staleTime: 5 * 60_000 });
  const [pushLigado, setPushLigado] = useState(false);
  const [instrucoesIos, setInstrucoesIos] = useState(false);
  const [excluir, setExcluir] = useState(false);
  const [textoExclusao, setTextoExclusao] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [virandoAdmin, setVirandoAdmin] = useState(false);
  const naoLidasSuporte = useNaoLidasSuporte();

  useEffect(() => {
    void notificacoesAtivas().then(setPushLigado);
  }, [pwa.swAtivo]);

  if (!estado) return null;

  const mudar = (parcial: Partial<Preferencias>) => {
    const novas = { ...prefs, ...parcial };
    definirPreferencias(novas);
    atualizar.mutate({ preferencias: parcial });
  };

  const alternarPush = async (ligar: boolean) => {
    try {
      if (ligar) {
        const r = await ativarNotificacoes(config.data?.push.vapidPublicKey ?? null);
        if (r === 'ok') {
          setPushLigado(true);
          toast('Pronto! Vamos avisar quando os ovos estiverem prontos.', 'sucesso');
        } else if (r === 'negado') toast('As notificações estão bloqueadas nas configurações do navegador.', 'erro');
        else toast('Notificações disponíveis no app instalado (versão de produção).', 'info');
      } else {
        await desativarNotificacoes();
        setPushLigado(false);
      }
    } catch (erro) {
      toast(mensagemDeErro(erro), 'erro');
    }
  };

  const sair = async () => {
    await chamar('POST', '/auth/sair').catch(() => {});
    limparCacheEstado();
    qc.clear();
    router.replace('/entrar');
  };

  const excluirConta = async () => {
    setOcupado(true);
    try {
      await chamar('DELETE', '/me', { corpo: { confirmacao: 'EXCLUIR MEU GALINHEIRO' } });
      limparCacheEstado();
      qc.clear();
      router.replace('/entrar');
    } catch (erro) {
      toast(mensagemDeErro(erro), 'erro');
      setOcupado(false);
    }
  };

  const ajustarRelogio = async (horas: number) => {
    try {
      await chamar('POST', '/dev/relogio', { corpo: { horas } });
      await qc.invalidateQueries({ queryKey: CHAVE_ESTADO });
      toast(horas === 0 ? 'Relógio de testes zerado.' : `Relógio adiantado ${horas >= 24 ? `${horas / 24} dia(s)` : `${horas} h`}.`);
    } catch (erro) {
      toast(mensagemDeErro(erro), 'erro');
    }
  };

  // só em desenvolvimento: a conta logada vira administradora (para testar o /admin)
  const virarAdmin = async () => {
    setVirandoAdmin(true);
    try {
      await chamar('POST', '/dev/admin');
      await Promise.all([qc.invalidateQueries({ queryKey: CHAVE_ESTADO }), qc.invalidateQueries({ queryKey: ['sessao'] })]);
      toast('Pronto! Esta conta agora é administradora.', 'sucesso');
    } catch (erro) {
      toast(mensagemDeErro(erro), 'erro');
    } finally {
      setVirandoAdmin(false);
    }
  };

  return (
    <div className="tela">
      <div className="tela-cabeca">
        <IconeAjustes className="tela-cabeca-icone" />
        <h1 className="titulo-tela">Configurações</h1>
      </div>

      <div className="ajustes-secoes">
        <Secao titulo="Som" Icone={Headphones} cor="azul">
          <div className="linha-ajuste-bloco ajustes-volume">
            <div className="flex items-center gap-3">
              <Azulejo Icone={Volume2} cor="azul" />
              <p className="linha-ajuste-titulo flex-1">Efeitos sonoros</p>
              <span className="valor-volume numeros" aria-hidden>
                {prefs.efeitosVolume}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={10}
              value={prefs.efeitosVolume}
              onChange={(e) => definirPreferencias({ ...prefs, efeitosVolume: Number(e.target.value) })}
              onPointerUp={(e) => mudar({ efeitosVolume: Number((e.target as HTMLInputElement).value) })}
              onKeyUp={(e) => mudar({ efeitosVolume: Number((e.target as HTMLInputElement).value) })}
              className="deslizador mt-1"
              style={{ ['--p' as string]: prefs.efeitosVolume }}
              aria-label="Volume dos efeitos"
            />
          </div>
          <Linha Icone={Music} cor="roxo" titulo="Som ambiente" descricao="Vento suave ao fundo">
            <Interruptor ligado={prefs.somAmbiente} aoMudar={(v) => mudar({ somAmbiente: v })} rotulo="Som ambiente" />
          </Linha>
          <Linha Icone={Vibrate} cor="rosa" titulo="Vibração">
            <Interruptor ligado={prefs.vibracao} aoMudar={(v) => mudar({ vibracao: v })} rotulo="Vibração" />
          </Linha>
        </Secao>

        <Secao titulo="Animações" Icone={Clapperboard} cor="roxo">
          <div className="linha-ajuste-bloco">
            <div className="mb-3 flex items-center gap-3">
              <Azulejo Icone={Sparkles} cor="ouro" />
              <p className="linha-ajuste-titulo flex-1">Reduzir animações</p>
            </div>
            <Segmentado
              rotulo="Reduzir animações"
              valor={prefs.reduzirAnimacoes}
              aoMudar={(v) => mudar({ reduzirAnimacoes: v })}
              opcoes={[
                { valor: 'sistema', rotulo: 'Como o sistema', curto: 'Sistema' },
                { valor: 'ligado', rotulo: 'Ligado' },
                { valor: 'desligado', rotulo: 'Desligado' },
              ]}
            />
          </div>
          <Linha Icone={FastForward} cor="azul" titulo="Pular animação da roleta">
            <Interruptor ligado={prefs.pularAnimacaoRoleta} aoMudar={(v) => mudar({ pularAnimacaoRoleta: v })} rotulo="Pular animação da roleta" />
          </Linha>
        </Secao>

        <Secao titulo="Notificações" Icone={Megaphone} cor="vermelho">
          <Linha
            Icone={pushLigado ? Bell : BellOff}
            cor={pushLigado ? 'verde' : 'cinza'}
            titulo="Avisar quando os ovos ficarem prontos"
            descricao={pushSuportado() ? 'No máximo 1 aviso por dia, entre 8 h e 22 h' : 'Seu navegador não suporta notificações'}
          >
            <Interruptor ligado={pushLigado} aoMudar={(v) => void alternarPush(v)} rotulo="Notificações" />
          </Linha>
        </Secao>

        <Secao titulo="App" Icone={Smartphone} cor="verde">
          <Linha Icone={Download} cor="verde" titulo="Instalar o app" descricao={pwa.instalado ? 'Instalado neste aparelho ✓' : 'Abre em tela cheia, direto da tela inicial'}>
            {!pwa.instalado &&
              (pwa.eventoInstalar ? (
                <button type="button" className="botao botao-primario botao-p" onClick={() => void instalarApp()}>
                  <span className="icone-contorno" aria-hidden>
                    <Download />
                    <Download />
                  </span>
                  Instalar
                </button>
              ) : ehIOS() ? (
                <button type="button" className="botao botao-secundario botao-p" onClick={() => setInstrucoesIos(true)}>
                  Como instalar
                </button>
              ) : (
                <span className="linha-ajuste-nota">Use o menu do navegador</span>
              ))}
          </Linha>
          <Link href="/extrato" className="linha-ajuste">
            <span className="tile-icone" data-cor="ouro" aria-hidden>
              <Moeda className="h-[30px] w-[30px]" />
            </span>
            <span className="linha-ajuste-texto">
              <span className="linha-ajuste-titulo">Extrato de moedas</span>
            </span>
            <ChevronRight className="linha-ajuste-seta" strokeWidth={3} aria-hidden />
          </Link>
          <Link href="/saque" className="linha-ajuste">
            <Azulejo Icone={Banknote} cor="madeira" />
            <span className="linha-ajuste-texto">
              <span className="linha-ajuste-titulo block">Sacar no PIX</span>
              <span className="linha-ajuste-desc block">Taxa de R$ 5,00 + 4% em cima do valor. Nos 3 primeiros dias, só o bônus do cadastro sai na hora</span>
            </span>
            <ChevronRight className="linha-ajuste-seta" strokeWidth={3} aria-hidden />
          </Link>
        </Secao>

        <Secao titulo="Conta" Icone={UserRound} cor="madeira">
          <Linha Icone={UserRound} cor="madeira" titulo="Nome" descricao={estado.conta.nome} />
          <Linha Icone={Phone} cor="azul" titulo="Telefone" descricao={estado.conta.telefone ? formatarTelefone(estado.conta.telefone) : '—'} />
          <Linha Icone={Mail} cor="verde" titulo="E-mail" descricao={estado.conta.email} />
          <Link href="/convites" className="linha-ajuste">
            <span className="tile-icone" data-cor="rosa" aria-hidden>
              <IconeConvite />
            </span>
            <span className="linha-ajuste-texto">
              <span className="linha-ajuste-titulo block">Convidar amigos</span>
              <span className="linha-ajuste-desc block">Ganhe moedas do jogo quando eles venderem ovos</span>
            </span>
            <ChevronRight className="linha-ajuste-seta" strokeWidth={3} aria-hidden />
          </Link>
          <Link href="/intercambio?cupom=1&de=ajustes" className="linha-ajuste">
            <span className="tile-icone" data-cor="creme" aria-hidden>
              <IconeTicket />
            </span>
            <span className="linha-ajuste-texto">
              <span className="linha-ajuste-titulo block">Resgatar cupom</span>
              <span className="linha-ajuste-desc block">Códigos da equipe viram tickets do Intercâmbio</span>
            </span>
            <ChevronRight className="linha-ajuste-seta" strokeWidth={3} aria-hidden />
          </Link>
          <Link
            href="/suporte"
            className="linha-ajuste"
            aria-label={
              naoLidasSuporte > 0
                ? `Falar com o suporte (${naoLidasSuporte} ${naoLidasSuporte === 1 ? 'mensagem nova' : 'mensagens novas'})`
                : 'Falar com o suporte'
            }
          >
            <Azulejo Icone={MessagesSquare} cor="azul" />
            <span className="linha-ajuste-texto">
              <span className="linha-ajuste-titulo block">Falar com o suporte</span>
              <span className="linha-ajuste-desc block">
                {naoLidasSuporte > 0
                  ? `${naoLidasSuporte} ${naoLidasSuporte === 1 ? 'resposta nova' : 'respostas novas'} da equipe`
                  : 'Dúvidas, problemas ou sugestões'}
              </span>
            </span>
            {naoLidasSuporte > 0 && (
              <span className="badge suporte-badge-linha" aria-hidden>
                {naoLidasSuporte > 99 ? '99+' : naoLidasSuporte}
              </span>
            )}
            <ChevronRight className="linha-ajuste-seta" strokeWidth={3} aria-hidden />
          </Link>
          {estado.conta.admin && (
            <Link href="/admin" className="linha-ajuste">
              <Azulejo Icone={ShieldCheck} cor="roxo" />
              <span className="linha-ajuste-texto">
                <span className="linha-ajuste-titulo block">Painel administrador</span>
                <span className="linha-ajuste-desc block">Usuários, atendimento e avisos</span>
              </span>
              <ChevronRight className="linha-ajuste-seta" strokeWidth={3} aria-hidden />
            </Link>
          )}
          <button type="button" className="linha-ajuste" onClick={() => void sair()}>
            <Azulejo Icone={LogOut} cor="creme" />
            <span className="linha-ajuste-texto linha-ajuste-titulo">Sair</span>
            <ChevronRight className="linha-ajuste-seta" strokeWidth={3} aria-hidden />
          </button>
          <button type="button" className="linha-ajuste" onClick={() => setExcluir(true)}>
            <Azulejo Icone={Trash2} cor="vermelho" />
            <span className="linha-ajuste-texto linha-ajuste-titulo text-perigo-escura">Excluir conta e dados</span>
            <ChevronRight className="linha-ajuste-seta" strokeWidth={3} aria-hidden />
          </button>
        </Secao>

        {config.data?.dev.relogioAjustavel && (
          <Secao titulo="Desenvolvimento" Icone={Wrench} cor="cinza">
            <div className="linha-ajuste-bloco">
              <p className="flex items-start gap-3 text-sm text-texto-suave">
                <Azulejo Icone={Clock} cor="cinza" />
                <span>
                  <span className="linha-ajuste-titulo block">Ferramentas de teste (só em desenvolvimento)</span>
                  Adianta o relógio do servidor para testar ciclos, cansaço e aposentadorias.
                </span>
              </p>
              <div className="ajustes-dev-grade">
                {[
                  ['+1 h', 1],
                  ['+6 h', 6],
                  ['+1 dia', 24],
                  ['+10 dias', 240],
                  ['+30 dias', 720],
                  ['Zerar', 0],
                ].map(([rotulo, horas]) => (
                  <button
                    key={rotulo}
                    type="button"
                    className={cx('botao botao-p px-1', horas === 0 ? 'botao-perigo' : 'botao-compra')}
                    onClick={() => void ajustarRelogio(Number(horas))}
                  >
                    {horas === 0 && (
                      <span className="icone-contorno" aria-hidden>
                        <RotateCcw />
                        <RotateCcw />
                      </span>
                    )}
                    {rotulo}
                  </button>
                ))}
              </div>
            </div>
            <div className="linha-ajuste-bloco">
              <p className="flex items-start gap-3 text-sm text-texto-suave">
                <Azulejo Icone={ShieldCheck} cor="roxo" />
                <span>
                  <span className="linha-ajuste-titulo block">Conta administradora</span>
                  {estado.conta.admin ? 'Esta conta já abre o painel administrador.' : 'Libera o painel administrador (/admin) para esta conta.'}
                </span>
              </p>
              <button
                type="button"
                className="botao botao-primario botao-p mt-3 w-full"
                onClick={() => void virarAdmin()}
                disabled={virandoAdmin || estado.conta.admin}
              >
                <span className="icone-contorno" aria-hidden>
                  <ShieldCheck />
                  <ShieldCheck />
                </span>
                {estado.conta.admin ? 'Esta conta já é admin' : 'Tornar esta conta admin'}
              </button>
            </div>
          </Secao>
        )}

        <p className="ajustes-rodape">
          Galinheiro Idle · build {VERSAO_APP} · config {CONFIG_VERSAO}
          <br />
          Moedas, ovos e animais existem só dentro do jogo.
        </p>
      </div>

      <Modal aberto={instrucoesIos} aoFechar={() => setInstrucoesIos(false)} titulo="Instalar no iPhone/iPad">
        <ol className="passos">
          <li>
            <span>
              Toque em <Share className="inline h-5 w-5 align-[-3px] text-compra-escura" /> <strong>Compartilhar</strong> no Safari.
            </span>
          </li>
          <li>
            <span>
              Escolha <SquarePlus className="inline h-5 w-5 align-[-3px] text-compra-escura" /> <strong>Adicionar à Tela de Início</strong>.
            </span>
          </li>
          <li>Abra o Galinheiro pelo ícone novo.</li>
        </ol>
      </Modal>

      <Modal aberto={excluir} aoFechar={() => setExcluir(false)} titulo="Excluir conta" variante="perigo">
        <p className="text-sm">
          Isso apaga para sempre seus animais, moedas, ovos e extrato. Para confirmar, digite <strong>EXCLUIR MEU GALINHEIRO</strong>.
        </p>
        <input className="campo mt-3" value={textoExclusao} onChange={(e) => setTextoExclusao(e.target.value)} aria-label="Confirmação" data-autofoco />
        <button type="button" className="botao botao-perigo mt-4 w-full" disabled={textoExclusao !== 'EXCLUIR MEU GALINHEIRO' || ocupado} onClick={() => void excluirConta()}>
          <span className="icone-contorno" aria-hidden>
            <Trash2 />
            <Trash2 />
          </span>
          Excluir tudo
        </button>
      </Modal>
    </div>
  );
}
