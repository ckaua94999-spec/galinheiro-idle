'use client';

// Bottom sheet da carta (GDD 6.5) e modal Info (GDD 6.12).
import type { EntityDetalheDTO, EntityDTO } from '@galinheiro/api-contract';
import { NOME_RARIDADE, NOME_TIER, NOME_TIPO, formatarTimer } from '@galinheiro/game-core';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Cake, CalendarHeart, Clock, Egg, Gift, Heart, Info, Pencil, RefreshCw, Smile, Sparkles, Sunset } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { chamar } from '../api';
import { FiguraAnimal } from '../arte/Animal';
import { Moeda, Ovo } from '../arte/Icones';
import { estaProntoAgora, humorDe, vidaDe } from '../derivados';
import { useRenomear, type Estado } from '../estado';
import { useAgora } from '../relogio';
import { som } from '../som';
import { toast, useUi } from '../ui';
import { useAcoes } from '../useAcoes';
import { cx, formatarDataHora, mensagemDeErro, moedas } from '../util';
import { BarraVida } from './BarraVida';
import { Carta } from './Carta';
import { Folha, Modal } from './Modal';

function useEntidade(id: string | null, local: EntityDTO | undefined) {
  return useQuery({
    queryKey: ['entidade', id],
    queryFn: async () => (await chamar<EntityDetalheDTO>('GET', `/entities/${id}`)).data,
    enabled: !!id && !local,
    staleTime: 30_000,
  });
}

/** Tamanho de referência da carta na folha: ela é diagramada sempre com 300 px de largura (o desenho
 *  "oficial") e encolhe inteira com scale (cartas.css, .carta-palco-escala). */
const CARTA_REF = 300;
/** Proporção da carta (altura ÷ largura), a mesma do aspect-ratio de .carta-corpo. */
const PROPORCAO_CARTA = 1.32;
/** Piso da escala (carta de ~228 px): abaixo disso o texto da ficha fica miúdo — a folha prefere rolar um pouco. */
const ESCALA_MIN = 0.76;
/** Respiro lateral mínimo entre a borda da carta e a borda do palco (que corta com overflow: hidden): 16 px de
 *  ar + ~6 px que o selo do ovo e a fita passam da moldura. Vale para toda carta, com ou sem botão Coletar. */
const MARGEM_LATERAL = 22;

/**
 * Escala da carta da folha pelo espaço REAL: mede tudo que não é a carta (cabeça da folha, palco, ações),
 * vê quanto cabe e resolve a escala para a folha terminar logo abaixo da 1ª linha do HUD (moedas/ovos/
 * ninhos continuam à vista; a 2ª linha fica inteira coberta, sem corte no meio do texto). Nada de
 * constantes de outras áreas: se a cabeça da folha ou os botões mudarem de altura, a conta acompanha.
 * Escreve --carta-escala (e --palco-folga) no palco; sem JS valem as escalas aproximadas de cartas.css.
 */
function useEscalaNoPalco(chave: string | undefined) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const palco = ref.current;
    const painel = palco?.closest<HTMLElement>('.painel.folha');
    const rolagem = painel?.querySelector<HTMLElement>('.folha-corpo');
    if (!palco || !painel || !rolagem) return;
    let quadro = 0;
    // o palco pode vir de outra carta (a folha não desmonta entre cartas): parte do que já está escrito nele
    let escalaAtual = parseFloat(getComputedStyle(palco).getPropertyValue('--carta-escala')) || 1;
    let folgaAtual = parseFloat(palco.style.getPropertyValue('--palco-folga')) || 0;
    const ajustar = () => {
      if (!palco.querySelector('.carta-corpo')) return;
      // offset*/scroll* ignoram transform: a entrada (scale/translate) não atrapalha a medida.
      // A carta ocupa no layout exatamente 300 × 396 × escala (as margens negativas devolvem o resto).
      const conteudo = painel.offsetHeight - rolagem.clientHeight + rolagem.scrollHeight;
      const sobra = conteudo - CARTA_REF * PROPORCAO_CARTA * escalaAtual - folgaAtual;
      const alturaTela = window.innerHeight;
      const maxFolha = parseFloat(getComputedStyle(painel).maxHeight) || alturaTela * 0.92;
      let alvo = maxFolha;
      let linha2: DOMRect | undefined;
      // no celular a folha sobe do rodapé: para logo abaixo da 1ª linha do HUD (no desktop ela fica centrada)
      if (!window.matchMedia('(min-width: 640px)').matches) {
        const linhas = document.querySelectorAll<HTMLElement>('.hud-linha');
        const hud = linhas[0]?.getBoundingClientRect();
        linha2 = linhas[1]?.getBoundingClientRect();
        if (hud && hud.bottom > 0 && hud.bottom < alturaTela * 0.2) alvo = Math.min(alvo, alturaTela - (hud.bottom + 4));
      }
      // também cabe na largura do palco (telas bem estreitas), sem encostar selo/fita na borda: a carta
      // aposentada (sem Coletar) sobra altura e, sem este respiro, encostava de lado a lado em 320 px
      const estilo = getComputedStyle(palco);
      const larguraUtil =
        palco.clientWidth - Math.max(MARGEM_LATERAL, parseFloat(estilo.paddingLeft)) - Math.max(MARGEM_LATERAL, parseFloat(estilo.paddingRight));
      const porAltura = (alvo - sobra) / (CARTA_REF * PROPORCAO_CARTA);
      const escala = Math.round(Math.min(1, larguraUtil / CARTA_REF, Math.max(ESCALA_MIN, porAltura)) * 1000) / 1000;
      // carta no teto (escala 1) e a folha parando no meio da 2ª linha do HUD (texto decepado na borda):
      // o palco ganha a diferença como respiro e a folha cobre a linha inteira
      let folga = 0;
      const altura = sobra + CARTA_REF * PROPORCAO_CARTA * escala;
      if (linha2 && escala === 1 && alturaTela - altura < linha2.bottom + 6) folga = Math.max(0, Math.floor(alvo - altura));
      if (escala !== escalaAtual || !palco.style.getPropertyValue('--carta-escala')) {
        escalaAtual = escala;
        palco.style.setProperty('--carta-escala', String(escala));
      }
      if (folga !== folgaAtual) {
        folgaAtual = folga;
        palco.style.setProperty('--palco-folga', `${folga}px`);
      }
    };
    const agendar = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(ajustar);
    };
    ajustar();
    // muda a altura do resto (fontes carregando, botão Coletar trocando de texto) ou a tela gira
    const ro = new ResizeObserver(agendar);
    ro.observe(rolagem);
    window.addEventListener('resize', agendar);
    return () => {
      cancelAnimationFrame(quadro);
      ro.disconnect();
      window.removeEventListener('resize', agendar);
    };
  }, [chave]);
  return ref;
}

