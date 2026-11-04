'use client';

// Galeria da área "cartas" (dev): as 4 raridades × estados (pronto, aguardando, último ciclo, último dia, triste,
// aposentado), compacta e completa, larguras estreitas, carta da folha em escala, sem selo/anel (revelação), editor de
// nome, verso e esqueleto.
import type { EntityDTO } from '@galinheiro/api-contract';
import { TIPOS, formatarTimer, type Tipo } from '@galinheiro/game-core';
import { Clock, Info, Pencil } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Carta, EsqueletoCarta, VersoCarta } from '@/cliente/componentes/Carta';
import { Exemplo, Moldura } from '../_Moldura';
import { AGORA_FICTICIO, entidadeFicticia, type OpcoesEntidade } from '../_mock';

const H = 3_600_000;
const RARIDADE_DO_TIPO = { galinha: 'comum', pato: 'raro', ganso: 'epico', avestruz: 'lendario' } as const;
const NOMES: Record<Tipo, string> = { galinha: 'Jujuba', pato: 'Patolino', ganso: 'Duquesa', avestruz: 'Estrela' };

type Variante = 'pronto' | 'aguardando' | 'ultimo-ciclo' | 'ultimo-dia' | 'triste' | 'aposentado';

const VARIANTES: { id: Variante; titulo: string; o: OpcoesEntidade }[] = [
  { id: 'pronto', titulo: 'Pronto (feliz)', o: { pronto: true, tier: 'feliz' } },
  { id: 'aguardando', titulo: 'Aguardando (neutro)', o: { tier: 'neutro', faltaH: 5.16 } },
  { id: 'ultimo-ciclo', titulo: 'Último ciclo (cansado)', o: { tier: 'cansado', ultimoCiclo: true, faltaH: 9.4 } },
  { id: 'ultimo-dia', titulo: 'Último dia', o: { vida: 4, ultimoCiclo: true, faltaH: 3.1 } },
  { id: 'triste', titulo: 'Triste', o: { tier: 'triste', faltaH: 20 } },
  { id: 'aposentado', titulo: 'Aposentado', o: { aposentado: true } },
];

/** Entidade fictícia da variante (o "último dia" ajusta a aposentadoria para daqui a 5 h). */
function exemplo(tipo: Tipo, v: Variante, extra: OpcoesEntidade = {}): EntityDTO {
  const def = VARIANTES.find((x) => x.id === v)!;
  const e = entidadeFicticia({ tipo, slot: TIPOS.indexOf(tipo) + 1, nome: NOMES[tipo], ...def.o, ...extra, id: `galeria-${tipo}-${v}` });
  if (v === 'ultimo-dia') return { ...e, expiracao: new Date(AGORA_FICTICIO + 5 * H).toISOString(), diasRestantes: 1 };
  return e;
}

function Acoes({ e, editando = false }: { e: EntityDTO; editando?: boolean }) {
  return (
    <>
      {e.status === 'ativo' && (
        <button type="button" className={e.pronto ? 'botao botao-primario' : 'botao botao-primario folha-coletar-espera'} disabled={!e.pronto} aria-label="Coletar">
          {e.pronto ? (
            'Coletar'
          ) : (
            <>
              <Clock className="h-5 w-5" strokeWidth={3} />
              <span className="numeros">Em {formatarTimer(Date.parse(e.proximoRendimento) - AGORA_FICTICIO)}</span>
            </>
          )}
        </button>
      )}
      <button type="button" className="botao botao-p botao-secundario" disabled={editando}>
        <Pencil className="h-4 w-4" /> Renomear
      </button>
      <button type="button" className="botao botao-p botao-secundario" aria-label="Informações">
        <Info className="h-4 w-4" /> Info
      </button>
    </>
  );
}

