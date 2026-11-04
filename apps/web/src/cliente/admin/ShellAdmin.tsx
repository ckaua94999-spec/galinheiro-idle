'use client';

// Casca do painel administrador: sem sessão do painel, mostra o login próprio do painel (usuário e senha, separado
// da conta do jogo); com ela, menu lateral no desktop e gaveta no celular, contador do atendimento (não lidas)
// atualizado a cada 15 s e atalhos para o jogo e para sair. A conta do jogo com papel de admin também entra.
import type { AdminListaConversasDTO, AdminSessaoDTO, SessaoDTO } from '@galinheiro/api-contract';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight, Gamepad2, LayoutDashboard, LogOut, Megaphone, Menu, MessagesSquare, Network, Percent, ScrollText, TicketPercent, Users, Wallet, X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { chamar } from '../api';
import { Toasts } from '../componentes/Toasts';
import { limparCacheEstado } from '../estado';
import { cx } from '../util';
import { EntrarAdmin } from './EntrarAdmin';
import { Carregando } from './ui';

const ITENS = [
  { href: '/admin', rotulo: 'Visão geral', Icone: LayoutDashboard, exato: true },
  { href: '/admin/usuarios', rotulo: 'Usuários', Icone: Users },
  // a rede de cada membro (/admin/afiliados/[id]) fica neste item; as taxas têm o próprio
  { href: '/admin/afiliados', rotulo: 'Rede de afiliados', Icone: Network, exceto: '/admin/afiliados/taxas' },
  { href: '/admin/afiliados/taxas', rotulo: 'Taxas e comissões', Icone: Percent },
  // tickets do jogo: a tabela de trocas (ovos e animais) e os códigos que dão tickets
  { href: '/admin/intercambio', rotulo: 'Intercâmbio', Icone: ArrowLeftRight },
  { href: '/admin/cupons', rotulo: 'Cupons', Icone: TicketPercent },
  { href: '/admin/pagamentos', rotulo: 'Pagamentos', Icone: Wallet },
  { href: '/admin/atendimento', rotulo: 'Atendimento', Icone: MessagesSquare, contador: true },
  { href: '/admin/popups', rotulo: 'Popups', Icone: Megaphone },
  { href: '/admin/auditoria', rotulo: 'Auditoria', Icone: ScrollText },
] as const;

/** Sessão da conta do JOGO (para saber se a ficha aberta é a do próprio admin que entrou pelo jogo). */
export function useSessaoAdmin() {
  return useQuery({
    queryKey: ['sessao'],
    queryFn: async () => (await chamar<SessaoDTO>('GET', '/auth/sessao')).data,
    staleTime: 60_000,
  });
}

/** Quem está no painel: o login do painel ou a conta do jogo com papel de admin. */
export function usePainelSessao() {
  return useQuery({
    queryKey: ['admin', 'sessao'],
    queryFn: async () => (await chamar<AdminSessaoDTO>('GET', '/api/admin/auth/sessao')).data,
    staleTime: 60_000,
  });
}

function Marca() {
  return (
    <Link href="/admin" className="adm-marca">
      <span className="adm-marca-logo" aria-hidden>
        🐔
      </span>
      <span className="leading-tight">
        <span className="adm-marca-nome">Galinheiro</span>
        <span className="adm-marca-sub">
          <span className="adm-marca-pix">PIX</span> Administração
        </span>
      </span>
    </Link>
  );
}

