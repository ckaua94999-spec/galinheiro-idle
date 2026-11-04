'use client';

// Galeria da área "ui" (dev): tokens, tipografia e todas as classes do contrato de UI (DIRECAO_DE_ARTE, seções 2–4).
import { LayoutGroup } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, Gift, RotateCw, Settings, ShoppingBasket, Timer, Trash2, WifiOff, X } from 'lucide-react';
import {
  Gemas, IconeAjustes, IconeCesto, IconeColecao, IconeGalinheiro, IconeLoja, IconeNinho, IconeRoleta, Moeda, Ovo,
} from '@/cliente/arte/Icones';
import { Abas } from '@/cliente/componentes/Abas';
import { Hud } from '@/cliente/componentes/Hud';
import { Folha, Modal } from '@/cliente/componentes/Modal';
import { TelaCarregando, useMontado } from '@/cliente/componentes/ShellJogo';
import { Toasts } from '@/cliente/componentes/Toasts';
import { BalaoJuca, SetaTutorial } from '@/cliente/componentes/Tutorial';
import { useUi } from '@/cliente/ui';
import { AGORA_FICTICIO, entidadeFicticia, estadoFicticio } from '../_mock';
import { Moldura, Exemplo } from '../_Moldura';

const RARIDADES = [
  { id: 'comum', nome: 'Comum' },
  { id: 'raro', nome: 'Raro' },
  { id: 'epico', nome: 'Épico' },
  { id: 'lendario', nome: 'Lendário' },
] as const;

// Amostras de cor agrupadas por família de token
const PALETA: { grupo: string; cores: string[] }[] = [
  { grupo: 'Base', cores: ['creme-claro', 'creme', 'creme-escuro', 'texto', 'texto-suave', 'contorno', 'contorno-suave'] },
  { grupo: 'Ação', cores: ['acao-clara', 'acao', 'acao-escura', 'acao-contorno'] },
  { grupo: 'Confirmar', cores: ['confirmar-clara', 'confirmar', 'confirmar-escura', 'confirmar-contorno'] },
  { grupo: 'Compra', cores: ['compra-clara', 'compra', 'compra-escura', 'compra-contorno'] },
  { grupo: 'Perigo', cores: ['perigo-clara', 'perigo', 'perigo-escura', 'perigo-contorno', 'sucesso'] },
  { grupo: 'Fazenda', cores: ['ceu-topo', 'ceu-base', 'grama-clara', 'grama', 'grama-escura', 'madeira-clara', 'madeira', 'madeira-escura', 'palha-clara', 'palha', 'palha-escura', 'terra', 'ouro-claro', 'ouro', 'ouro-escuro'] },
  { grupo: 'Raridades', cores: ['comum-clara', 'comum', 'comum-escura', 'raro-clara', 'raro', 'raro-escura', 'epico-clara', 'epico', 'epico-escura', 'lendario-clara', 'lendario', 'lendario-escura'] },
  { grupo: 'Vida', cores: ['vida-verde-clara', 'vida-verde', 'vida-amarela-clara', 'vida-amarela', 'vida-vermelha-clara', 'vida-vermelha', 'trilho'] },
];

const VARIANTES = [
  { classe: 'botao-secundario', rotulo: 'Cancelar' },
  { classe: 'botao-primario', rotulo: 'Coletar' },
  { classe: 'botao-confirmar', rotulo: 'Vender' },
  { classe: 'botao-compra', rotulo: 'Girar' },
  { classe: 'botao-perigo', rotulo: 'Sair' },
] as const;

function Amostra({ nome }: { nome: string }) {
  return (
    <div className="flex w-[72px] flex-col items-center gap-1">
      <span
        className="h-10 w-full rounded-xl border-2 border-contorno/70 shadow-[inset_0_2px_0_rgb(255_255_255/.35)]"
        style={{ background: `var(--color-${nome})` }}
      />
      <span className="text-center text-[11px] leading-tight font-extrabold text-texto-suave">{nome}</span>
    </div>
  );
}

