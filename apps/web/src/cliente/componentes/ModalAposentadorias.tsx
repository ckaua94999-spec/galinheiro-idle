'use client';

// Modal Aposentadorias (GDD 3.2.6 e 6.14): o presente já foi creditado pelo servidor; aqui só celebramos.
// Visual: uma despedida ao pôr do sol (os aposentados dormem de touca no ninho, com estrelas surgindo),
// porta-retratos em ardósia para cada um e o presente de ovos numa caixinha que balança.
import { GEMAS_RARIDADE, NOME_RARIDADE, NOME_TIPO_PLURAL_OVO, RARIDADES } from '@galinheiro/game-core';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef } from 'react';
import { FiguraAnimal } from '../arte/Animal';
import { Gemas, Ovo } from '../arte/Icones';
import { useMarcarAposentadorias, type Estado } from '../estado';
import { agoraServidor } from '../relogio';
import { som } from '../som';
import { EASE } from '../movimento';
import { ETAPA } from '../useAcoes';
import { Modal } from './Modal';

/** Marca as bordas da rolagem que ainda escondem conteúdo (data-borda-topo/-fim): o CSS esmaece só esse lado. */
function useBordasDeRolagem(alvo: () => HTMLElement | null | undefined, ativo: boolean) {
  useEffect(() => {
    const el = ativo ? alvo() : null;
    if (!el) return;
    const atualizar = () => {
      el.toggleAttribute('data-borda-topo', el.scrollTop > 2);
      el.toggleAttribute('data-borda-fim', el.scrollTop + el.clientHeight < el.scrollHeight - 2);
    };
    atualizar();
    el.addEventListener('scroll', atualizar, { passive: true });
    const ro = new ResizeObserver(atualizar);
    ro.observe(el);
    for (const filho of Array.from(el.children)) ro.observe(filho);
    return () => {
      el.removeEventListener('scroll', atualizar);
      ro.disconnect();
    };
  }, [ativo]); // eslint-disable-line react-hooks/exhaustive-deps
}

// Estrelas que acendem no céu do entardecer: [left %, top px, atraso s]
const ESTRELAS: [number, number, number][] = [
  [8, 14, 0],
  [22, 34, 0.9],
  [38, 10, 1.6],
  [64, 22, 0.4],
  [80, 8, 1.2],
  [91, 36, 2],
];

/** Céu do pôr do sol: sol se pondo no centro, atrás das colinas violeta (com halo), e uma cerquinha. */
function FundoPorDoSol() {
  const u = `gi-telas-adeus-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg viewBox="0 0 360 142" preserveAspectRatio="xMidYMax slice" className="adeus-fundo" aria-hidden>
      <defs>
        <radialGradient id={`${u}-sol`} cx=".5" cy=".45" r=".55">
          <stop offset="0" stopColor="#fff6c0" />
          <stop offset=".6" stopColor="#ffc24a" />
          <stop offset="1" stopColor="#ff8a3a" />
        </radialGradient>
        <radialGradient id={`${u}-halo`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#ffd27a" stopOpacity=".6" />
          <stop offset=".55" stopColor="#ffd27a" stopOpacity=".28" />
          <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${u}-raios`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff6c0" stopOpacity=".55" />
          <stop offset="1" stopColor="#fff6c0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${u}-colina-fundo`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9a5aa8" />
          <stop offset="1" stopColor="#6a3a8a" />
        </linearGradient>
        <linearGradient id={`${u}-colina`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a8a4a" />
          <stop offset="1" stopColor="#4a5a34" />
        </linearGradient>
      </defs>
      {/* halo: largo e suave, depois um miolo mais claro logo em volta do sol */}
      <circle cx="180" cy="84" r="120" fill={`url(#${u}-halo)`} />
      <circle cx="180" cy="84" r="54" fill={`url(#${u}-raios)`} />
      <circle cx="180" cy="84" r="30" fill={`url(#${u}-sol)`} stroke="#e0703a" strokeWidth="2" />
      <path d="M162 70Q168 61 179 59" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".6" />
      {/* nuvens alaranjadas */}
      <g fill="#ffb27a" opacity=".85">
        <path d="M40 44Q40 36 50 37Q55 30 64 34Q72 31 75 38Q83 39 81 45Q79 48 73 48H46Q40 48 40 44Z" />
        <path d="M262 30Q262 25 268 25Q271 21 277 23Q282 21 284 26Q289 27 288 31Q287 33 283 33H266Q262 33 262 30Z" />
      </g>
      <path d="M-4 100Q60 74 130 88Q200 70 270 90Q320 78 364 92V142H-4Z" fill={`url(#${u}-colina-fundo)`} />
      <path d="M-4 112Q80 96 180 104Q270 94 364 108V142H-4Z" fill={`url(#${u}-colina)`} stroke="#2f3a1e" strokeWidth="2" />
      {/* cerquinha em contraluz */}
      <g fill="#3a2a3e">
        {[18, 40, 62, 300, 322, 344].map((x) => (
          <rect key={x} x={x - 2.5} y={x < 180 ? 92 : 90} width="5" height="18" rx="1.5" />
        ))}
        <rect x="12" y="97" width="56" height="3.4" rx="1.5" />
        <rect x="294" y="95" width="56" height="3.4" rx="1.5" />
      </g>
    </svg>
  );
}

