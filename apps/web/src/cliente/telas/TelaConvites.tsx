'use client';

// Convide amigos (programa de convites e afiliação, lado do jogador). Cada membro tem um código e um link curto
// (/c/CODIGO). Quem se cadastra por ele entra na rede de quem convidou e cada VENDA DE OVOS dessa pessoa rende
// uma comissão, paga pelo jogo, para quem está acima: nível 1 (quem convidou), nível 2… A % de cada nível e o
// teto diário vêm do painel (config) — nada fica fixo aqui. Tudo em MOEDAS DO JOGO: nada vira dinheiro.
// Visual (DIRECAO_DE_ARTE 4): cabeçalho com o envelope ilustrado; Seu Juca apresenta o programa num balão; o
// código num bilhete dourado, o link e o "Compartilhar" num painel com faixa; ganhos numa placa de madeira com
// raios; níveis em selos coloridos (a mesma cor do nível em todas as listas); convidados e comissões em
// pergaminho, com estados vazios do Seu Juca.
import type { ComissaoDTO, ConfigAfiliadosDTO, IndicadoDTO, MeuConviteDTO } from '@galinheiro/api-contract';
import {
  Check, ChevronDown, ChevronLeft, CirclePause, Copy, Hourglass, Lightbulb, Link2, Network, Share2, ShieldCheck, UserRoundPlus,
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Moeda } from '../arte/Icones';
import { Juca } from '../arte/Juca';
import { useConexao } from '../conexao';
import { IconeConvite } from '../convites/IconeConvite';
import { useMeuConvite } from '../convites/consultas';
import { AVISO_MOEDAS, compartilharConvite, copiarTexto, desde, porcento, quando, quemNoNivel } from '../convites/texto';
import { marcarConvitesVistos } from '../convites/visto';
import { EASE, entradaDeLista } from '../movimento';
import { som } from '../som';
import { toast } from '../ui';
import { cx, mensagemDeErro, moedas } from '../util';
import { Azulejo } from './TelaAjustes';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Cor do selo/ladrilho de cada nível (1 a 5): a mesma em "Como funciona", "Sua rede" e nas comissões. */
const corNivel = (nivel: number) => String(Math.min(Math.max(nivel, 1), 5));

// ---------------------------------------------------------------- peças

/** Placa de madeira pregada (cabeçalho de seção) + conteúdo. */
function Secao({ id, titulo, icone, extra, children }: { id: string; titulo: string; icone: ReactNode; extra?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="placa-secao">
        {icone}
        {titulo}
        {extra}
      </h2>
      {children}
    </section>
  );
}

/** Seu Juca apresentando o programa (1–2 frases). */
function Apresentacao({ pausado }: { pausado: boolean }) {
  const [falando, setFalando] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setFalando(false), 3600);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="balao-juca convites-apresentacao">
      <motion.div
        className="balao-juca-figura"
        style={{ transformOrigin: '50% 100%' }}
        initial={{ scale: 0.4, y: 24 }}
        animate={{ scale: 1, y: 0, transition: { type: 'spring', visualDuration: 0.34, bounce: 0.45 } }}
      >
        <Juca expressao={falando ? 'falando' : 'feliz'} acenando sombra={false} />
      </motion.div>
      <motion.div
        className="painel balao"
        style={{ transformOrigin: '0% 85%' }}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, transition: { delay: 0.1, duration: 0.32, ease: EASE.elastico } }}
      >
        <span className="pilula pilula-aviso balao-nome">Seu Juca</span>
        <p className="balao-texto">
          {pausado
            ? 'Os convites estão de folga, mas a porteira continua aberta: pode chamar a turma para o galinheiro!'
            : 'Chame seus amigos para o galinheiro! Cada venda de ovos deles rende moedas do jogo para você, e eles não perdem nada.'}
        </p>
      </motion.div>
    </div>
  );
}

