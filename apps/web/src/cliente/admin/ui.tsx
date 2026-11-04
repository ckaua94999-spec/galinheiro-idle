'use client';

// Peças visuais do painel administrador (visual de ferramenta interna: limpo, denso e legível). Estilos em
// app/estilos/admin.css (escopo .admin). Reaproveitadas por todas as telas do /admin.
import type { CodigoErro } from '@galinheiro/api-contract';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ErroApi } from '../api';
import { cx } from '../util';

/** Mensagem legível de um erro da API (validação mostra o 1º motivo). */
export function mensagemAdmin(erro: unknown): string {
  if (erro instanceof ErroApi) {
    const issues = erro.detalhes?.issues as { mensagem?: string }[] | undefined;
    if (erro.codigo === ('PAYLOAD_INVALIDO' as CodigoErro) && issues?.[0]?.mensagem) return issues[0].mensagem;
    return erro.message;
  }
  return erro instanceof Error ? erro.message : 'Algo deu errado.';
}

const NUM = new Intl.NumberFormat('pt-BR');
const NUM1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const MOEDA = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const COMPACTO = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

export const fmt = {
  int: (n: number) => NUM.format(Math.round(n)),
  dec: (n: number) => NUM1.format(n),
  /** moedas do jogo (centavos → "1.234,56") */
  moedas: (x100: number) => MOEDA.format(x100 / 100),
  compacto: (n: number) => COMPACTO.format(n),
  /** "05/10" a partir de "2026-10-05" */
  diaCurto: (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`,
  dataHora: (iso: string) =>
    new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)),
  /** "agora", "há 5 min", "há 3 h", "há 2 dias" */
  relativo: (iso: string | null, agora = Date.now()) => {
    if (!iso) return '—';
    const s = Math.max(0, (agora - Date.parse(iso)) / 1000);
    if (s < 60) return 'agora';
    if (s < 3600) return `há ${Math.floor(s / 60)} min`;
    if (s < 86_400) return `há ${Math.floor(s / 3600)} h`;
    const d = Math.floor(s / 86_400);
    return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
  },
};

export function Cartao({ titulo, acoes, children, className }: { titulo?: ReactNode; acoes?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('adm-cartao', className)}>
      {(titulo || acoes) && (
        <header className="adm-cartao-cabeca">
          {titulo && <h2 className="adm-cartao-titulo">{titulo}</h2>}
          {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Kpi({ rotulo, valor, detalhe, tom = 'neutro', icone }: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  tom?: 'neutro' | 'verde' | 'azul' | 'ambar' | 'vermelho' | 'roxo';
  icone?: ReactNode;
}) {
  return (
    <div className="adm-kpi" data-tom={tom}>
      <div className="flex items-start justify-between gap-2">
        <p className="adm-kpi-rotulo">{rotulo}</p>
        {icone && <span className="adm-kpi-icone" aria-hidden>{icone}</span>}
      </div>
      <p className="adm-kpi-valor">{valor}</p>
      {detalhe && <p className="adm-kpi-detalhe">{detalhe}</p>}
    </div>
  );
}

export function Selo({ children, tom = 'neutro' }: { children: ReactNode; tom?: 'neutro' | 'verde' | 'azul' | 'ambar' | 'vermelho' | 'roxo' }) {
  return (
    <span className="adm-selo" data-tom={tom}>
      {children}
    </span>
  );
}

export function BotaoAdm({
  children, variante = 'secundario', tamanho = 'm', className, ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primario' | 'secundario' | 'perigo' | 'fantasma'; tamanho?: 'p' | 'm' }) {
  return (
    <button type="button" {...resto} className={cx('adm-botao', className)} data-variante={variante} data-tamanho={tamanho}>
      {children}
    </button>
  );
}

/** Modal simples do painel (foco no 1º campo, Esc e clique fora fecham). */
export function ModalAdm({ aberto, titulo, aoFechar, children, largura = 'm' }: {
  aberto: boolean;
  titulo: string;
  aoFechar: () => void;
  children: ReactNode;
  largura?: 'm' | 'g';
}) {
  const id = useId();
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      caixa.current?.querySelector<HTMLElement>('[data-autofoco], input, textarea, select, button:not(.adm-modal-fechar)')?.focus();
    }, 30);
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', tecla);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', tecla);
      anterior?.focus?.();
    };
  }, [aberto, aoFechar]);
  if (!aberto) return null;
  return (
    <div className="adm-modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div ref={caixa} className="adm-modal" data-largura={largura} role="dialog" aria-modal="true" aria-labelledby={id}>
        <header className="adm-modal-cabeca">
          <h2 id={id}>{titulo}</h2>
          <button type="button" className="adm-modal-fechar" onClick={aoFechar} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="adm-modal-corpo">{children}</div>
      </div>
    </div>
  );
}

export function Campo({ rotulo, dica, erro, children }: { rotulo: string; dica?: ReactNode; erro?: string | null; children: ReactNode }) {
  return (
    <label className="adm-campo">
      <span className="adm-campo-rotulo">{rotulo}</span>
      {children}
      {dica && !erro && <span className="adm-campo-dica">{dica}</span>}
      {erro && <span className="adm-campo-erro">{erro}</span>}
    </label>
  );
}

export function Vazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="adm-vazio">
      <p className="adm-vazio-titulo">{titulo}</p>
      {children && <div className="adm-vazio-texto">{children}</div>}
    </div>
  );
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="adm-carregando" role="status">
      <span className="adm-spinner" aria-hidden />
      {texto}
    </div>
  );
}
