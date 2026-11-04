'use client';

// Galeria da área "roleta" (dev): roda parada, roda girando em loop (mesma coreografia da tela), destaque de
// cada espécie, botão Girar em todos os estados, pílula de saldo e a tabela de chances.
import type { EntityDTO } from '@galinheiro/api-contract';
import { CONFIG, FAIXAS_ROLETA, NOME_RARIDADE, NOME_TIPO, rotacaoFinal, type Raridade, type Tipo } from '@galinheiro/game-core';
import { animate, useMotionValue, type AnimationPlaybackControls, type ValueAnimationTransition } from 'motion/react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { PalcoRoda } from '../../../../cliente/arte/Roda';
import { FormNomeRevelacao, RevelacaoAnimal } from '../../../../cliente/componentes/RevelacaoAnimal';
import { BotaoGirar, InfoRoleta, TabelaChances } from '../../../../cliente/telas/TelaRoleta';
import { Exemplo, Moldura } from '../_Moldura';
import { AGORA_FICTICIO, entidadeFicticia } from '../_mock';

const meioDaFaixa = (i: number) => FAIXAS_ROLETA[i]!.grauInicio + FAIXAS_ROLETA[i]!.largura / 2;

function RodaParada() {
  const rotacao = useMotionValue(-24);
  return <PalcoRoda rotacao={rotacao} destaque={null} girando={false} />;
}

/** Repete a coreografia da tela (antecipação → arranque → desaceleração → mola → vitória) passando pelas 4 espécies. */
function RodaEmLoop() {
  const rotacao = useMotionValue(-24);
  const [girando, setGirando] = useState(false);
  const [destaque, setDestaque] = useState<number | null>(null);
  useEffect(() => {
    let vivo = true;
    let atual: AnimationPlaybackControls | null = null;
    const passo = async (de: number, para: number, t: ValueAnimationTransition<number>) => {
      rotacao.set(de);
      atual = animate(rotacao, para, t);
      await atual;
    };
    void (async () => {
      for (let n = 0; vivo; n++) {
        const i = [0, 1, 0, 2, 0, 3][n % 6]!;
        setDestaque(null);
        setGirando(true);
        await new Promise((r) => setTimeout(r, 700));
        if (!vivo) return;
        const inicio = rotacao.get();
        // recuo em senoide e arranque em t² até 1440°/s (igual à tela)
        await passo(inicio, inicio - 10, { duration: 0.22, ease: [0.37, 0, 0.63, 1] });
        if (!vivo) return;
        await passo(inicio - 10, inicio + 170, { duration: 0.25, ease: [1 / 3, 0, 2 / 3, 1 / 3] });
        if (!vivo) return;
        const atualV = rotacao.get();
        const final = rotacaoFinal(atualV, meioDaFaixa(i) + ((n * 7) % 9) - 4, i === 3 ? 1 : 0);
        const dur = Math.min(7.5, Math.max(4.5, (4 * (final + 2 - atualV)) / 1440));
        await passo(atualV, final + 2, { duration: dur, ease: i >= 2 ? [0.15, 0.6, 0.05, 1] : [0.15, 0.6, 0.12, 1] });
        if (!vivo) return;
        await passo(final + 2, final, { type: 'spring', stiffness: 200, damping: 12 });
        if (!vivo) return;
        rotacao.set(final);
        setDestaque(i);
        await new Promise((r) => setTimeout(r, 2200));
        setGirando(false);
      }
    })();
    return () => {
      vivo = false;
      atual?.stop();
    };
  }, [rotacao]);
  return <PalcoRoda rotacao={rotacao} destaque={destaque} girando={girando} />;
}

function RodaDestaque({ i }: { i: number }) {
  const rotacao = useMotionValue(-meioDaFaixa(i));
  return <PalcoRoda rotacao={rotacao} destaque={i} girando={false} />;
}