function BannerPausado() {
  return (
    <div className="painel-escuro aviso convites-pausado" role="status">
      <span className="toast-icone" aria-hidden>
        <span className="icone-contorno">
          <CirclePause />
          <CirclePause />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="convites-pausado-titulo">Programa de convites pausado</p>
        <p className="convites-pausado-texto">
          Por enquanto, as vendas de ovos dos seus convidados não rendem comissões. Seu link continua valendo: quem entrar por ele fica na sua rede.
        </p>
      </div>
    </div>
  );
}

/** Código no bilhete dourado, o link e as ações (copiar código, copiar link, compartilhar). */
function CartaoDoConvite({ codigo, link }: { codigo: string; link: string }) {
  const [copiado, setCopiado] = useState<'codigo' | 'link' | null>(null);
  const [compartilhando, setCompartilhando] = useState(false);
  const relogio = useRef(0);
  useEffect(() => () => window.clearTimeout(relogio.current), []);

  const marcar = (qual: 'codigo' | 'link') => {
    setCopiado(qual);
    window.clearTimeout(relogio.current);
    relogio.current = window.setTimeout(() => setCopiado(null), 2000);
  };

  const copiar = async (qual: 'codigo' | 'link') => {
    som.toque();
    if (await copiarTexto(qual === 'codigo' ? codigo : link)) {
      marcar(qual);
      toast(qual === 'codigo' ? 'Código copiado!' : 'Link copiado! Agora é só mandar para um amigo.', 'sucesso');
    } else {
      toast('Não deu para copiar. Toque e segure no link para copiar.', 'erro');
    }
  };

  const compartilhar = async () => {
    if (compartilhando) return;
    setCompartilhando(true);
    som.toque();
    try {
      const r = await compartilharConvite(link, codigo);
      if (r === 'copiado') {
        toast('Convite copiado! Cole numa conversa para mandar.', 'sucesso');
      } else if (r === 'falhou') {
        toast('Não deu para compartilhar. Copie o link aqui em cima.', 'erro');
      }
    } finally {
      setCompartilhando(false);
    }
  };

  // o endereço sem "https://", com o código destacado no fim
  const semProtocolo = link.replace(/^https?:\/\//, '');
  const corte = semProtocolo.lastIndexOf(codigo);
  const inicio = corte > 0 ? semProtocolo.slice(0, corte) : semProtocolo;
  const fim = corte > 0 ? semProtocolo.slice(corte) : '';

  return (
    <section className="painel painel-com-faixa convites-cartao" aria-labelledby="convites-seu-convite">
      <h2 id="convites-seu-convite" className="faixa">
        Seu convite
      </h2>

      <p className="convites-rotulo">Seu código</p>
      <div className="convites-bilhete">
        <span className="convites-bilhete-brilho" aria-hidden />
        <span className="convites-codigo texto-contorno">{codigo}</span>
        <button
          type="button"
          className="botao botao-secundario botao-icone convites-copiar-codigo"
          data-copiado={copiado === 'codigo' ? '' : undefined}
          onClick={() => void copiar('codigo')}
          aria-label={copiado === 'codigo' ? 'Código copiado' : 'Copiar código'}
          title="Copiar código"
        >
          {copiado === 'codigo' ? <Check strokeWidth={3.2} aria-hidden /> : <Copy aria-hidden />}
        </button>
      </div>

      <p className="convites-rotulo convites-rotulo-link">Seu link</p>
      <p className="convites-link">
        <Link2 aria-hidden />
        <span className="convites-link-texto">
          {inicio}
          {fim && <b>{fim}</b>}
        </span>
      </p>

      <div className="convites-acoes">
        <button type="button" className="botao botao-secundario convites-acao" data-copiado={copiado === 'link' ? '' : undefined} onClick={() => void copiar('link')}>
          {copiado === 'link' ? <Check strokeWidth={3.2} aria-hidden /> : <Copy strokeWidth={2.6} aria-hidden />}
          {copiado === 'link' ? 'Copiado!' : 'Copiar link'}
        </button>
        {/* sem "disabled" enquanto a folha de compartilhar está aberta: o botão não fica cinza piscando */}
        <button type="button" className="botao botao-primario botao-brilho convites-acao" onClick={() => void compartilhar()} aria-busy={compartilhando || undefined}>
          <span className="icone-contorno" aria-hidden>
            <Share2 />
            <Share2 />
          </span>
          Compartilhar
        </button>
      </div>
    </section>
  );
}

/** Placa de madeira com o total ganho, hoje e 30 dias (e o teto do dia, se houver). */
function PlacaGanhos({ ganhos, teto }: { ganhos: MeuConviteDTO['ganhos']; teto: number | null }) {
  const pctHoje = teto ? Math.min(100, (ganhos.hojeX100 / teto) * 100) : 0;
  const bateuTeto = teto !== null && ganhos.hojeX100 >= teto;
  return (
    <section className="painel-madeira convites-ganhos" aria-labelledby="convites-ganhos-titulo">
      <div className="convites-ganhos-topo">
        <Moeda className="convites-ganhos-moeda" />
        <div className="min-w-0">
          <h2 id="convites-ganhos-titulo" className="convites-ganhos-rotulo">
            Ganhos com convites
          </h2>
          <p className="convites-ganhos-total texto-contorno numeros">
            {moedas(ganhos.totalX100)}
            <span className="sr-only"> moedas no total</span>
          </p>
        </div>
      </div>
      <dl className="convites-ganhos-grade">
        <div className="convites-ganho">
          <dt className="convites-ganho-rotulo">Hoje</dt>
          <dd className="convites-ganho-valor numeros">
            <Moeda />
            {moedas(ganhos.hojeX100)}
            <span className="sr-only"> moedas</span>
          </dd>
        </div>
        <div className="convites-ganho">
          <dt className="convites-ganho-rotulo">
            <span className="convites-so-largo">Últimos </span>30 dias
          </dt>
          <dd className="convites-ganho-valor numeros">
            <Moeda />
            {moedas(ganhos.dias30X100)}
            <span className="sr-only"> moedas</span>
          </dd>
        </div>
      </dl>
      {teto !== null && (
        <div className="convites-teto">
          <p className="convites-teto-linha">
            <span>{bateuTeto ? 'Teto de hoje atingido!' : 'Teto de comissões por dia'}</span>
            <span className="numeros">
              {moedas(Math.min(ganhos.hojeX100, teto))} / {moedas(teto)}
            </span>
          </p>
          <div
            className="barra"
            data-cor="ouro"
            role="progressbar"
            aria-label="Comissões de hoje em relação ao teto diário"
            aria-valuemin={0}
            aria-valuemax={teto / 100}
            aria-valuenow={Math.min(ganhos.hojeX100, teto) / 100}
          >
            <span className="barra-preenchimento" style={{ ['--p' as string]: pctHoje }} />
          </div>
        </div>
      )}
    </section>
  );
}

/** Níveis com a % de cada um (do painel), o teto, "o amigo não perde nada" e o aviso das moedas do jogo. */
function ComoFunciona({ config }: { config: ConfigAfiliadosDTO }) {
  return (
    <Secao id="convites-como" titulo="Como funciona" icone={<Azulejo Icone={Lightbulb} cor="ouro" />}>
      <div className="painel convites-como">
        <p className="convites-como-intro">Cada venda de ovos da sua rede rende para você uma parte do valor:</p>
        <ul className="lista-painel convites-niveis">
          {config.comissoesBp.map((bp, i) => {
            const nivel = i + 1;
            return (
              <li key={nivel} className="convites-nivel">
                <span className="sr-only">
                  {bp > 0 ? `Nível ${nivel} — ${quemNoNivel(nivel)}: ${porcento(bp)} das vendas de ovos` : `Nível ${nivel} — ${quemNoNivel(nivel)}: sem comissão`}
                </span>
                <span className="convites-pct" data-nivel={corNivel(nivel)} data-zero={bp > 0 ? undefined : ''} aria-hidden>
                  {bp > 0 ? porcento(bp) : '0%'}
                </span>
                <span className="convites-nivel-texto" aria-hidden>
                  <span className="convites-nivel-titulo">Nível {nivel}</span>
                  <span className="convites-nivel-desc">{maiuscula(quemNoNivel(nivel))}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <ul className="convites-notas">
          <li className="convites-nota">
            <span className="convites-nota-icone" data-cor="verde" aria-hidden>
              <ShieldCheck />
            </span>
            <span>
              <strong>Seu amigo não perde nada:</strong> quem paga a comissão é o jogo, e ele recebe a venda inteira.
            </span>
          </li>
          {config.tetoDiarioX100 !== null && (
            <li className="convites-nota">
              <span className="convites-nota-icone" data-cor="azul" aria-hidden>
                <Hourglass />
              </span>
              <span>
                Você recebe até{' '}
                <strong className="convites-nota-valor numeros">
                  {moedas(config.tetoDiarioX100)}
                  <Moeda />
                </strong>{' '}
                por dia em comissões.
              </span>
            </li>
          )}
          <li className="convites-nota convites-nota-moedas">
            <Moeda className="convites-nota-moeda" />
            <strong>{AVISO_MOEDAS}</strong>
          </li>
        </ul>
      </div>
    </Secao>
  );
}

/** Quantos em cada nível da rede (+ quem convidou o membro, se alguém convidou). */
function SuaRede({ rede, indicadoPor }: { rede: number[]; indicadoPor: string | null }) {
  const total = rede.reduce((a, b) => a + b, 0);
  return (
    <Secao id="convites-rede" titulo="Sua rede" icone={<Azulejo Icone={Network} cor="verde" />}>
      <div className="painel convites-rede">
        {indicadoPor && (
          <p className="convites-indicado-por">
            <IconeConvite />
            <span>
              Você foi convidado(a) por <strong>{indicadoPor}</strong>
            </span>
          </p>
        )}
        <ul className="convites-rede-grade">
          {rede.map((qtd, i) => (
            <li key={i} className="convites-rede-nivel" data-nivel={corNivel(i + 1)} data-vazio={qtd === 0 ? '' : undefined}>
              <span className="convites-rede-numero numeros" aria-hidden>
                {qtd}
              </span>
              <span className="convites-rede-rotulo" aria-hidden>
                Nível {i + 1}
              </span>
              <span className="sr-only">
                Nível {i + 1}: {plural(qtd, 'pessoa', 'pessoas')}
              </span>
            </li>
          ))}
        </ul>
        <p className="convites-rede-total">
          {total === 0 ? 'Sua rede ainda está vazia: comece mandando o seu link.' : `${plural(total, 'pessoa', 'pessoas')} na sua rede`}
        </p>
      </div>
    </Secao>
  );
}

const CORES_AVATAR = ['laranja', 'azul', 'roxo', 'verde', 'rosa'] as const;
const corDoNome = (nome: string) => CORES_AVATAR[[...nome].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 7) % CORES_AVATAR.length];

function Vazio({ titulo, texto, juca = 'piscando' }: { titulo: string; texto: string; juca?: 'piscando' | 'feliz' }) {
  return (
    <div className="painel convites-vazio">
      <Juca expressao={juca} sombra={false} parado className="convites-vazio-juca" />
      <div className="min-w-0">
        <p className="convites-vazio-titulo">{titulo}</p>
        <p className="convites-vazio-texto">{texto}</p>
      </div>
    </div>
  );
}

/** Listas longas abrem 6 itens; o resto fica atrás de "Ver todos". */
const ITENS_INICIAIS = 6;

function useListaRecolhida<T>(itens: T[]) {
  const [aberta, setAberta] = useState(false);
  const sobra = itens.length - ITENS_INICIAIS;
  return {
    visiveis: aberta || sobra <= 0 ? itens : itens.slice(0, ITENS_INICIAIS),
    rodape:
      sobra > 0 ? (
        <li className="convites-ver-mais-linha">
          <button type="button" className="convites-ver-mais" aria-expanded={aberta} onClick={() => setAberta((a) => !a)}>
            {aberta ? 'Mostrar menos' : `Ver todos (${itens.length})`}
            <ChevronDown className="convites-ver-mais-seta" strokeWidth={3} aria-hidden />
          </button>
        </li>
      ) : null,
  };
}

/** Indicados diretos: nome curto, desde quando, se jogou nos últimos 7 dias e quanto rendeu para o membro. */
function Convidados({ indicados, total }: { indicados: IndicadoDTO[]; total: number }) {
  const { visiveis, rodape } = useListaRecolhida(indicados);
  return (
    <Secao
      id="convites-amigos"
      titulo="Seus convidados"
      icone={<Azulejo Icone={UserRoundPlus} cor="rosa" />}
      extra={total > 0 ? <span className="convites-placa-contagem numeros">{total}</span> : undefined}
    >
      {indicados.length === 0 ? (
        <Vazio titulo="Ninguém por aqui ainda" texto="Mande o seu link para um amigo. Quando ele criar a conta, ele aparece aqui." />
      ) : (
        <ul className="painel lista-painel convites-lista">
          {visiveis.map((a, i) => (
            <motion.li key={`${a.nome}-${a.desde}-${i}`} className="convites-linha" {...entradaDeLista(i % ITENS_INICIAIS)}>
              <span className="convites-avatar" data-cor={corDoNome(a.nome)} data-ativo={a.ativo7d ? '' : undefined} aria-hidden>
                {a.nome.charAt(0).toUpperCase()}
              </span>
              <div className="convites-linha-texto">
                <p className="convites-linha-titulo">{a.nome}</p>
                <p className="convites-linha-meta">
                  <span className={cx('pilula', a.ativo7d ? 'pilula-pronto' : 'convites-pilula-inativo')}>{a.ativo7d ? 'Ativo' : 'Inativo'}</span>
                  <span className="sr-only">{a.ativo7d ? ' (jogou nos últimos 7 dias), ' : ' (não joga há mais de 7 dias), '}</span>
                  <span>{desde(a.desde)}</span>
                </p>
              </div>
              <div className="convites-rendeu">
                <span className="convites-rendeu-rotulo">rendeu</span>
                <span className="extrato-valor numeros" data-sinal="mais" data-zero={a.rendeuX100 > 0 ? undefined : ''}>
                  {a.rendeuX100 > 0 ? '+' : ''}
                  {moedas(a.rendeuX100)}
                  <Moeda />
                  <span className="sr-only"> moedas</span>
                </span>
              </div>
            </motion.li>
          ))}
          {rodape}
        </ul>
      )}
      {total > indicados.length && (
        <p className="convites-mais">
          Mostrando os {indicados.length} mais recentes de {total}.
        </p>
      )}
    </Secao>
  );
}

/** Últimas comissões recebidas: nível, de quem, valor e quando. */
function UltimasComissoes({ ultimas }: { ultimas: ComissaoDTO[] }) {
  const { visiveis, rodape } = useListaRecolhida(ultimas);
  return (
    <Secao
      id="convites-comissoes"
      titulo="Últimas comissões"
      icone={
        <span className="tile-icone" data-cor="ouro" aria-hidden>
          <Moeda className="convites-placa-moeda" />
        </span>
      }
    >
      {ultimas.length === 0 ? (
        <Vazio juca="feliz" titulo="Nenhuma comissão ainda" texto="Quando alguém da sua rede vender ovos, a sua parte aparece aqui, direto no seu saldo." />
      ) : (
        <ul className="painel lista-painel convites-lista" aria-label="Sua parte nas últimas vendas de ovos da sua rede">
          {visiveis.map((k, i) => (
            <motion.li key={k.id} className="convites-linha" {...entradaDeLista(i % ITENS_INICIAIS)}>
              <span className="convites-pct convites-pct-p" data-nivel={corNivel(k.nivel)} aria-hidden>
                {k.nivel}
              </span>
              <div className="convites-linha-texto">
                <p className="convites-linha-titulo">
                  <span className="sr-only">Venda de ovos de </span>
                  {k.origem ?? 'um convidado'}
                </p>
                <p className="convites-linha-meta">
                  <span>Nível {k.nivel}</span>
                  {/* o "·" anda com a hora: abaixo de 360 px a hora desce para a própria linha, sem o ponto */}
                  <span className="convites-meta-quando">
                    <span className="convites-meta-sep" aria-hidden>
                      ·{' '}
                    </span>
                    <time dateTime={k.criadoEm}>{quando(k.criadoEm)}</time>
                  </span>
                </p>
              </div>
              <span className="extrato-valor numeros" data-sinal="mais">
                +{moedas(k.valorX100)}
                <Moeda />
                <span className="sr-only"> moedas</span>
              </span>
            </motion.li>
          ))}
          {rodape}
        </ul>
      )}
    </Secao>
  );
}

function Esqueleto() {
  return (
    <div className="convites-esqueleto" role="status">
      <span className="sr-only">Carregando seus convites…</span>
      <span aria-hidden className="convites-esqueleto-cartao" />
      <span aria-hidden className="convites-esqueleto-ganhos" />
      <span aria-hidden />
    </div>
  );
}

// ---------------------------------------------------------------- tela

export function TelaConvites() {
  const params = useSearchParams();
  // quem veio pelo cartão da Loja volta para a Loja; o resto, para as configurações
  const veioDaLoja = params?.get('de') === 'loja';
  const online = useConexao((s) => s.online);
  const consulta = useMeuConvite();
  const d = consulta.data;
  const pausado = !!d && !d.config.ativo;
  // o selo "NOVO" do cartão da Loja sai depois da primeira visita
  useEffect(() => marcarConvitesVistos(), []);

  return (
    <div className="tela convites-tela">
      <div className="tela-cabeca">
        <Link
          href={veioDaLoja ? '/loja' : '/ajustes'}
          className="botao botao-icone botao-secundario tela-cabeca-voltar"
          aria-label={veioDaLoja ? 'Voltar para a loja' : 'Voltar para as configurações'}
        >
          <ChevronLeft strokeWidth={3} />
        </Link>
        <IconeConvite className="tela-cabeca-icone" />
        <h1 className="titulo-tela">Convide amigos</h1>
      </div>

      {/* celular: uma coluna só; desktop: o convite e os ganhos à esquerda (presos ao rolar), a explicação e os
          números da rede à direita */}
      <div className="convites-secoes">
        {pausado && <BannerPausado />}
        <div className="convites-coluna convites-coluna-convite">
          <Apresentacao pausado={pausado} />
          {!d ? (
            consulta.isError ? (
              <div className="painel convites-erro" role="alert">
                <Juca expressao="surpreso" sombra={false} className="convites-erro-juca" />
                <p className="convites-erro-titulo">Não consegui abrir seus convites.</p>
                <p className="convites-erro-texto">{online ? mensagemDeErro(consulta.error) : 'Sem conexão com a internet.'}</p>
                <button type="button" className="botao botao-primario mt-2" onClick={() => void consulta.refetch()} disabled={consulta.isFetching}>
                  {consulta.isFetching ? 'Tentando…' : 'Tentar de novo'}
                </button>
              </div>
            ) : (
              <Esqueleto />
            )
          ) : (
            <>
              <motion.div {...entradaDeLista(0)}>
                <CartaoDoConvite codigo={d.codigo} link={`${window.location.origin}${d.caminho}`} />
              </motion.div>
              <motion.div {...entradaDeLista(1)}>
                <PlacaGanhos ganhos={d.ganhos} teto={d.config.tetoDiarioX100} />
              </motion.div>
            </>
          )}
        </div>
        {d && (
          <div className="convites-coluna">
            <ComoFunciona config={d.config} />
            <SuaRede rede={d.rede} indicadoPor={d.indicadoPor} />
            <Convidados indicados={d.indicados} total={d.totalIndicados} />
            <UltimasComissoes ultimas={d.ultimas} />
          </div>
        )}
      </div>
    </div>
  );
}