export function ShellAdmin({ children }: { children: ReactNode }) {
  const caminho = usePathname() ?? '';
  const qc = useQueryClient();
  const sessao = usePainelSessao();
  const [menuAberto, setMenuAberto] = useState(false);
  const admin = !!sessao.data?.autenticado;
  const contagem = useQuery({
    queryKey: ['admin', 'suporte', 'contagem'],
    queryFn: async () => (await chamar<AdminListaConversasDTO>('GET', '/api/admin/suporte?status=aberta')).data.naoLidasTotal,
    enabled: admin,
    refetchInterval: 15_000,
  });

  useEffect(() => setMenuAberto(false), [caminho]);

  const sair = async () => {
    if (sessao.data?.via === 'painel') {
      await chamar('POST', '/api/admin/auth/sair').catch(() => {});
    } else {
      // entrou pela conta do jogo: sair do painel é sair da conta
      await chamar('POST', '/auth/sair').catch(() => {});
      limparCacheEstado();
    }
    qc.clear(); // volta para a tela de entrada do painel
  };

  if (sessao.isPending) {
    return (
      <div className="admin grid min-h-dvh place-items-center">
        <Carregando texto="Abrindo o painel…" />
      </div>
    );
  }
  if (!admin) {
    return (
      <>
        <EntrarAdmin configurado={sessao.data?.configurado ?? true} />
        <Toasts />
      </>
    );
  }

  const naoLidas = contagem.data ?? 0;
  const dentro = (base: string) => caminho === base || caminho.startsWith(`${base}/`);
  const menu = (
    <nav className="adm-nav" aria-label="Seções do painel">
      {ITENS.map(({ href, rotulo, Icone, ...item }) => {
        const ativo = 'exato' in item ? caminho === href : dentro(href) && !('exceto' in item && dentro(item.exceto));
        return (
          <Link key={href} href={href} className={cx('adm-nav-item', ativo && 'adm-nav-ativo')} aria-current={ativo ? 'page' : undefined}>
            <Icone className="h-[18px] w-[18px]" aria-hidden />
            <span className="flex-1">{rotulo}</span>
            {'contador' in item && naoLidas > 0 && <span className="adm-nav-contador">{naoLidas > 99 ? '99+' : naoLidas}</span>}
          </Link>
        );
      })}
    </nav>
  );
  const rodape = (
    <div className="adm-lateral-rodape">
      <p className="truncate text-xs text-slate-400">
        Logado como <strong className="text-slate-200">{sessao.data?.usuario ?? sessao.data?.nome}</strong>
      </p>
      <div className="mt-2 flex gap-2">
        <Link href="/galinheiro" className="adm-botao flex-1" data-variante="escuro" data-tamanho="p">
          <Gamepad2 className="h-4 w-4" aria-hidden /> Jogo
        </Link>
        <button type="button" className="adm-botao flex-1" data-variante="escuro" data-tamanho="p" onClick={() => void sair()}>
          <LogOut className="h-4 w-4" aria-hidden /> Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="admin adm-casca">
      <aside className="adm-lateral" aria-label="Menu do painel">
        <Marca />
        {menu}
        {rodape}
      </aside>
      <header className="adm-topo">
        <Marca />
        <button type="button" className="adm-botao" data-variante="fantasma" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
          {naoLidas > 0 && <span className="adm-nav-contador">{naoLidas}</span>}
        </button>
      </header>
      {menuAberto && (
        <div className="adm-gaveta-fundo" onMouseDown={(e) => e.target === e.currentTarget && setMenuAberto(false)}>
          <div className="adm-gaveta" role="dialog" aria-modal="true" aria-label="Menu do painel">
            <div className="flex items-center justify-between">
              <Marca />
              <button type="button" className="adm-botao" data-variante="escuro" onClick={() => setMenuAberto(false)} aria-label="Fechar menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {menu}
            {rodape}
          </div>
        </div>
      )}
      <main className="adm-conteudo">{children}</main>
      <Toasts />
    </div>
  );
}

/** Cabeçalho padrão de uma página do painel. */
export function CabecalhoAdm({ titulo, descricao, acoes }: { titulo: string; descricao?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="adm-pagina-cabeca">
      <div className="min-w-0">
        <h1 className="adm-pagina-titulo">{titulo}</h1>
        {descricao && <p className="adm-pagina-descricao">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}