export function FolhaCarta({ estado }: { estado: Estado }) {
  const cartaId = useUi((s) => s.cartaId);
  const abrirCarta = useUi((s) => s.abrirCarta);
  const abrirInfo = useUi((s) => s.abrirInfo);
  const agora = useAgora();
  const [editando, setEditando] = useState(false);
  const renomear = useRenomear();
  const { coletarAnimal } = useAcoes();

  const local = estado.entidades.find((e) => e.id === cartaId) ?? estado.aposentadoriasNaoVistas.find((e) => e.id === cartaId);
  const remoto = useEntidade(cartaId, local);
  const e = local ?? remoto.data;
  const pronto = !!e && estaProntoAgora(e, agora);
  const refPalco = useEscalaNoPalco(e?.id);

  const fechar = () => {
    abrirCarta(null);
    setEditando(false);
  };

  const salvarNome = (nome: string) => {
    if (!e) return;
    renomear.mutate(
      { id: e.id, nome },
      {
        onSuccess: (r) => {
          setEditando(false);
          som.voz(r.data.tipo);
          toast(`Pronto! Agora é ${r.data.nome}.`, 'sucesso');
        },
        onError: (erro) => {
          som.erro();
          toast(mensagemDeErro(erro), 'erro');
        },
      },
    );
  };

  return (
    <Folha aberto={!!cartaId} aoFechar={fechar} className="folha-carta">
      {e ? (
        <div ref={refPalco} className="carta-palco carta-palco-escala" data-raridade={e.raridade} data-aposentado={e.status === 'ativo' ? undefined : ''}>
          <span className="carta-palco-raios" aria-hidden />
          {/* chegada da carta: pop com mola (2 keyframes) + uma passada de reflexo; com movimento reduzido, só opacidade */}
          <motion.div
            key={e.id}
            className="carta-palco-entrada"
            initial={{ scale: 0.86, rotate: -2, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 20, delay: 0.08 }}
          >
            <Carta
              e={e}
              agora={agora}
              entrada
              editando={editando}
              salvandoNome={renomear.isPending}
              aoEditar={() => setEditando(true)}
              aoSalvarNome={salvarNome}
              aoCancelarNome={() => setEditando(false)}
            >
              {e.status === 'ativo' && (
                <button
                  type="button"
                  className={cx('botao botao-primario', !pronto && 'folha-coletar-espera')}
                  disabled={!pronto}
                  aria-label="Coletar"
                  onClick={() => {
                    void coletarAnimal(e);
                    fechar();
                  }}
                >
                  {pronto ? (
                    <>
                      <Ovo tipo={e.tipo} className="h-6 w-5" />
                      Coletar
                    </>
                  ) : (
                    // desabilitado: diz quando libera
                    <>
                      <Clock className="h-5 w-5" strokeWidth={3} />
                      <span className="numeros">Em {formatarTimer(Date.parse(e.proximoRendimento) - agora)}</span>
                    </>
                  )}
                </button>
              )}
              {/* com o campo aberto (✓/✕ na plaqueta) o Renomear fica redundante: desabilitado até salvar/cancelar */}
              <button type="button" className="botao botao-p botao-secundario" disabled={editando} onClick={() => setEditando(true)}>
                <Pencil className="h-4 w-4" /> Renomear
              </button>
              <button type="button" className="botao botao-p botao-secundario" onClick={() => abrirInfo(e.id)} aria-label="Informações">
                <Info className="h-4 w-4" /> Info
              </button>
            </Carta>
          </motion.div>
        </div>
      ) : (
        <p className="py-10 text-center font-semibold text-texto-suave">{remoto.isError ? 'Não foi possível carregar.' : 'Carregando…'}</p>
      )}
    </Folha>
  );
}