/** ?destaque=0..3 da URL (null se ausente ou inválido). */
function destaqueDaUrl(bruto: string | null): number | null {
  const d = bruto === null ? NaN : Number(bruto);
  return Number.isInteger(d) && d >= 0 && d < FAIXAS_ROLETA.length ? d : null;
}

/** Ângulo dentro do gomo, perto da borda (o pior caso: o retrato fica de lado sob o ponteiro); galinha no meio. */
const rotacaoDaVitoria = (k: number) => -(FAIXAS_ROLETA[k]!.grauInicio + FAIXAS_ROLETA[k]!.largura * (k === 0 ? 0.5 : 0.3));

/**
 * Vitória em tamanho de tela, para conferir o salto do retrato até o cubo. ?destaque=0..3 escolhe a espécie JÁ no
 * primeiro render (useSearchParams, sem esperar a hidratação nem um clique) e acompanha mudanças da URL; os
 * botões trocam na hora. O contêiner expõe data-destaque com a espécie em cena, para a verificação automatizada.
 */
function RodaVitoriaGrande() {
  const daUrl = destaqueDaUrl(useSearchParams().get('destaque'));
  const [i, setI] = useState(daUrl ?? 1);
  const [n, setN] = useState(0);
  const rotacao = useMotionValue(rotacaoDaVitoria(daUrl ?? 1));
  const escolher = (k: number) => {
    rotacao.set(rotacaoDaVitoria(k));
    setI(k);
    setN((x) => x + 1);
  };
  // a URL mudou depois de montar (navegação no cliente): segue a URL
  useEffect(() => {
    if (daUrl !== null && daUrl !== i) escolher(daUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daUrl]);
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {FAIXAS_ROLETA.map((f, k) => (
          // a espécie em cena usa o botão de destaque (verde): dá para ver qual é na captura
          <button
            key={f.tipo}
            type="button"
            className={k === i ? 'botao botao-p botao-compra' : 'botao botao-p'}
            data-vitoria={k}
            aria-pressed={k === i}
            onClick={() => escolher(k)}
          >
            {NOME_TIPO[f.tipo]}
          </button>
        ))}
      </div>
      <div data-vitoria-grande="" data-destaque={i}>
        <PalcoRoda key={n} rotacao={rotacao} destaque={i} girando={false} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------- revelação (área "revelação")

const TIPO_DA_RARIDADE: Record<Raridade, Tipo> = { comum: 'galinha', raro: 'pato', epico: 'ganso', lendario: 'avestruz' };
const RARIDADES = Object.keys(TIPO_DA_RARIDADE) as Raridade[];

/** Dispara a revelação de cada raridade (?revelar=lendario abre direto, para captura; &curto=1 = reduzir movimento). */
function DemoRevelacao() {
  const busca = useSearchParams();
  const revelarUrl = busca.get('revelar') as Raridade | null;
  const curtoUrl = busca.get('curto') === '1';
  const [aberta, setAberta] = useState<{ e: EntityDTO; curto: boolean } | null>(null);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [n, setN] = useState(0);
  const abrir = (raridade: Raridade, curto = false) => {
    const e = entidadeFicticia({ tipo: TIPO_DA_RARIDADE[raridade], pronto: true, id: `revelacao-${raridade}-${n}` });
    setN((x) => x + 1);
    setNome(e.nome);
    setErro(null);
    setAberta({ e, curto });
  };
  // a revelação é um portal (só existe no cliente): abre assim que monta, e de novo se a URL mudar
  useEffect(() => {
    if (revelarUrl && revelarUrl in TIPO_DA_RARIDADE) abrir(revelarUrl, curtoUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revelarUrl, curtoUrl]);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {RARIDADES.map((r) => (
          <button key={r} type="button" className="botao botao-p botao-compra" data-revelar={r} onClick={() => abrir(r)}>
            {NOME_RARIDADE[r]}
          </button>
        ))}
        <button type="button" className="botao botao-p" onClick={() => abrir('epico', true)}>
          Épico (reduzir movimento)
        </button>
      </div>
      <RevelacaoAnimal entidade={aberta?.e ?? null} agora={AGORA_FICTICIO} reduzir={aberta?.curto} aoEsc={() => setAberta(null)}>
        <FormNomeRevelacao
          nome={nome}
          aoMudarNome={(v) => {
            setNome(v);
            setErro(null);
          }}
          erro={erro}
          aoConfirmar={() => {
            if (!nome.trim()) setErro('Use de 1 a 20 letras, números, espaço, hífen, apóstrofo ou ponto.');
            else setAberta(null);
          }}
        />
      </RevelacaoAnimal>
    </>
  );
}

export function SecaoRoleta() {
  const custo = CONFIG.roleta.custoX100;
  return (
    <Moldura titulo="Roleta">
      <Exemplo titulo="Roda parada (repouso: lâmpadas em sequência)" className="mx-auto max-w-[340px] py-4">
        <RodaParada />
      </Exemplo>
      <Exemplo titulo="Roda girando em loop (mesma coreografia da tela)" className="mx-auto max-w-[340px] py-4">
        <RodaEmLoop />
      </Exemplo>
      <Exemplo titulo="Vitória em tamanho de tela (uma cópia do retrato voa até o cubo e o original desliza com brilho; ?destaque=0..3)" className="mx-auto max-w-[372px] py-4">
        {/* useSearchParams pede Suspense; o fallback guarda a altura para a página não pular */}
        <Suspense fallback={<div className="aspect-[352/396] w-full" />}>
          <RodaVitoriaGrande />
        </Suspense>
      </Exemplo>
      <Exemplo titulo="Destaque de cada espécie" className="grid grid-cols-2 gap-x-3 gap-y-6 py-4">
        {FAIXAS_ROLETA.map((f, i) => (
          <div key={f.tipo}>
            <RodaDestaque i={i} />
            <p className="mt-1 text-center font-titulo text-sm text-texto-suave">{NOME_TIPO[f.tipo]}</p>
          </div>
        ))}
      </Exemplo>
      <Exemplo titulo="Botão Girar (pronto, afundado na antecipação, girando, sem saldo, galinheiro cheio)" className="flex max-w-md flex-col gap-4">
        <BotaoGirar estado="pronto" custoX100={custo} />
        <BotaoGirar estado="pronto" custoX100={custo} pressionado />
        <BotaoGirar estado="girando" custoX100={custo} />
        <BotaoGirar estado="saldo" custoX100={custo} faltaX100={1250} />
        <BotaoGirar estado="cheio" custoX100={custo} />
        <p className="text-sm font-semibold text-texto-suave">
          Selo de vagas (só em telas com altura ≤ 700 px, onde a pílula de ninhos livres sai; vermelho com 1 ou 2):
        </p>
        <BotaoGirar estado="pronto" custoX100={custo} vagas={4} />
        <BotaoGirar estado="pronto" custoX100={custo} vagas={2} />
        <BotaoGirar estado="saldo" custoX100={custo} faltaX100={1250} vagas={1} />
      </Exemplo>
      <Exemplo titulo="Saldo e ninhos livres" className="flex flex-col items-start gap-3">
        <InfoRoleta moedasX100={128_400} livres={5} custoX100={custo} />
        <InfoRoleta moedasX100={2_750} livres={1} custoX100={custo} />
        <InfoRoleta moedasX100={9_000} livres={0} custoX100={custo} />
      </Exemplo>
      <Exemplo titulo="Chances (conteúdo do modal)" className="painel max-w-md p-4">
        <TabelaChances />
      </Exemplo>
      <Exemplo titulo="Revelação do animal sorteado (toque na tela para pular; ?revelar=comum|raro|epico|lendario)">
        <Suspense fallback={null}>
          <DemoRevelacao />
        </Suspense>
      </Exemplo>
    </Moldura>
  );
}
