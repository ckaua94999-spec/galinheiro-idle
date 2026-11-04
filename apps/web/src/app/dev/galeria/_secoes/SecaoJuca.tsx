'use client';

// Galeria do Seu Juca (dev): o mascote em todas as expressões, tamanhos e contextos reais
// (balão do tutorial sobre o véu escuro, tela de carregamento, painel do galinheiro vazio, entrada ao lado
// das aves, aceno da abertura) + teste de silhueta. Sem estado nem efeitos: tudo é render puro.
import { FiguraAnimal } from '@/cliente/arte/Animal';
import { Juca, type ExpressaoJuca } from '@/cliente/arte/Juca';
import { Exemplo, Moldura } from '../_Moldura';

const EXPRESSOES: ExpressaoJuca[] = ['feliz', 'falando', 'surpreso', 'piscando'];

const FALAS: Record<ExpressaoJuca, string> = {
  feliz: 'Bem-vindo ao seu galinheiro! Eu sou o Seu Juca.',
  falando: 'Ovo vira moeda. Toque em Vender e venda tudo!',
  surpreso: 'Opa! Um ganso épico? Que sorte, hein!',
  piscando: 'Isso aí! Você pegou o jeito da coisa.',
};

function Rotulo({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-extrabold text-texto-suave">{children}</span>;
}

/** Réplica visual do balão do tutorial (mesmas classes de ui.css) com a expressão pedida. */
function BalaoExemplo({ expressao }: { expressao: ExpressaoJuca }) {
  return (
    <div className="balao-juca">
      <div className="balao-juca-figura">
        <Juca expressao={expressao} sombra={false} />
      </div>
      <div className="painel balao">
        <span className="pilula pilula-aviso balao-nome">Seu Juca</span>
        <p className="balao-texto">{FALAS[expressao]}</p>
        <div className="mt-1.5 flex items-center justify-end gap-2">
          <span className="botao botao-primario botao-p">Vamos lá!</span>
        </div>
      </div>
    </div>
  );
}

export function SecaoJuca() {
  return (
    <Moldura titulo="Seu Juca">
      <Exemplo titulo="expressões (112 px)" className="flex flex-wrap items-end gap-4">
        {EXPRESSOES.map((e) => (
          <div key={e} className="flex flex-col items-center gap-1" data-expressao={e}>
            <Juca expressao={e} className="h-28 w-28" />
            <Rotulo>{e}</Rotulo>
          </div>
        ))}
      </Exemplo>

      <Exemplo titulo="leitura a 80 px (feliz e falando precisam se distinguir lado a lado)" className="flex flex-wrap items-end gap-3">
        {EXPRESSOES.map((e) => (
          <div key={e} className="flex flex-col items-center gap-1">
            <Juca expressao={e} className="h-20 w-20" />
            <Rotulo>{e}</Rotulo>
          </div>
        ))}
      </Exemplo>

      <Exemplo titulo="falando x surpreso parados (80 px): a surpresa lê sem depender do '!' (olho oval alto, sobrancelha alta, chapéu pulado, bico em O)" className="flex flex-wrap items-end gap-3">
        <Juca expressao="falando" parado className="h-20 w-20" />
        <Juca expressao="surpreso" parado className="h-20 w-20" />
        <Juca expressao="falando" parado className="h-28 w-28" />
        <Juca expressao="surpreso" parado className="h-28 w-28" />
      </Exemplo>

      <Exemplo titulo="caixa 120×120 com overflow escondido (tracejado): nada da arte sai do viewBox" className="flex flex-wrap items-end gap-2">
        {EXPRESSOES.map((e) => (
          <div key={e} className="h-24 w-24 overflow-hidden rounded-md outline-2 outline-dashed outline-texto-suave/50">
            <Juca expressao={e} className="h-full w-full" style={{ overflow: 'hidden' }} />
          </div>
        ))}
        <div className="h-24 w-24 overflow-hidden rounded-md outline-2 outline-dashed outline-texto-suave/50">
          <Juca expressao="piscando" acenando className="h-full w-full" style={{ overflow: 'hidden' }} />
        </div>
      </Exemplo>

      <Exemplo titulo="detalhe (240 px)" className="flex flex-wrap items-end gap-2">
        {EXPRESSOES.map((e) => (
          <Juca key={e} expressao={e} className="h-60 w-60" />
        ))}
      </Exemplo>

      <Exemplo titulo="acenando (tela de entrada, 188 px): a asa de lá abana atrás da cabeça, a do flanco fica dobrada; parado = asa erguida" className="flex flex-wrap items-end gap-2">
        <Juca expressao="feliz" acenando className="h-[188px] w-[188px]" />
        <Juca expressao="piscando" acenando className="h-[188px] w-[188px]" />
        <Juca expressao="feliz" acenando parado className="h-28 w-28" />
      </Exemplo>

      <Exemplo titulo="80 px ao lado da galinha (mesma família)" className="flex flex-wrap items-end gap-1">
        <Juca expressao="falando" className="h-20 w-20" />
        <FiguraAnimal tipo="galinha" humor="neutro" ninho={false} className="h-20 w-20" />
        <Juca expressao="feliz" className="h-20 w-20" />
        <FiguraAnimal tipo="galinha" humor="feliz" ninho={false} className="h-20 w-20" />
      </Exemplo>

      <Exemplo titulo="ao lado das aves (110 px, como na entrada): mesma família" className="flex flex-wrap items-end gap-2">
        <Juca className="h-[110px] w-[110px]" />
        <FiguraAnimal tipo="galinha" ninho={false} className="h-[110px] w-[110px]" />
        <FiguraAnimal tipo="pato" ninho={false} className="h-[110px] w-[110px]" atrasoS={0.8} />
        <FiguraAnimal tipo="ganso" ninho={false} className="h-[110px] w-[110px]" atrasoS={1.6} />
        <FiguraAnimal tipo="avestruz" ninho={false} className="h-[110px] w-[110px]" atrasoS={2.4} />
      </Exemplo>

      <Exemplo titulo="tamanhos (tutorial 80–92 px, carregando 112 px, entrada 112 px, 192 px)" className="flex flex-wrap items-end gap-4">
        <Juca className="h-20 w-20" />
        <Juca className="h-24 w-24" />
        <Juca className="h-28 w-28" />
        <Juca className="h-48 w-48" />
      </Exemplo>

      <Exemplo titulo="balão do tutorial (sobre o véu)">
        <div className="space-y-7 rounded-3xl p-4 pt-6" style={{ background: 'linear-gradient(rgb(20 12 30 / .62), rgb(20 12 30 / .62)), linear-gradient(180deg, #49b8ff, #c4ecff 45%, #6cc644 46%, #3f8f2a)' }}>
          {EXPRESSOES.map((e) => (
            <BalaoExemplo key={e} expressao={e} />
          ))}
        </div>
      </Exemplo>

      <Exemplo titulo="galinheiro vazio (painel claro, 80 px)">
        <div className="painel mx-auto flex max-w-md items-center gap-3 p-4">
          <Juca expressao="falando" className="h-20 w-20 shrink-0" />
          <div className="text-left">
            <p className="font-titulo text-lg leading-tight">Seu galinheiro está esperando moradores!</p>
            <span className="botao botao-primario botao-p mt-2">Ir à Roleta</span>
          </div>
        </div>
      </Exemplo>

      <Exemplo titulo="carregamento e painel de erro" className="flex flex-wrap items-end gap-4">
        <div className="relative grid h-56 w-56 place-items-center overflow-hidden rounded-3xl" style={{ background: 'radial-gradient(circle at 50% 45%, #c4ecff, #49b8ff)' }}>
          <div className="flex flex-col items-center">
            <div className="carregando-juca">
              <Juca />
            </div>
            <div className="carregando-sombra" />
          </div>
        </div>
        <div className="painel w-60 p-4 text-center">
          <Juca expressao="surpreso" className="mx-auto h-24 w-24" />
          <p className="mt-2 font-titulo text-[18px] leading-6 text-texto">Não consegui abrir o galinheiro.</p>
        </div>
      </Exemplo>

      <Exemplo titulo="parado (sem animação) e silhueta a 32 px" className="flex flex-wrap items-end gap-4">
        <Juca parado className="h-20 w-20" />
        <Juca parado className="juca-silhueta h-8 w-8" />
        <Juca parado expressao="surpreso" className="juca-silhueta h-8 w-8" />
        <Juca className="h-8 w-8" />
      </Exemplo>
    </Moldura>
  );
}