/** Ficha de informação: rótulo pequeno com ícone em cima, valor grande embaixo. */
function Ficha({ rotulo, valor, icone, larga }: { rotulo: string; valor: React.ReactNode; icone: React.ReactNode; larga?: boolean }) {
  return (
    <div className={cx('info-ficha', larga && 'info-ficha-larga')}>
      <dt>
        {icone}
        {rotulo}
      </dt>
      <dd className="numeros">{valor}</dd>
    </div>
  );
}

const ORIGEM = { BOAS_VINDAS: 'Boas-vindas', ROLETA: 'Roleta', INTERCAMBIO: 'Intercâmbio' } as Record<string, string>;

export function ModalInfo() {
  const infoId = useUi((s) => s.infoId);
  const abrirInfo = useUi((s) => s.abrirInfo);
  const agora = useAgora();
  const q = useQuery({
    queryKey: ['entidade', infoId, 'detalhe'],
    queryFn: async () => (await chamar<EntityDetalheDTO>('GET', `/entities/${infoId}`)).data,
    enabled: !!infoId,
  });
  const d = q.data;
  return (
    <Modal aberto={!!infoId} aoFechar={() => abrirInfo(null)} titulo={d ? `Info · ${d.nome}` : 'Info'}>
      {d ? (
        <div className="info-animal" data-raridade={d.raridade}>
          <div className="info-retrato">
            <span className="info-medalhao" data-tipo={d.tipo} aria-hidden>
              <FiguraAnimal tipo={d.tipo} humor={humorDe(d, agora)} ninho={false} detalhe="m" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="info-nome texto-contorno">{d.nome}</p>
              <span className="pilula" data-raridade={d.raridade}>
                {NOME_TIPO[d.tipo]} · {NOME_RARIDADE[d.raridade]}
              </span>
              {d.status === 'ativo' && <BarraVida vida={vidaDe(d, agora)} className="mt-2" />}
            </div>
          </div>
          <dl className="info-fichas">
            <Ficha icone={<Cake />} rotulo="Idade" valor={`${d.info.idadeDias} ${d.info.idadeDias === 1 ? 'dia' : 'dias'}`} />
            <Ficha
              icone={<Heart />}
              rotulo="Vida / humor"
              valor={`${vidaDe(d, agora).toFixed(2).replace('.', ',')} %${d.tier ? ` · ${NOME_TIER[d.tier]}` : ''}`}
            />
            <Ficha
              icone={<Moeda />}
              rotulo="Valor do ovo"
              valor={
                <span className="inline-flex items-center gap-1">
                  {moedas(d.valorOvoX100)} <Moeda className="h-5 w-5" />
                  <span className="sr-only">moedas</span>
                </span>
              }
            />
            <Ficha icone={<Sparkles />} rotulo="Origem" valor={ORIGEM[d.origem] ?? 'Suporte'} />
            <Ficha icone={<CalendarHeart />} rotulo="Chegada" valor={formatarDataHora(d.nascimento)} larga />
            <Ficha
              icone={<Sunset />}
              rotulo={d.status === 'ativo' ? 'Aposentadoria prevista' : 'Aposentado em'}
              valor={formatarDataHora(d.expiradoEm ?? d.expiracao)}
              larga
            />
            {d.status === 'ativo' && <Ficha icone={<RefreshCw />} rotulo="Ciclo atual" valor={`nº ${d.cicloN} · iniciado ${formatarDataHora(d.cicloInicio)}`} larga />}
            {d.info.efeitos && (
              <Ficha
                icone={<Smile />}
                rotulo="Efeitos do humor"
                valor={`${d.info.efeitos.rendimentoPct}% · 3 ovos ${String(d.info.efeitos.chanceTresOvosPct).replace('.', ',')}% · ciclo ${d.info.efeitos.duracaoCicloH} h`}
                larga
              />
            )}
            <Ficha
              icone={<Egg />}
              rotulo="Produção na vida"
              valor={`${d.stats.ovosTotal} ovos / ${d.stats.coletasTotal} coletas${d.info.mediaOvosPorColeta ? ` (média ${String(d.info.mediaOvosPorColeta).replace('.', ',')})` : ''}`}
              larga
            />
            {d.status === 'expirado' && d.presenteOvos > 0 && <Ficha icone={<Gift />} rotulo="Presente de despedida" valor={`${d.presenteOvos} ovo(s)`} larga />}
          </dl>
        </div>
      ) : (
        <p className="py-6 text-center text-texto-suave">{q.isError ? 'Não foi possível carregar.' : 'Carregando…'}</p>
      )}
    </Modal>
  );
}
