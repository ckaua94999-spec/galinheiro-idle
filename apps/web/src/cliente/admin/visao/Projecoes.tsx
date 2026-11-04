'use client';

// Cartões-resumo das projeções (pessoas, ovos e moedas) em texto, cada um com uma nota de como é calculado.
import type { AdminGraficosDTO } from '@galinheiro/api-contract';
import { Coins, Egg, Info, Users, type LucideIcon } from 'lucide-react';
import { useId, useMemo, type ReactNode } from 'react';
import { Selo, fmt } from '../ui';
import { resumirProjecoes } from './series';

/** "+188" / "−12" / "estável" */
function variacao(n: number, formato: (v: number) => string): string {
  if (Math.abs(n) < 0.5) return 'estável';
  return n > 0 ? `+${formato(n)}` : `−${formato(-n)}`;
}

function CartaoProjecao({ Icone, tom, titulo, quando, children, nota }: {
  Icone: LucideIcon;
  tom: string;
  titulo: string;
  quando: string;
  children: ReactNode;
  nota: ReactNode;
}) {
  const id = useId();
  return (
    <article className="vg-proj-cartao" aria-labelledby={id}>
      <header className="vg-proj-cabeca">
        <span className="vg-secao-icone" data-tom={tom} aria-hidden>
          <Icone className="h-4 w-4" />
        </span>
        <h3 id={id} className="vg-proj-titulo">
          {titulo}
        </h3>
        <span className="vg-proj-quando">{quando}</span>
      </header>
      <div className="vg-proj-corpo">{children}</div>
      <p className="vg-proj-nota">
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{nota}</span>
      </p>
    </article>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="vg-proj-dado">
      <dt>{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function CartoesProjecao({ g }: { g: AdminGraficosDTO }) {
  const r = useMemo(() => resumirProjecoes(g), [g]);
  // o período vem dos próprios dados (enquanto o novo carrega, os textos seguem os números na tela)
  const historico = g.pessoas.novos.length;
  const horizonte = g.pessoas.projecaoTotal.length;
  const janela = Math.min(historico, 28);
  const quando = `em ${horizonte} dias${r.ate ? ` · ${fmt.diaCurto(r.ate)}` : ''}`;
  const { pessoas: p, ovos: o, moedas: m } = r;
  const dPessoas = p.fim ? p.fim.valor - p.hoje : 0;
  const dMoedas = m.fim ? m.fim.valor - m.hoje : 0;

  return (
    <div className="vg-proj">
      <CartaoProjecao
        Icone={Users}
        tom="verde"
        titulo="Pessoas"
        quando={quando}
        nota={`Tendência linear dos cadastros por dia (últimos ${janela} dias) somada ao total de hoje. A faixa cobre ~95% da variação observada.`}
      >
        <p className="vg-proj-rotulo">Membros previstos</p>
        <p className="vg-proj-numero">
          ~{fmt.int(p.fim?.valor ?? p.hoje)} <span className="vg-proj-unidade">membros</span>
          <Selo tom={dPessoas < -0.5 ? 'vermelho' : dPessoas > 0.5 ? 'verde' : 'neutro'}>{variacao(dPessoas, fmt.int)}</Selo>
        </p>
        <dl className="vg-proj-dados">
          <Dado rotulo="Hoje">{fmt.int(p.hoje)} membros</Dado>
          {p.fim && (
            <Dado rotulo="Faixa provável">
              {fmt.int(p.fim.min)} a {fmt.int(p.fim.max)}
            </Dado>
          )}
          {p.ativosFim && (
            <Dado rotulo="Ativos por dia">
              ~{fmt.int(p.ativosFim.valor)} <span className="vg-proj-hoje">(hoje {fmt.int(p.ativosHoje)})</span>
            </Dado>
          )}
        </dl>
      </CartaoProjecao>

      <CartaoProjecao
        Icone={Egg}
        tom="ambar"
        titulo="Ovos"
        quando={quando}
        nota={`Tendência linear dos ovos produzidos por dia (últimos ${janela} dias). Potencial: o que os animais ativos hoje botariam com toda coleta feita na hora, sem animais novos. Aproveitamento: últimos 7 dias ÷ potencial.`}
      >
        <p className="vg-proj-rotulo">Ovos por dia previstos</p>
        <p className="vg-proj-numero">
          ~{fmt.int(o.fim?.valor ?? 0)} <span className="vg-proj-unidade">por dia</span>
        </p>
        <dl className="vg-proj-dados">
          {o.potencialFim !== null && <Dado rotulo="Potencial nesse dia">{fmt.int(o.potencialFim)} ovos</Dado>}
          <Dado rotulo={`Nos próximos ${horizonte} dias`}>
            ~{fmt.int(o.somaTendencia)} <span className="vg-proj-hoje">(potencial {fmt.int(o.somaPotencial)})</span>
          </Dado>
          {o.aproveitamento !== null && (
            <Dado rotulo="Aproveitamento recente">
              ~{fmt.int(Math.min(o.aproveitamento, 9.99) * 100)}% <span className="vg-proj-hoje">do potencial</span>
            </Dado>
          )}
        </dl>
      </CartaoProjecao>

      <CartaoProjecao
        Icone={Coins}
        tom="azul"
        titulo="Moedas"
        quando={quando}
        nota={`Saldo de hoje + tendência das emitidas − tendência das gastas (linear, últimos ${janela} dias); um pico isolado, como um ajuste manual grande, puxa a tendência. Emissão potencial: média da próxima semana vendendo todo ovo possível.`}
      >
        <p className="vg-proj-rotulo">Moedas em circulação previstas</p>
        <p className="vg-proj-numero">
          {fmt.moedas(m.fim?.valor ?? m.hoje)}
          <Selo tom="neutro">{variacao(dMoedas, fmt.moedas)}</Selo>
        </p>
        <dl className="vg-proj-dados">
          <Dado rotulo="Hoje">{fmt.moedas(m.hoje)}</Dado>
          {m.fim && (
            <Dado rotulo="Faixa provável">
              {fmt.moedas(m.fim.min)} a {fmt.moedas(m.fim.max)}
            </Dado>
          )}
          <Dado rotulo="Emissão potencial por dia">~{fmt.moedas(m.potencialSemanaX100)}</Dado>
        </dl>
      </CartaoProjecao>
    </div>
  );
}