function Interruptor({ inicial, rotulo, desabilitado }: { inicial: boolean; rotulo: string; desabilitado?: boolean }) {
  const [ligado, setLigado] = useState(inicial);
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm font-extrabold">
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-label={rotulo}
        disabled={desabilitado}
        className="interruptor"
        onClick={() => setLigado((v) => !v)}
      />
      {rotulo}
    </label>
  );
}

// Botão que recebe foco ao montar (mostra o anel de :focus-visible)
function BotaoFocado() {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
  }, []);
  return (
    <button ref={ref} type="button" className="botao botao-primario">
      Foco real
    </button>
  );
}

const TIPOS = ['galinha', 'pato', 'ganso', 'avestruz'] as const;
const ICONES_ABAS = [IconeGalinheiro, IconeLoja, IconeRoleta, IconeColecao, IconeAjustes, IconeCesto];
const nada = () => {};

// HUD em espera: ninguém pronto e o próximo daqui a ~25 min no relógio de verdade (o HUD usa a hora real)
function estadoEmEspera() {
  const faltaH = (Date.now() - AGORA_FICTICIO) / 3_600_000 + 0.42;
  const tipos = ['galinha', 'pato', 'ganso', 'avestruz', 'galinha', 'pato'] as const;
  return estadoFicticio({
    moedasX100: 1_284_00,
    entidades: tipos.map((tipo, i) => entidadeFicticia({ tipo, slot: i + 1, pronto: false, faltaH: faltaH + i * 2 })),
  });
}