export function SecaoCartas() {
  return (
    <Moldura titulo="Cartas">
      {VARIANTES.map((v) => (
        <Exemplo key={v.id} titulo={`Compactas · ${v.titulo}`} className="grid max-w-3xl grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4">
          {TIPOS.map((t) => (
            <Carta key={t} e={exemplo(t, v.id)} agora={AGORA_FICTICIO} compacta />
          ))}
        </Exemplo>
      ))}

      <Exemplo titulo="Completas · 4 raridades (pronto)" className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-4">
        {TIPOS.map((t) => (
          <div key={t} data-raridade={RARIDADE_DO_TIPO[t]} className="carta-palco">
            <span className="carta-palco-raios" aria-hidden />
            <Carta e={exemplo(t, 'pronto')} agora={AGORA_FICTICIO} aoEditar={() => {}}>
              <Acoes e={exemplo(t, 'pronto')} />
            </Carta>
          </div>
        ))}
      </Exemplo>

      <Exemplo titulo="Completas · estados" className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ['pato', 'aguardando'],
            ['ganso', 'ultimo-ciclo'],
            ['galinha', 'ultimo-dia'],
            ['avestruz', 'triste'],
            ['pato', 'aposentado'],
            ['galinha', 'aposentado'],
            ['ganso', 'aposentado'],
            ['avestruz', 'aposentado'],
          ] as const
        ).map(([t, v]) => {
          const e = exemplo(t, v);
          return (
            <div key={`${t}-${v}`} data-raridade={RARIDADE_DO_TIPO[t]} className="carta-palco" data-aposentado={v === 'aposentado' ? '' : undefined}>
              <span className="carta-palco-raios" aria-hidden />
              <Carta e={e} agora={AGORA_FICTICIO} aoEditar={() => {}}>
                <Acoes e={e} />
              </Carta>
            </div>
          );
        })}
      </Exemplo>

      <Exemplo titulo="Gota · valores longos (4,00 · 12,50 · 999,99 · 1,2k) e vida baixa (4% · 12%)" className="grid max-w-3xl grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4">
        {[400, 1250, 99999, 123456].map((v) => (
          <Carta key={v} e={{ ...exemplo('avestruz', 'pronto'), id: `galeria-valor-${v}`, valorOvoX100: v }} agora={AGORA_FICTICIO} compacta />
        ))}
        {[4, 12].map((vida) => (
          <Carta key={vida} e={exemplo('pato', 'aguardando', { vida, id: `galeria-vida-${vida}` })} agora={AGORA_FICTICIO} compacta />
        ))}
      </Exemplo>

      <Exemplo titulo="Completas · valor longo e vida baixa" className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-4">
        <Carta e={{ ...exemplo('ganso', 'pronto'), id: 'galeria-valor-c', valorOvoX100: 1250 }} agora={AGORA_FICTICIO} />
        <Carta e={{ ...exemplo('galinha', 'aguardando', { vida: 4 }), id: 'galeria-vida-c', valorOvoX100: 99999 }} agora={AGORA_FICTICIO} />
      </Exemplo>

      <Exemplo titulo="Completas estreitas · 300, 280, 264 e 240 px (timer encolhe com a largura)" className="flex flex-wrap items-start gap-8">
        {[300, 280, 264, 240].map((w) => (
          <div key={w} style={{ width: w }}>
            <Carta e={{ ...exemplo('pato', 'aguardando'), id: `galeria-larg-${w}` }} agora={AGORA_FICTICIO} aoEditar={() => {}} />
          </div>
        ))}
      </Exemplo>

      <Exemplo
        titulo="Completas bem estreitas · 250 e 228 px (carta solta em coluna apertada; a folha não usa: lá a carta é sempre a de 300 px em escala)"
        className="flex flex-wrap items-start gap-8"
      >
        {(['ganso', 'avestruz'] as const).map((t) =>
          [250, 228].map((w) => (
            <div key={`${t}-${w}`} style={{ width: w }}>
              <Carta e={{ ...exemplo(t, t === 'ganso' ? 'aguardando' : 'ultimo-ciclo'), id: `galeria-mini-${t}-${w}` }} agora={AGORA_FICTICIO} aoEditar={() => {}} />
            </div>
          )),
        )}
        <div style={{ width: 228 }}>
          <Carta e={{ ...exemplo('galinha', 'aposentado'), id: 'galeria-mini-apos' }} agora={AGORA_FICTICIO} />
        </div>
      </Exemplo>

      {/* cada caixa tem a largura real do palco na escala (carta 300 × escala + respiro lateral do palco),
          para a galeria mostrar o resultado sem cortar carta, fita nem botões */}
      <Exemplo
        titulo="Folha · carta em escala (0,81 · 0,95 · 1 = 320×568 · 360×640 · 390×844) e aposentado sem Coletar em 320 (0,85, limitado pelo respiro lateral): a carta inteira encolhe, a diagramação não muda; botões em tamanho real"
        className="flex flex-wrap items-start gap-6"
      >
        {(
          [
            [0.81, 'ganso', 'aguardando'],
            [0.95, 'avestruz', 'pronto'],
            [1, 'pato', 'ultimo-ciclo'],
            [0.85, 'pato', 'aposentado'],
          ] as const
        ).map(([escala, t, v]) => {
          const e = { ...exemplo(t, v), id: `galeria-escala-${escala}` };
          return (
            <div key={escala} style={{ width: `calc(300px * ${escala} + 52px)` }}>
              <div
                data-raridade={RARIDADE_DO_TIPO[t]}
                className="carta-palco carta-palco-escala"
                data-aposentado={v === 'aposentado' ? '' : undefined}
                style={{ '--carta-escala': escala } as CSSProperties}
              >
                <span className="carta-palco-raios" aria-hidden />
                <Carta e={e} agora={AGORA_FICTICIO} aoEditar={() => {}}>
                  <Acoes e={e} />
                </Carta>
              </div>
            </div>
          );
        })}
        <div style={{ width: 'calc(300px * 0.81 + 52px)' }}>
          <div data-raridade="raro" className="carta-palco carta-palco-escala" style={{ '--carta-escala': 0.81 } as CSSProperties}>
            <span className="carta-palco-raios" aria-hidden />
            <Carta e={{ ...exemplo('pato', 'pronto', { nome: 'Nome com @' }), id: 'galeria-escala-edit' }} agora={AGORA_FICTICIO} editando aoSalvarNome={() => {}} aoCancelarNome={() => {}}>
              <Acoes e={exemplo('pato', 'pronto')} editando />
            </Carta>
          </div>
        </div>
      </Exemplo>

      <Exemplo titulo="Completas · semSelo + semAnel (revelação)" className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-4">
        <Carta e={exemplo('avestruz', 'pronto')} agora={AGORA_FICTICIO} semSelo semAnel />
        <Carta e={exemplo('ganso', 'ultimo-ciclo')} agora={AGORA_FICTICIO} semSelo />
      </Exemplo>

      <Exemplo titulo="Completa · editando o nome" className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-4">
        <Carta e={exemplo('pato', 'aguardando')} agora={AGORA_FICTICIO} editando aoSalvarNome={() => {}} aoCancelarNome={() => {}} />
        <Carta e={exemplo('avestruz', 'pronto', { nome: 'Nome com @' })} agora={AGORA_FICTICIO} editando aoSalvarNome={() => {}} aoCancelarNome={() => {}} />
      </Exemplo>

      <Exemplo titulo="Verso (completa e compacta)" className="flex flex-wrap items-start gap-8">
        {(['comum', 'raro', 'epico', 'lendario'] as const).map((r) => (
          <VersoCarta key={r} raridade={r} className="w-[300px]" />
        ))}
        <div className="grid w-[360px] grid-cols-2 gap-3">
          <VersoCarta compacta />
          <VersoCarta compacta raridade="lendario" />
        </div>
      </Exemplo>

      <Exemplo titulo="Esqueleto (Coleção carregando)" className="grid max-w-3xl grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <EsqueletoCarta key={i} indice={i} />
        ))}
      </Exemplo>
    </Moldura>
  );
}