/** Caixinha de presente rosa com laço. */
function CaixaPresente() {
  return (
    <svg viewBox="0 0 26 26" className="adeus-caixa" aria-hidden>
      <path d="M13 8Q7 1 5 5Q4 9 13 8Q22 9 21 5Q19 1 13 8Z" fill="#ffd23f" stroke="#6a4300" strokeWidth="2.6" paintOrder="stroke" strokeLinejoin="round" />
      <rect x="4" y="13" width="18" height="11" rx="2" fill="#ff7ab0" stroke="#7a1a4a" strokeWidth="3" paintOrder="stroke" />
      <rect x="2.5" y="8.5" width="21" height="6" rx="2" fill="#ffa8cc" stroke="#7a1a4a" strokeWidth="3" paintOrder="stroke" />
      <rect x="11" y="8.5" width="4" height="15.5" fill="#ffd23f" />
      <path d="M5 10H10" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity=".8" />
    </svg>
  );
}

export function ModalAposentadorias({ estado }: { estado: Estado }) {
  const router = useRouter();
  const marcar = useMarcarAposentadorias();
  const lista = estado.aposentadoriasNaoVistas;
  const aberto = lista.length > 0 && estado.player.tutorialEtapa >= ETAPA.CONCLUIDO;
  const tocou = useRef(false);
  const refLista = useRef<HTMLUListElement>(null);
  useBordasDeRolagem(() => refLista.current, aberto);

  useEffect(() => {
    if (aberto && !tocou.current) {
      tocou.current = true;
      som.aposentadoria();
    }
    if (!aberto) tocou.current = false;
  }, [aberto]);

  const fechar = (destino?: string) => {
    const ate = lista.reduce((m, e) => (e.expiradoEm && e.expiradoEm > m ? e.expiradoEm : m), new Date(agoraServidor()).toISOString());
    marcar.mutate(ate);
    if (destino) router.push(destino);
  };

  // até 3 dorminhocos na cena, com o mais raro no centro (na frente do sol)
  const porRaridade = [...lista.slice(0, 3)].sort((a, b) => RARIDADES.indexOf(b.raridade) - RARIDADES.indexOf(a.raridade));
  const [maisRaro, segundo, terceiro] = porRaridade;
  const naCena = [segundo, maisRaro, terceiro].filter((e): e is NonNullable<typeof e> => !!e);

  return (
    <Modal aberto={aberto} aoFechar={() => fechar()} titulo="Aposentadorias">
      <div className="adeus-cena" aria-hidden>
        <FundoPorDoSol />
        {ESTRELAS.map(([x, y, atraso]) => (
          <span key={`${x}-${y}`} className="adeus-estrela" style={{ left: `${x}%`, top: y, animationDelay: `${atraso}s` }} />
        ))}
        <div className="adeus-dorminhocos">
          {naCena.map((e, i) => (
            <motion.span
              key={e.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: EASE.elastico, delay: 0.25 + i * 0.12 }}
            >
              <FiguraAnimal tipo={e.tipo} humor="aposentado" atrasoS={i * 1.1} />
            </motion.span>
          ))}
        </div>
      </div>

      <p className="adeus-texto">
        Enquanto você esteve fora, {lista.length === 1 ? 'um animal se aposentou' : `${lista.length} animais se aposentaram`} e foram curtir a vida no sítio:
      </p>
      <ul ref={refLista} className="adeus-lista rolagem-esmaecida">
        {lista.map((e, i) => (
          <motion.li
            key={e.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: EASE.suave, delay: 0.35 + 0.06 * i }}
            className="painel-raridade adeus-linha"
            data-raridade={e.raridade}
          >
            <span className="adeus-retrato" aria-hidden>
              <span className="adeus-retrato-moldura">
                <FiguraAnimal tipo={e.tipo} humor="aposentado" ninho={false} atrasoS={i * 0.7} />
              </span>
              {/* gemas numa plaquinha escura sobre a borda de baixo, como nas cartas */}
              <span className="adeus-gemas">
                <Gemas quantidade={GEMAS_RARIDADE[e.raridade]} cor="#fff" raridade={e.raridade} tamanho={10} className="inline-flex gap-px" />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="adeus-nome-linha">
                <p className="adeus-nome">{e.nome}</p>
                <span className="adeus-raridade">{NOME_RARIDADE[e.raridade]}</span>
              </div>
              <p className="adeus-info">90 dias · {e.stats.ovosTotal} ovos na vida</p>
            </div>
            {e.presenteOvos > 0 && (
              <motion.p
                className="adeus-presente"
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.08, 1] }}
                transition={{ duration: 0.32, times: [0, 0.7, 1], ease: 'easeOut', delay: 0.6 + 0.08 * i }}
              >
                <CaixaPresente />
                <span className="adeus-ovos" aria-hidden>
                  {Array.from({ length: Math.min(e.presenteOvos, 3) }, (_, k) => (
                    <Ovo key={k} tipo={e.tipo} />
                  ))}
                </span>
                <span className="adeus-presente-texto">
                  Presente: {e.presenteOvos} {e.presenteOvos === 1 ? 'ovo' : 'ovos'} de {NOME_TIPO_PLURAL_OVO[e.tipo]}
                </span>
              </motion.p>
            )}
          </motion.li>
        ))}
      </ul>
      <div className="adeus-acoes">
        <button type="button" className="botao botao-secundario botao-compacto flex-1" onClick={() => fechar('/colecao?status=expirado')}>
          Ver na Coleção
        </button>
        <button type="button" className="botao botao-primario botao-compacto flex-1" onClick={() => fechar('/roleta')}>
          Ir à Roleta
        </button>
      </div>
    </Modal>
  );
}