// Palco para componentes "fixed" (HUD, abas, modal, folha, toasts): o transform cria um bloco de contenção,
// então o fixed fica preso dentro da caixa. inert evita que cliques disparem ações de verdade.
// Só monta no cliente: HUD e abas dependem do relógio (evita divergência de hidratação).
function Palco({ altura, children, inerte, className }: { altura: number; children: React.ReactNode; inerte?: boolean; className?: string }) {
  const montado = useMontado();
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border-2 border-contorno/40 ${className ?? ''}`}
      style={{ height: altura, transform: 'translateZ(0)', background: 'linear-gradient(180deg, #49b8ff 0%, #8fd6ff 40%, #c4ecff 75%, #dff6c8 100%)' }}
      inert={inerte}
    >
      {montado && children}
    </div>
  );
}

// Toasts fictícios direto no estado de UI (ids fixos: idempotente no StrictMode)
function ToastsFicticios() {
  useEffect(() => {
    useUi.setState({
      toasts: [
        { id: -1, texto: 'Você vendeu 12 ovos por 14,40 moedas!', tipo: 'sucesso', duracaoMs: 1e9 },
        { id: -4, texto: '+8 ovos · 5 de galinha, 3 de pato', tipo: 'sucesso', duracaoMs: 1e9 },
        { id: -5, texto: 'Código copiado!', tipo: 'sucesso', duracaoMs: 1e9 },
        { id: -2, texto: 'Moedas insuficientes para girar a roleta.', tipo: 'erro', duracaoMs: 1e9 },
        { id: -3, texto: 'Patolino se aposentou e deixou 2 ovos de presente.', tipo: 'info', duracaoMs: 1e9, acao: { rotulo: 'Ver', fn: nada } },
      ],
    });
    return () => useUi.setState({ toasts: [] });
  }, []);
  return <Toasts />;
}

export function SecaoUi() {
  const [vida, setVida] = useState(72);
  return (
    <Moldura titulo="Ui">
      <Exemplo titulo="Ícones: moeda, ovos, ninho, abas e gemas (16 · 24 · 32 · 48 px)" className="painel space-y-4 p-5">
        {[16, 24, 32, 48].map((t) => (
          <div key={t} className="flex flex-wrap items-end gap-3">
            <span className="w-8 text-xs font-extrabold text-texto-suave">{t}px</span>
            <Moeda className="shrink-0" titulo="Moeda" />
            {TIPOS.map((tp) => (
              <span key={tp} className="inline-block" style={{ width: t * 0.83, height: t }}>
                <Ovo tipo={tp} className="h-full w-full" titulo={`Ovo de ${tp}`} />
              </span>
            ))}
            <span className="inline-block" style={{ width: t * 1.25, height: t }}>
              <IconeNinho className="h-full w-full" />
            </span>
            {ICONES_ABAS.map((I, i) => (
              <span key={i} className="inline-block" style={{ width: t, height: t }}>
                <I className="h-full w-full" />
              </span>
            ))}
          </div>
        )).map((linha, i) => (
          <div key={i} className="[&_svg.shrink-0]:h-[var(--t)] [&_svg.shrink-0]:w-[var(--t)]" style={{ ['--t' as string]: `${[16, 24, 32, 48][i]}px` }}>
            {linha}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-4 border-t-2 border-dashed border-creme-escuro pt-3">
          {RARIDADES.map((r) => (
            <Gemas key={r.id} quantidade={4} cor="" raridade={r.id} tamanho={18} />
          ))}
          <span className="rounded-lg bg-epico p-1.5">
            <Gemas quantidade={3} cor="#fff" tamanho={14} />
          </span>
          <Gemas quantidade={2} cor="#3B82F6" />
        </div>
      </Exemplo>

      <Exemplo titulo="HUD (estadoFicticio) e abas — Coletar Todos, Vender, ninhos cheio, espera" className="space-y-4">
        <Palco altura={128} inerte>
          <Hud estado={estadoFicticio()} />
        </Palco>
        <Palco altura={128} inerte>
          <Hud estado={estadoFicticio({ moedasX100: 25_40, nivel: 1, entidades: estadoFicticio().entidades.slice(1, 5) })} />
        </Palco>
        <Palco altura={128} inerte>
          <Hud estado={estadoEmEspera()} />
        </Palco>
        {/* cada exemplo num LayoutGroup próprio: a cápsula (layoutId) não salta de uma barra para a outra */}
        <LayoutGroup id="abas-exemplo-1">
          <Palco altura={112} inerte>
            <Abas estado={estadoFicticio()} caminhoAtivo="/galinheiro" />
          </Palco>
        </LayoutGroup>
        <LayoutGroup id="abas-exemplo-2">
          <Palco altura={112} inerte>
            <Abas estado={estadoFicticio({ nivel: 1, entidades: estadoFicticio().entidades.slice(0, 4), moedasX100: 999_00 })} caminhoAtivo="/roleta" />
          </Palco>
        </LayoutGroup>
      </Exemplo>

      <Exemplo titulo="Cabeçalho de tela (.tela-cabeca: ícone da aba + .titulo-tela; Extrato com voltar)" className="space-y-1 rounded-3xl bg-[linear-gradient(180deg,#49b8ff,#c4ecff)] p-4">
        <div className="tela-cabeca">
          <IconeLoja className="tela-cabeca-icone" />
          <h1 className="titulo-tela">Loja</h1>
        </div>
        <div className="tela-cabeca">
          <IconeRoleta className="tela-cabeca-icone" />
          <h1 className="titulo-tela">Roleta</h1>
          <div className="tela-cabeca-acao">
            <span className="pilula pilula-pronto">1 giro grátis</span>
          </div>
        </div>
        <div className="tela-cabeca">
          <IconeColecao className="tela-cabeca-icone" />
          <h1 className="titulo-tela">Coleção</h1>
        </div>
        <div className="tela-cabeca">
          <IconeAjustes className="tela-cabeca-icone" />
          <h1 className="titulo-tela">Configurações</h1>
        </div>
        <div className="tela-cabeca">
          <button type="button" className="botao botao-icone botao-secundario tela-cabeca-voltar" aria-label="Voltar">
            <ChevronLeft strokeWidth={3} />
          </button>
          <h1 className="titulo-tela">Extrato de moedas</h1>
        </div>
      </Exemplo>

      <Exemplo titulo="Modal aberto (faixa + X), título longo e variante perigo" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Palco altura={440}>
          <Modal aberto aoFechar={nada} titulo="Vender ovos">
            <ul className="space-y-2">
              {TIPOS.map((tp, i) => (
                <li key={tp} className="flex items-center gap-3 border-b-2 border-dashed border-creme-escuro pb-2 text-sm">
                  <Ovo tipo={tp} className="h-8 w-7" />
                  <span className="flex-1 font-titulo text-[17px]">{['Galinha', 'Pato', 'Ganso', 'Avestruz'][i]}</span>
                  <span className="numeros font-titulo text-[17px]">{[23, 11, 3, 1][i]}</span>
                </li>
              ))}
            </ul>
            <button type="button" className="botao botao-confirmar botao-g botao-compacto mt-4 w-full">
              Vender tudo
              <span className="botao-preco">
                58,90 <Moeda className="h-[1.2em] w-[1.2em]" />
              </span>
            </button>
          </Modal>
        </Palco>
        <Palco altura={440}>
          <Modal aberto aoFechar={nada} titulo="Guarde seu código de recuperação">
            <p className="text-sm">Com ele você recupera o galinheiro em outro aparelho.</p>
            <p className="mt-3 rounded-xl bg-white p-3 text-center font-titulo text-[22px] tracking-widest">GALO-7K2P-OVO9</p>
            <button type="button" className="botao botao-primario mt-4 w-full">
              Copiar código
            </button>
          </Modal>
        </Palco>
        <Palco altura={440}>
          <Modal aberto aoFechar={nada} titulo="Excluir conta" variante="perigo">
            <p className="text-sm">Isso apaga para sempre seus animais, moedas, ovos e extrato.</p>
            <button type="button" className="botao botao-perigo mt-4 w-full">
              <span className="icone-contorno" aria-hidden>
                <Trash2 />
                <Trash2 />
              </span>
              Excluir definitivamente
            </button>
          </Modal>
        </Palco>
      </Exemplo>

      <Exemplo titulo="Folha (bottom sheet) aberta" className="">
        <Palco altura={420}>
          <Folha aberto aoFechar={nada} titulo="Jujuba">
            <div className="painel-raridade p-4 text-sm" data-raridade="comum">
              Conteúdo da folha (a carta completa entra aqui). Arraste a alça para baixo para fechar.
            </div>
            <div className="mt-3 flex gap-3">
              <button type="button" className="botao botao-p flex-1">
                Renomear
              </button>
              <button type="button" className="botao botao-primario botao-p flex-1">
                Coletar
              </button>
            </div>
          </Folha>
        </Palco>
      </Exemplo>

      <Exemplo titulo="Toasts (moedas, ovos, sucesso, erro, info com ação)" className="">
        <Palco altura={410} className="[--altura-hud:0px]">
          <ToastsFicticios />
        </Palco>
      </Exemplo>

      <Exemplo titulo="Tutorial: balão do Seu Juca, anel e seta" className="">
        <Palco altura={360}>
          <div className="tut-veu absolute inset-0" />
          <div className="absolute left-1/2 top-[86px] -translate-x-1/2">
            <button type="button" className="botao botao-confirmar">
              Vender
            </button>
            <div className="tut-anel absolute -inset-2" />
          </div>
          <div className="tut-seta" style={{ left: '50%', top: 26 }}>
            <SetaTutorial />
          </div>
          <div className="balao-juca absolute inset-x-3 bottom-3 mx-auto max-w-md">
            <BalaoJuca texto="Ovo vira moeda. Toque em Vender e venda tudo!" botao="Vamos lá!" aoPular={nada} aoAvancar={nada} />
          </div>
        </Palco>
      </Exemplo>

      <Exemplo titulo="Carregamento e avisos" className="space-y-4">
        <Palco altura={600}>
          <TelaCarregando className="!min-h-[600px]" />
        </Palco>
        <div className="painel-escuro aviso">
          <span className="toast-icone" aria-hidden>
            <span className="icone-contorno">
              <WifiOff />
              <WifiOff />
            </span>
          </span>
          <span className="flex-1">Sem conexão. Seus animais continuam botando! As ações voltam quando a internet voltar.</span>
        </div>
        <div className="painel-escuro aviso" data-tipo="sucesso">
          <span className="toast-icone" aria-hidden>
            <span className="icone-contorno">
              <RotateCw />
              <RotateCw />
            </span>
          </span>
          <p className="flex-1">Nova versão do Galinheiro disponível!</p>
          <button type="button" className="botao botao-primario botao-p shrink-0">
            Atualizar
          </button>
        </div>
      </Exemplo>

      <Exemplo titulo="Texto contornado" className="painel-madeira space-y-3 p-5">
        <p className="texto-contorno text-[40px] leading-[44px]">LENDÁRIO!</p>
        <p className="texto-contorno texto-ouro text-[40px] leading-[44px]">JACKPOT!</p>
        <p className="titulo-tela">Título de tela</p>
        <p className="texto-contorno text-[22px]" style={{ '--contorno-cor': 'var(--color-raro-contorno)' } as React.CSSProperties}>
          Contorno azul (raro)
        </p>
        <p className="flex items-center gap-4">
          <span className="numero-jogo">12.345</span>
          <span className="texto-contorno texto-contorno-fino text-[13px]">Galinheiro nível 4 · 16 ninhos</span>
        </p>
      </Exemplo>

      <Exemplo titulo="Tipografia (corpo em Nunito)" className="painel space-y-1 p-5">
        <p className="font-titulo text-[30px] leading-[34px] text-texto">Lilita One 30</p>
        <p className="font-titulo text-[22px] text-texto">Lilita One 22 — Coletar Todos</p>
        <p className="text-base">Corpo 16/22 (Nunito 700): seus animais botam ovos a cada dia.</p>
        <p className="text-sm text-texto-suave">Pequeno 14/20 em texto suave: contraste confortável no creme.</p>
        <p className="text-xs font-extrabold text-texto-suave">LEGENDA 12/16 · NUNITO 800</p>
      </Exemplo>

      <Exemplo titulo="Botões: variantes × tamanhos" className="painel space-y-5 p-5">
        {(['botao-p', '', 'botao-g'] as const).map((tam) => (
          <div key={tam || 'm'} className="flex flex-wrap items-center gap-3">
            {VARIANTES.map((v) => (
              <button key={v.classe} type="button" className={`botao ${v.classe} ${tam}`}>
                {v.rotulo}
              </button>
            ))}
          </div>
        ))}
      </Exemplo>

      <Exemplo titulo="Botões: estados (normal · pressionado · desabilitado)" className="painel space-y-3 p-5">
        {VARIANTES.map((v) => (
          <div key={v.classe} className="flex flex-wrap items-center gap-3">
            <button type="button" className={`botao ${v.classe}`}>
              {v.rotulo}
            </button>
            <button type="button" data-pressionado="" className={`botao ${v.classe}`}>
              Pressionado
            </button>
            <button type="button" disabled className={`botao ${v.classe}`}>
              Desabilitado
            </button>
          </div>
        ))}
      </Exemplo>

      <Exemplo titulo="Ícones redondos, preço e botões largos" className="painel space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" aria-label="Fechar" className="botao botao-icone botao-perigo">
            <X />
          </button>
          <button type="button" aria-label="Ajustes" className="botao botao-icone">
            <Settings />
          </button>
          <button type="button" aria-label="Confirmar" className="botao botao-icone botao-confirmar">
            <Check />
          </button>
          <button type="button" aria-label="Ajustes grande" className="botao botao-icone botao-g botao-compra">
            <Settings />
          </button>
          <button type="button" disabled aria-label="Fechar desabilitado" className="botao botao-icone botao-perigo">
            <X />
          </button>
        </div>
        <button type="button" className="botao botao-compra botao-g w-full">
          Girar
          <span className="botao-preco">
            <Moeda className="h-[1.2em] w-[1.2em]" />
            40
          </span>
        </button>
        <p className="text-xs font-extrabold text-texto-suave">
          Par lado a lado: .botao-compacto (rótulo diminui, não quebra). Preço sempre em .botao-preco (número + moeda juntos).
        </p>
        <div className="flex gap-3">
          <button type="button" className="botao botao-primario botao-compacto flex-1">
            <span className="icone-contorno">
              <ShoppingBasket />
              <ShoppingBasket />
            </span>
            Coletar Todos (6)
          </button>
          <button type="button" className="botao botao-confirmar botao-compacto flex-1">
            Vender
            <span className="botao-preco">
              12,50 <Moeda className="h-[1.1em] w-[1.1em]" />
            </span>
          </button>
        </div>
        <div className="flex gap-3">
          <button type="button" className="botao botao-secundario flex-1 text-sm">
            Legado: text-sm
          </button>
          <button type="button" className="botao botao-primario min-h-10 px-3 py-1.5 text-sm">
            Legado: min-h-10
          </button>
          <button type="button" className="botao botao-secundario h-10 min-h-0 w-10 p-0" aria-label="Legado ícone">
            <X className="h-5 w-5" />
          </button>
        </div>
      </Exemplo>

      <Exemplo titulo="Ícones brancos sobre cor: .icone-contorno (padrão) e .botao-medalhao" className="painel space-y-4 p-5">
        <p className="text-xs font-extrabold text-texto-suave">
          Ícone lucide sozinho fica lavado sobre cor. Padrão: o mesmo ícone 2× dentro de .icone-contorno (o 1º vira o traço
          escuro da variante). Alternativa: className=&quot;botao-medalhao&quot; direto no svg (disco claro, ícone escuro).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="botao botao-primario">
            <ShoppingBasket /> Sem contorno
          </button>
          <button type="button" className="botao botao-primario">
            <span className="icone-contorno">
              <ShoppingBasket />
              <ShoppingBasket />
            </span>
            Contornado
          </button>
          <button type="button" className="botao botao-primario">
            <ShoppingBasket className="botao-medalhao" /> Medalhão
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(['botao-confirmar', 'botao-compra', 'botao-perigo'] as const).map((c) => (
            <button key={c} type="button" aria-label={c} className={`botao botao-icone ${c}`}>
              <span className="icone-contorno">
                <Check />
                <Check />
              </span>
            </button>
          ))}
          <button type="button" aria-label="Girar" className="botao botao-icone botao-g botao-compra">
            <span className="icone-contorno">
              <RotateCw />
              <RotateCw />
            </span>
          </button>
          <button type="button" className="botao botao-compra botao-p">
            <Gift className="botao-medalhao" /> Prêmio
          </button>
          <button type="button" className="botao botao-confirmar botao-p">
            <span className="icone-contorno">
              <Check />
              <Check />
            </span>
            Pronto
          </button>
        </div>
      </Exemplo>

      <Exemplo titulo="Foco (anel branco + azul) e contraste sobre o céu" className="space-y-4 p-1">
        <div className="flex flex-wrap items-center gap-4">
          <BotaoFocado />
          <button type="button" data-foco="" className="botao botao-compra">
            data-foco
          </button>
          <button type="button" data-foco="" aria-label="Fechar com foco" className="botao botao-icone botao-perigo">
            <X />
          </button>
        </div>
        <input className="campo" data-foco="" defaultValue="Campo com foco" aria-label="Campo com foco" />
        <p className="texto-contorno text-[22px]">Texto contornado direto no céu</p>
        <p className="texto-contorno texto-contorno-fino text-[13px]">Fino de 13 px direto no céu · legível</p>
        <p className="text-xs font-extrabold text-texto">
          data-foco só existe para a galeria mostrar o estado; no jogo o anel vem do :focus-visible.
        </p>
      </Exemplo>

      <Exemplo titulo="Painéis e faixas" className="space-y-10 pt-6">
        <p className="painel-escuro px-3 py-2 text-xs">
          .faixa só dentro de .painel* com .painel-com-faixa (isolation). Com p-4/p-5 do Tailwind ponha pt-10 (as caudas
          descem até ~36 px).
        </p>
        <div className="painel painel-com-faixa p-5 pt-11">
          <h3 className="faixa">Ampliar galinheiro</h3>
          <p className="text-sm">Painel claro (pergaminho) com faixa de título laranja sobreposta.</p>
          <div className="mt-3 barra" data-cor="azul" style={{ '--barra-h': '16px' } as React.CSSProperties}>
            <span className="barra-preenchimento" style={{ '--p': 50 } as React.CSSProperties} />
            <span className="barra-texto">8 / 16</span>
          </div>
          <button type="button" className="botao botao-compra botao-g mt-5 w-full">
            Ampliar
            <span className="botao-preco">
              <Moeda className="h-[1.2em] w-[1.2em]" />
              250
            </span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-10">
          <div className="painel painel-com-faixa p-4 pt-10 text-sm">
            <h3 className="faixa faixa-azul text-[18px]">Azul</h3>
            Faixa azul
          </div>
          <div className="painel painel-com-faixa p-4 pt-10 text-sm">
            <h3 className="faixa faixa-verde text-[18px]">Verde</h3>
            Faixa verde
          </div>
          {RARIDADES.map((r) => (
            <div key={r.id} data-raridade={r.id} className="painel-raridade painel-com-faixa p-4 pt-10 text-sm">
              <h3 className="faixa text-[18px]" data-raridade={r.id}>
                {r.nome}
              </h3>
              Painel de raridade
            </div>
          ))}
        </div>
        <div className="painel-madeira p-4">
          <p className="texto-contorno text-[22px]">Placa de madeira</p>
          <p className="texto-contorno texto-contorno-fino text-[13px]">Galinheiro nível 4 · 16 ninhos</p>
        </div>
        <div className="painel-escuro px-4 py-3 text-sm">
          .painel-escuro: base de toasts e avisos. Toast se faz com &lt;Toasts/&gt; (toast() de cliente/ui), nunca à mão.
        </div>
      </Exemplo>

      <Exemplo titulo="Campos e interruptores" className="painel space-y-3 p-5">
        <input className="campo" placeholder="Nome do animal" defaultValue="" aria-label="Nome do animal" />
        <input className="campo" aria-invalid="true" defaultValue="Nome com erro!!" aria-label="Campo inválido" />
        <select className="campo" aria-label="Filtro" defaultValue="raridade">
          <option value="raridade">Ordenar por raridade</option>
          <option value="vida">Ordenar por vida</option>
        </select>
        <input className="campo" disabled defaultValue="Desabilitado" aria-label="Desabilitado" />
        <div className="flex flex-wrap gap-6 pt-1">
          <Interruptor inicial rotulo="Sons" />
          <Interruptor inicial={false} rotulo="Vibração" />
          <Interruptor inicial={false} rotulo="Bloqueado" desabilitado />
        </div>
      </Exemplo>

      <Exemplo titulo="Chips (.chip sobre painel/madeira · .chip-hud sobre o céu), pílulas e badges" className="space-y-4 rounded-3xl bg-[#6cc644] p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="painel-madeira p-3">
            <p className="mb-2 font-titulo text-sm text-white">.chip (sobre painel)</p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="chip numeros" id="galeria-chip-moedas">
                <span className="chip-icone">
                  <Moeda />
                </span>
                1.250
              </span>
              <span className="chip numeros">
                <span className="chip-icone p-1">
                  <Ovo tipo="galinha" />
                </span>
                38
              </span>
              <span className="chip chip-claro numeros">
                <span className="chip-icone p-0.5">
                  <IconeNinho />
                </span>
                10/16
              </span>
            </div>
          </div>
          <div className="rounded-[22px] p-3" style={{ background: 'linear-gradient(180deg, #36a5f7, #67c5ff)' }}>
            <p className="mb-2 font-titulo text-sm text-white texto-contorno-fino">.chip-hud (sobre o céu)</p>
            <div className="flex flex-wrap items-center gap-1">
              <span className="chip chip-hud">
                <span className="chip-icone">
                  <Moeda />
                </span>
                <span className="chip-numero numeros">1.250</span>
              </span>
              <span className="chip chip-hud" data-cheio="">
                <span className="chip-icone">
                  <IconeNinho className="!h-[78%] !w-[97%]" />
                </span>
                <span className="chip-numero numeros">16/16</span>
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="pilula">Padrão</span>
          {RARIDADES.map((r) => (
            <span key={r.id} className="pilula" data-raridade={r.id}>
              {r.nome}
            </span>
          ))}
          <span className="pilula pilula-timer">
            <Timer /> 05:09:43
          </span>
          <span className="pilula pilula-pronto">PRONTO!</span>
          <span className="pilula pilula-aviso">ÚLTIMO CICLO</span>
          <span className="pilula pilula-perigo">ÚLTIMO DIA!</span>
        </div>
        <div className="flex items-center gap-8 pt-2">
          <button type="button" aria-label="Roleta, 3 novidades" className="botao botao-icone relative">
            <Settings />
            <span className="badge -top-2 -right-2">3</span>
          </button>
          <button type="button" aria-label="Coleção, 12 novidades" className="botao botao-icone botao-g relative">
            <Settings />
            <span className="badge badge-pulsa -top-1 -right-1">12</span>
          </button>
        </div>
      </Exemplo>

      <Exemplo titulo="Barras de progresso (só a interativa usa data-anima)" className="painel space-y-4 p-5">
        {(['verde', 'amarela', 'vermelha', 'azul', 'ouro'] as const).map((cor, i) => (
          <div key={cor} className="barra" data-cor={cor} style={{ '--barra-h': i === 0 ? '20px' : '14px' } as React.CSSProperties}>
            <span className="barra-preenchimento" style={{ '--p': [88, 45, 12, 62, 100][i] } as React.CSSProperties} />
            <span className="barra-texto">{[88, 45, 12, 62, 100][i]}%</span>
          </div>
        ))}
        <div className="flex items-center gap-3">
          <div className="barra flex-1" data-cor={vida > 50 ? 'verde' : vida > 20 ? 'amarela' : 'vermelha'} style={{ '--barra-h': '20px' } as React.CSSProperties}>
            <span className="barra-preenchimento" data-anima="" style={{ '--p': vida } as React.CSSProperties} />
            <span className="barra-texto">{vida}%</span>
          </div>
          <button type="button" className="botao botao-p" onClick={() => setVida((v) => (v <= 10 ? 100 : v - 22))}>
            Envelhecer
          </button>
        </div>
      </Exemplo>

      <Exemplo titulo="Paleta (tokens do @theme)" className="painel space-y-4 p-5">
        {PALETA.map((g) => (
          <div key={g.grupo}>
            <p className="mb-2 font-titulo text-[15px] text-texto">{g.grupo}</p>
            <div className="flex flex-wrap gap-2">
              {g.cores.map((c) => (
                <Amostra key={c} nome={c} />
              ))}
            </div>
          </div>
        ))}
      </Exemplo>
    </Moldura>
  );
}
