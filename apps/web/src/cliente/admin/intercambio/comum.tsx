'use client';

// Peças compartilhadas do Intercâmbio no painel (telas do Intercâmbio, dos Cupons e a seção Tickets da ficha):
// a consulta do painel, a arte do ticket (vale do jogo), a arte de cada oferta (ovos empilhados ou o animal),
// a fichinha "🎟 10 tickets" e o aviso de que tickets são vales do jogo. Estilos em estilos/admin-intercambio.css.
import type { AdminIntercambioDTO } from '@galinheiro/api-contract';
import { tipoDoItem, type Item, type Tipo } from '@galinheiro/game-core';
import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';
import { ErroApi, chamar } from '../../api';
import { FiguraAnimal } from '../../arte/Animal';
import { Ovo } from '../../arte/Icones';
import { cx } from '../../util';
import { fmt } from '../ui';

/** Raiz das consultas do Intercâmbio no painel (invalidar isto atualiza regras, ofertas e estatísticas). */
export const CHAVE_INTERCAMBIO = ['admin', 'intercambio'] as const;

// 404/403 não melhoram tentando de novo
export const repetir = (falhas: number, erro: unknown): boolean =>
  !(erro instanceof ErroApi && erro.status >= 400 && erro.status < 500) && falhas < 2;

export function usePainelIntercambio() {
  return useQuery({
    queryKey: CHAVE_INTERCAMBIO,
    queryFn: async ({ signal }) => (await chamar<AdminIntercambioDTO>('GET', '/api/admin/intercambio', { sinal: signal })).data,
    // as trocas e os tickets em circulação mudam enquanto a tela está aberta
    refetchInterval: 60_000,
    retry: repetir,
  });
}

/** Ticket do Intercâmbio: vale do jogo (rosa, com picote e estrela), nunca um símbolo monetário. */
export function IconeTicket({ className, titulo }: { className?: string; titulo?: string }) {
  const id = `itc-tk-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg viewBox="0 0 32 24" className={className} role={titulo ? 'img' : undefined} aria-hidden={titulo ? undefined : true}>
      {titulo && <title>{titulo}</title>}
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbcfe8" />
          <stop offset="0.45" stopColor="#f472b6" />
          <stop offset="1" stopColor="#db2777" />
        </linearGradient>
      </defs>
      {/* corpo com os dois recortes laterais */}
      <path
        d="M4.5 2.5h23a2.5 2.5 0 0 1 2.5 2.5v4a3 3 0 0 0 0 6v4a2.5 2.5 0 0 1-2.5 2.5h-23A2.5 2.5 0 0 1 2 19v-4a3 3 0 0 0 0-6V5a2.5 2.5 0 0 1 2.5-2.5z"
        fill={`url(#${id})`}
        stroke="#9d174d"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* brilho no alto */}
      <path d="M5.5 5h20" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.3" strokeLinecap="round" />
      {/* picote */}
      <path d="M21.5 4.5v15" stroke="#9d174d" strokeOpacity="0.55" strokeWidth="1.3" strokeDasharray="1.7 1.7" />
      {/* estrela */}
      <path
        d="M12 6.9l1.33 2.87 3.13.36-2.32 2.13.63 3.09L12 13.8l-2.77 1.55.63-3.09-2.32-2.13 3.13-.36z"
        fill="#fff"
        stroke="#9d174d"
        strokeOpacity="0.35"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Fichinha "🎟 10 tickets". */
export function ChipTickets({ n, className, tamanho = 'm' }: { n: number; className?: string; tamanho?: 'p' | 'm' | 'g' }) {
  return (
    <span className={cx('itc-chip-tickets', className)} data-tamanho={tamanho}>
      <IconeTicket className="itc-chip-icone" />
      <span className="itc-chip-n">{fmt.int(n)}</span>
      <span className="itc-chip-rotulo">{n === 1 ? 'ticket' : 'tickets'}</span>
    </span>
  );
}

/** Arte de uma oferta: ovos empilhados (com a quantidade) ou o animal, num ladrilho da cor da espécie. */
export function ArteOferta({ tipo, item, quantidade, animal, tamanho = 'm', apagada }: {
  tipo: 'ovos' | 'animal';
  item: Item | null;
  quantidade: number | null;
  animal: Tipo | null;
  tamanho?: 'p' | 'm' | 'g';
  /** oferta pausada: arte em tons de cinza */
  apagada?: boolean;
}) {
  if (tipo === 'animal' && animal) {
    return (
      <span className="itc-arte" data-especie={animal} data-tamanho={tamanho} data-apagada={apagada || undefined} aria-hidden>
        <FiguraAnimal tipo={animal} humor="feliz" ninho={false} detalhe="p" className="itc-arte-animal" />
      </span>
    );
  }
  const especie: Tipo = item ? tipoDoItem(item) : 'galinha';
  const q = quantidade ?? 0;
  return (
    <span className="itc-arte" data-especie={especie} data-tamanho={tamanho} data-apagada={apagada || undefined} aria-hidden>
      {q > 1 && (
        <>
          <Ovo tipo={especie} className="itc-arte-ovo itc-arte-ovo-esq" />
          <Ovo tipo={especie} className="itc-arte-ovo itc-arte-ovo-dir" />
        </>
      )}
      <Ovo tipo={especie} className="itc-arte-ovo itc-arte-ovo-frente" />
      {q > 0 && <span className="itc-arte-qtd">×{fmt.compacto(q)}</span>}
    </span>
  );
}

/** O aviso obrigatório: de onde vêm os tickets (sempre do jogo). */
export function AvisoTickets({ className }: { className?: string }) {
  return (
    <p className={cx('itc-aviso', className)}>
      <IconeTicket className="itc-aviso-ticket" />
      <span>
        <strong>Tickets são vales do jogo:</strong> vêm de cupons, de ajustes da equipe e (se ligado) da compra com moedas do jogo. Não se
        compram com dinheiro.
      </span>
    </p>
  );
}
