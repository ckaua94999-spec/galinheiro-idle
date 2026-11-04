'use client';

// Peças compartilhadas das telas de afiliados do painel: consultas (resumo, taxas e rede de um membro), o
// controle segmentado, o aviso de falha, o resumo das taxas em vigor e o caminho da tela principal com o
// período e a ordem em uso (para o "voltar" da rede de um membro devolver o admin ao mesmo lugar).
import type { AdminAfiliadosDTO, AdminRedeDTO, ConfigAfiliadosDTO } from '@galinheiro/api-contract';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { TriangleAlert, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { ErroApi, chamar } from '../../api';
import { cx } from '../../util';
import { BotaoAdm, Cartao, Selo, fmt, mensagemAdmin } from '../ui';
import { pct } from './formato';

export type Ordem = 'rede' | 'diretos' | 'comissoes';
export const PERIODOS = [7, 30, 90] as const;
export const ORDENS: { valor: Ordem; rotulo: string; dica: string }[] = [
  { valor: 'rede', rotulo: 'Rede', dica: 'Mais membros na rede (até 5 níveis)' },
  { valor: 'diretos', rotulo: 'Diretos', dica: 'Mais indicados diretos' },
  { valor: 'comissoes', rotulo: 'Comissões', dica: 'Mais comissões recebidas no período' },
];

/** Raiz das consultas de afiliados (invalidar isto atualiza todas as telas). */
export const CHAVE_AFILIADOS = ['admin', 'afiliados'] as const;

// 404/403 não melhoram tentando de novo
const repetir = (falhas: number, erro: unknown) => !(erro instanceof ErroApi && erro.status >= 400 && erro.status < 500) && falhas < 2;

export function useResumoAfiliados(dias: number, ordenar: Ordem) {
  return useQuery({
    queryKey: [...CHAVE_AFILIADOS, 'resumo', dias, ordenar],
    queryFn: async ({ signal }) =>
      (await chamar<AdminAfiliadosDTO>('GET', `/api/admin/afiliados?dias=${dias}&ordenar=${ordenar}`, { sinal: signal })).data,
    // ao trocar o período ou a ordem, o quadro anterior fica na tela (esmaecido) até o novo chegar
    placeholderData: keepPreviousData,
    retry: repetir,
  });
}

export function useConfigAfiliados() {
  return useQuery({
    queryKey: [...CHAVE_AFILIADOS, 'config'],
    queryFn: async ({ signal }) => (await chamar<ConfigAfiliadosDTO>('GET', '/api/admin/afiliados/config', { sinal: signal })).data,
    staleTime: 30_000,
    retry: repetir,
  });
}

export function useRedeMembro(id: string) {
  return useQuery({
    queryKey: [...CHAVE_AFILIADOS, 'rede', id],
    queryFn: async ({ signal }) => (await chamar<AdminRedeDTO>('GET', `/api/admin/afiliados/rede/${encodeURIComponent(id)}`, { sinal: signal })).data,
    retry: repetir,
  });
}

// ---------------------------------------------------------------- caminho da tela principal

const CHAVE_PAINEL = 'gi-admin-afiliados-painel';

/** Guarda o período/ordem da tela principal para o "voltar" da rede de um membro. */
export function lembrarPainel(busca: string): void {
  try {
    sessionStorage.setItem(CHAVE_PAINEL, busca);
  } catch {
    // modo privado/armazenamento bloqueado: o voltar só perde o período escolhido
  }
}

/** Caminho da tela principal (com o período da última visita), resolvido só no navegador. */
export function useCaminhoPainel(): string {
  const [caminho, setCaminho] = useState('/admin/afiliados');
  useEffect(() => {
    try {
      const busca = sessionStorage.getItem(CHAVE_PAINEL);
      if (busca) setCaminho(`/admin/afiliados?${busca}`);
    } catch {
      // sem armazenamento: fica o caminho simples
    }
  }, []);
  return caminho;
}

// ---------------------------------------------------------------- peças

/** Controle segmentado (rádios nativos: as setas do teclado já navegam), no visual da visão geral. */
export function Segmentado<T extends string | number>({ rotulo, opcoes, valor, aoMudar, className }: {
  rotulo: string;
  opcoes: readonly { valor: T; rotulo: ReactNode; dica?: string }[];
  valor: T;
  aoMudar: (v: T) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cx('vg-seg-grupo', className)}>
      <span id={id} className="vg-seg-rotulo">
        {rotulo}
      </span>
      <div className="vg-seg" role="radiogroup" aria-labelledby={id}>
        {opcoes.map((o) => (
          <label key={String(o.valor)} className="vg-seg-opcao" title={o.dica}>
            <input type="radio" name={id} value={String(o.valor)} checked={valor === o.valor} onChange={() => aoMudar(o.valor)} />
            <span>{o.rotulo}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/** Título de cartão com ícone em pastilha colorida (como nas seções da visão geral) e um complemento discreto. */
export function TituloSecao({ Icone, texto, tom, sub }: {
  Icone: LucideIcon;
  texto: ReactNode;
  tom: 'verde' | 'azul' | 'ambar' | 'roxo' | 'neutro';
  sub?: ReactNode;
}) {
  return (
    <span className="vg-secao-nome">
      <span className="vg-secao-icone" data-tom={tom} aria-hidden>
        <Icone className="h-4 w-4" />
      </span>
      <span>
        {texto}
        {sub && <span className="afi-titulo-sub"> · {sub}</span>}
      </span>
    </span>
  );
}

/** Cartão de falha com "Tentar de novo". */
export function Falha({ erro, tentar, titulo = 'Não deu para carregar.' }: { erro: unknown; tentar: () => void; titulo?: string }) {
  return (
    <Cartao>
      <div className="vg-falha" role="alert">
        <TriangleAlert className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">{titulo}</p>
          <p className="text-sm text-slate-500">{mensagemAdmin(erro)}</p>
        </div>
        <BotaoAdm tamanho="p" onClick={tentar}>
          Tentar de novo
        </BotaoAdm>
      </div>
    </Cartao>
  );
}

/** Selo do programa: ligado (verde) ou pausado (âmbar). */
export function SeloPrograma({ ativo }: { ativo: boolean }) {
  return (
    <Selo tom={ativo ? 'verde' : 'ambar'}>
      <span className="afi-luz" data-ativo={ativo || undefined} aria-hidden />
      {ativo ? 'Ligado' : 'Pausado'}
    </Selo>
  );
}

/** Fichas "Nível 1 · 10%" das taxas em vigor. */
export function FichasNiveis({ comissoesBp, pausado }: { comissoesBp: readonly number[]; pausado?: boolean }) {
  return (
    <ul className="afi-fichas" data-pausado={pausado || undefined} aria-label="Comissão de cada nível">
      {comissoesBp.map((bp, i) => (
        <li key={i} className="afi-ficha" data-zero={bp === 0 || undefined}>
          <span className="afi-ficha-nivel">Nível {i + 1}</span>
          <span className="afi-ficha-pct">{pct(bp)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Teto por extenso: "200,00 moedas por membro por dia" / "sem teto diário". */
export function TextoTeto({ tetoX100 }: { tetoX100: number | null }) {
  if (tetoX100 === null) return <>sem teto diário</>;
  return (
    <>
      <strong>{fmt.moedas(tetoX100)}</strong> moedas por membro por dia
    </>
  );
}
