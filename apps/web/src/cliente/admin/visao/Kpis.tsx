'use client';

// Grade de KPIs da visão geral: os números de agora (GET /api/admin/resumo), com atalhos para o atendimento
// e os popups.
import type { AdminResumoDTO } from '@galinheiro/api-contract';
import { Activity, ArrowRight, Bird, Coins, Egg, FerrisWheel, Megaphone, MessagesSquare, Users } from 'lucide-react';
import Link from 'next/link';
import { Kpi, fmt } from '../ui';

const ICONE = 'h-[18px] w-[18px]';
const ESPECIES = [
  ['galinha', 'Galinhas'],
  ['pato', 'Patos'],
  ['ganso', 'Gansos'],
  ['avestruz', 'Avestruzes'],
] as const;

const plural = (n: number, um: string, varios: string) => `${fmt.int(n)} ${n === 1 ? um : varios}`;

function Atalho({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="vg-kpi-link">
      {children}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );
}

export function GradeKpis({ r }: { r: AdminResumoDTO }) {
  const { pessoas: p, economia: e, suporte: s } = r;
  const animais = ESPECIES.reduce((t, [k]) => t + e.animaisAtivos[k], 0);
  return (
    <div className="vg-kpis">
      <Kpi
        rotulo="Membros"
        valor={fmt.int(p.membros)}
        tom="verde"
        icone={<Users className={ICONE} />}
        detalhe={
          <>
            <span className="vg-kpi-linha">
              <span className="vg-nw">
                <strong>+{fmt.int(p.novosHoje)}</strong> hoje
              </span>{' '}
              ·{' '}
              <span className="vg-nw">
                <strong>+{fmt.int(p.novos7d)}</strong> em 7 dias
              </span>
            </span>
            <span className="vg-kpi-linha">
              <span className="vg-nw">{plural(p.admins, 'admin', 'admins')}</span> ·{' '}
              <span className="vg-nw">{plural(p.bloqueados, 'bloqueado', 'bloqueados')}</span>
            </span>
          </>
        }
      />
      <Kpi
        rotulo="Ativos hoje"
        valor={fmt.int(p.ativosHoje)}
        tom="azul"
        icone={<Activity className={ICONE} />}
        detalhe={
          <>
            <span className="vg-kpi-linha">
              <strong>{fmt.int(p.ativos7d)}</strong> nos últimos 7 dias
            </span>
            <span className="vg-kpi-linha">
              <strong>{fmt.int(p.ativos30d)}</strong> nos últimos 30 dias
            </span>
          </>
        }
      />
      <Kpi
        rotulo="Moedas em circulação"
        valor={fmt.moedas(e.moedasCirculacaoX100)}
        tom="ambar"
        icone={<Coins className={ICONE} />}
        detalhe={
          <>
            <span className="vg-kpi-linha">
              <span className="vg-nw">
                <strong>+{fmt.moedas(e.emitidasHojeX100)}</strong> emitidas
              </span>{' '}
              hoje
            </span>
            <span className="vg-kpi-linha">
              <span className="vg-nw">
                <strong>−{fmt.moedas(e.gastasHojeX100)}</strong> gastas
              </span>{' '}
              hoje
            </span>
          </>
        }
      />
      <Kpi
        rotulo="Ovos em estoque"
        valor={fmt.int(e.ovosEstoque)}
        tom="ambar"
        icone={<Egg className={ICONE} />}
        detalhe={
          <span className="vg-kpi-linha">
            <strong>{fmt.int(e.ovosColetadosHoje)}</strong> coletados hoje
          </span>
        }
      />
      <Kpi
        rotulo="Animais ativos"
        valor={fmt.int(animais)}
        tom="verde"
        icone={<Bird className={ICONE} />}
        detalhe={
          <span className="vg-especies">
            {ESPECIES.map(([k, nome]) => (
              <span key={k} className="vg-especie">
                <span>{nome}</span>
                <strong>{fmt.int(e.animaisAtivos[k])}</strong>
              </span>
            ))}
          </span>
        }
      />
      <Kpi
        rotulo="Giros hoje"
        valor={fmt.int(e.girosHoje)}
        tom="roxo"
        icone={<FerrisWheel className={ICONE} />}
        detalhe={<span className="vg-kpi-linha">giros na roleta desde 0h</span>}
      />
      <Kpi
        rotulo="Atendimento"
        valor={
          <>
            {fmt.int(s.abertas)} <span className="vg-kpi-unidade">{s.abertas === 1 ? 'aberta' : 'abertas'}</span>
          </>
        }
        tom={s.naoLidas > 0 ? 'vermelho' : 'neutro'}
        icone={<MessagesSquare className={ICONE} />}
        detalhe={
          <>
            <span className="vg-kpi-linha">
              <strong>{fmt.int(s.naoLidas)}</strong> {s.naoLidas === 1 ? 'mensagem não lida' : 'mensagens não lidas'}
            </span>
            <Atalho href="/admin/atendimento">Abrir atendimento</Atalho>
          </>
        }
      />
      <Kpi
        rotulo="Popups ativos"
        valor={fmt.int(r.popupsAtivos)}
        tom="azul"
        icone={<Megaphone className={ICONE} />}
        detalhe={
          <>
            <span className="vg-kpi-linha">{r.popupsAtivos ? 'no ar agora para os jogadores' : 'nenhum no ar agora'}</span>
            <Atalho href="/admin/popups">Gerenciar popups</Atalho>
          </>
        }
      />
    </div>
  );
}
