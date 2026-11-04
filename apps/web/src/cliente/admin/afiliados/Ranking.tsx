'use client';

// Rede de afiliados (painel): ranking dos 20 primeiros (por tamanho da rede, indicados diretos ou comissões do
// período) com link para a rede de cada um — tabela no desktop, cartões no celular — e as comissões do período
// por nível. Tudo em moedas do jogo.
import type { AdminAfiliadosDTO } from '@galinheiro/api-contract';
import { ChevronRight, Layers, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MouseEvent } from 'react';
import { Moeda } from '../../arte/Icones';
import { cx } from '../../util';
import { Cartao, Vazio, fmt } from '../ui';
import { Avatar, plural } from '../usuarios/comum';
import { ORDENS, Segmentado, TituloSecao, type Ordem } from './comum';
import { pct, quemRecebe } from './formato';

function Posicao({ n }: { n: number }) {
  return (
    <span className="afi-posicao" data-pos={n <= 3 ? n : undefined} aria-label={`${n}º lugar`}>
      {n}
    </span>
  );
}

export function Ranking({ r, ordenar, aoOrdenar, dias }: {
  r: AdminAfiliadosDTO;
  ordenar: Ordem;
  aoOrdenar: (o: Ordem) => void;
  dias: number;
}) {
  const router = useRouter();
  const lista = r.ranking;
  const abrir = (e: MouseEvent, id: string) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    if (window.getSelection()?.toString()) return; // estava selecionando texto (ex.: copiar o e-mail)
    if (e.ctrlKey || e.metaKey) window.open(`/admin/afiliados/${id}`, '_blank');
    else router.push(`/admin/afiliados/${id}`);
  };
  const ativa = (o: Ordem) => (ordenar === o ? 'true' : undefined);

  return (
    <Cartao
      className="afi-ranking"
      titulo={<TituloSecao Icone={Trophy} texto="Ranking" tom="ambar" sub={lista.length ? `os ${lista.length} primeiros` : undefined} />}
      acoes={<Segmentado rotulo="Ordenar por" opcoes={ORDENS} valor={ordenar} aoMudar={aoOrdenar} className="afi-seg-compacto" />}
    >
      {!lista.length ? (
        <Vazio titulo="Ninguém convidou ninguém ainda">
          Quando um membro trouxer alguém pelo link de convite (ou receber comissão), ele aparece aqui.
        </Vazio>
      ) : (
        <>
          {/* desktop: tabela */}
          <div className="afi-ranking-tabela">
            <table className="adm-tabela">
              <caption className="sr-only">
                Ranking de afiliados por {ORDENS.find((o) => o.valor === ordenar)?.dica.toLowerCase()}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="afi-col-pos">
                    #
                  </th>
                  <th scope="col">Membro</th>
                  <th scope="col" className="afi-col-codigo">
                    Código
                  </th>
                  <th scope="col" className="num" data-ordem={ativa('diretos')}>
                    Diretos
                  </th>
                  <th scope="col" className="num" data-ordem={ativa('rede')}>
                    Rede
                  </th>
                  <th scope="col" className="num" data-ordem={ativa('comissoes')}>
                    {dias} dias
                  </th>
                  <th scope="col" className="num">
                    Total
                  </th>
                  <th scope="col">
                    <span className="sr-only">Abrir</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map((l, i) => (
                  <tr key={l.id} className="afi-linha" onClick={(e) => abrir(e, l.id)}>
                    <td className="afi-col-pos">
                      <Posicao n={i + 1} />
                    </td>
                    <td>
                      <div className="adm-us-membro">
                        <Avatar id={l.id} nome={l.nome} tamanho="p" />
                        <div className="min-w-0">
                          <Link href={`/admin/afiliados/${l.id}`} className="adm-us-nome">
                            {l.nome}
                          </Link>
                          <p className="adm-us-email">
                            {l.email}
                            {l.codigo && <span className="afi-codigo-junto"> · {l.codigo}</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="afi-col-codigo">
                      {l.codigo ? <code className="afi-codigo-mini">{l.codigo}</code> : <span className="afi-zero">—</span>}
                    </td>
                    <td className="num" data-ordem={ativa('diretos')}>
                      {fmt.int(l.diretos)}
                    </td>
                    <td className="num" data-ordem={ativa('rede')}>
                      {fmt.int(l.rede)}
                    </td>
                    <td className="num" data-ordem={ativa('comissoes')}>
                      <span className={cx('afi-moedas', l.comissoesPeriodoX100 === 0 && 'afi-zero')}>{fmt.moedas(l.comissoesPeriodoX100)}</span>
                    </td>
                    <td className="num">
                      <span className={cx('afi-moedas', l.comissoesTotalX100 === 0 && 'afi-zero')}>{fmt.moedas(l.comissoesTotalX100)}</span>
                    </td>
                    <td className="afi-col-ir">
                      <Link href={`/admin/afiliados/${l.id}`} className="afi-ir" aria-label={`Ver a rede de ${l.nome}`} title={`Ver a rede de ${l.nome}`}>
                        <span className="afi-ir-texto">Ver rede</span> <ChevronRight className="h-4 w-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* celular: cartões */}
          <ol className="afi-ranking-cartoes">
            {lista.map((l, i) => (
              <li key={l.id}>
                <Link href={`/admin/afiliados/${l.id}`} className="afi-cartao-membro">
                  <div className="afi-cartao-membro-topo">
                    <Posicao n={i + 1} />
                    <Avatar id={l.id} nome={l.nome} tamanho="p" />
                    <div className="min-w-0 flex-1">
                      <p className="adm-us-nome">{l.nome}</p>
                      <p className="adm-us-email">{l.email}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                  </div>
                  <dl className="afi-cartao-numeros">
                    <div data-ordem={ativa('diretos')}>
                      <dt>Diretos</dt>
                      <dd>{fmt.int(l.diretos)}</dd>
                    </div>
                    <div data-ordem={ativa('rede')}>
                      <dt>Rede</dt>
                      <dd>{fmt.int(l.rede)}</dd>
                    </div>
                    <div data-ordem={ativa('comissoes')}>
                      <dt>{dias} dias</dt>
                      <dd>{fmt.moedas(l.comissoesPeriodoX100)}</dd>
                    </div>
                    <div>
                      <dt>Total</dt>
                      <dd>{fmt.moedas(l.comissoesTotalX100)}</dd>
                    </div>
                  </dl>
                </Link>
              </li>
            ))}
          </ol>
          <p className="afi-nota">
            <Moeda className="h-4 w-4 shrink-0" /> Comissões em moedas do jogo. “Rede” conta os membros abaixo até o 5º nível.
          </p>
        </>
      )}
    </Cartao>
  );
}

export function ComissoesPorNivel({ r, dias }: { r: AdminAfiliadosDTO; dias: number }) {
  const bp = r.config.comissoesBp;
  const porNivel = new Map(r.porNivel.map((p) => [p.nivel, p]));
  const n = Math.max(bp.length, ...r.porNivel.map((p) => p.nivel));
  const niveis = Array.from({ length: n }, (_, i) => i + 1);
  const maior = Math.max(1, ...r.porNivel.map((p) => p.valorX100));
  const total = r.porNivel.reduce((s, p) => s + p.valorX100, 0);
  return (
    <Cartao
      className="afi-por-nivel"
      titulo={<TituloSecao Icone={Layers} texto="Comissões por nível" tom="roxo" sub={`últimos ${dias} dias`} />}
    >
      <ul className="afi-niveis">
        {niveis.map((nivel) => {
          const p = porNivel.get(nivel);
          const taxa = bp[nivel - 1];
          const valor = p?.valorX100 ?? 0;
          return (
            <li key={nivel} className="afi-nivel" data-desligado={taxa === undefined || undefined}>
              <div className="afi-nivel-topo">
                <span className="afi-nivel-nome">Nível {nivel}</span>
                <span className="afi-nivel-pct" title={taxa === undefined ? 'Este nível não paga mais comissão' : `Taxa atual: ${pct(taxa)}`}>
                  {taxa === undefined ? 'desligado' : pct(taxa)}
                </span>
                <span className={cx('afi-nivel-valor', valor === 0 && 'afi-zero')}>{fmt.moedas(valor)}</span>
              </div>
              <span className="afi-barra" data-tom="ambar" aria-hidden>
                <span style={{ width: `${(valor / maior) * 100}%` }} />
              </span>
              <p className="afi-nivel-sub">
                <span>{quemRecebe(nivel)}</span>
                <span>{p ? plural(p.beneficiarios, 'beneficiário', 'beneficiários') : 'ninguém recebeu'}</span>
              </p>
            </li>
          );
        })}
      </ul>
      <p className="afi-nivel-total">
        <span>Total no período</span>
        <strong>
          {fmt.moedas(total)} <span>moedas</span>
        </strong>
      </p>
    </Cartao>
  );
}
