'use client';

// Taxas e comissões do programa de convites (/admin/afiliados/taxas): ligar/pausar, a % de 1 a 5 níveis (até 2
// casas, convertida em pontos-base), o teto diário por membro (ou sem teto), uma simulação ao vivo de uma venda,
// a última alteração e a confirmação antes de salvar. Valida com o MESMO schema do servidor (mesmas mensagens).
// Tudo em MOEDAS DO JOGO: a comissão é paga pelo jogo, o indicado não perde nada e nada pode ser sacado.
import { AdminConfigAfiliadosBody, type AdminListaAcoesDTO, type ConfigAfiliadosDTO } from '@galinheiro/api-contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowRight, Calculator, CircleCheck, History, Info, Infinity as SemLimite, Layers, Pause, Play, Plus, Power, RotateCcw, Save,
  ShieldCheck, Trash2, TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ErroApi, chamar } from '../../api';
import { Moeda } from '../../arte/Icones';
import { toast } from '../../ui';
import { CabecalhoAdm } from '../ShellAdmin';
import { BotaoAdm, Cartao, Carregando, ModalAdm, fmt, mensagemAdmin } from '../ui';
import { AcoesModal, Alerta, ErroModal, lerMoedas, useAgoraLento } from '../usuarios/comum';
import { CHAVE_AFILIADOS, Falha, FichasNiveis, SeloPrograma, TituloSecao, useCaminhoPainel, useConfigAfiliados, useResumoAfiliados } from './comum';
import {
  BP_MAX, CONFIG_PADRAO, NIVEIS_MAX, TETO_MAX_X100, bpParaTexto, lerConfig, lerPercentual, mudancasConfig, pct, quemRecebe, resumoConfig,
  simularVenda, vendaParaTeto,
} from './formato';


interface Rascunho {
  ativo: boolean;
  /** texto de cada campo de % (nível 1 primeiro) */
  niveis: string[];
  comTeto: boolean;
  /** texto do campo do teto, em moedas ("200,00") */
  teto: string;
}

interface Erros {
  niveis: (string | null)[];
  teto: string | null;
  geral: string | null;
}

const deConfig = (c: ConfigAfiliadosDTO): Rascunho => ({
  ativo: c.ativo,
  niveis: c.comissoesBp.map(bpParaTexto),
  comTeto: c.tetoDiarioX100 !== null,
  teto: fmt.moedas(c.tetoDiarioX100 ?? CONFIG_PADRAO.tetoDiarioX100 ?? 20_000),
});

/** Rascunho → corpo do PUT + erros, com as mensagens do servidor (o mesmo schema do contrato). */
function validar(r: Rascunho): { corpo: ConfigAfiliadosDTO; erros: Erros; ok: boolean } {
  const erros: Erros = {
    niveis: r.niveis.map((t) => {
      if (!t.trim()) return 'Informe a % deste nível (pode ser 0).';
      return lerPercentual(t) === null ? 'Use um número com até 2 casas decimais (ex.: 2,5).' : null;
    }),
    teto: null,
    geral: null,
  };
  let tetoX100: number | null = null;
  if (r.comTeto) {
    const v = lerMoedas(r.teto);
    if (v === null) erros.teto = 'Valor inválido. Use até 2 casas decimais (ex.: 200,00).';
    else if (v > TETO_MAX_X100) erros.teto = `Teto alto demais (máximo ${fmt.moedas(TETO_MAX_X100)} moedas por dia).`;
    else tetoX100 = v;
  }
  const corpo: ConfigAfiliadosDTO = { ativo: r.ativo, comissoesBp: r.niveis.map((t) => lerPercentual(t) ?? 0), tetoDiarioX100: tetoX100 };
  const v = AdminConfigAfiliadosBody.safeParse(corpo);
  if (!v.success) {
    for (const i of v.error.issues) {
      const [campo, indice] = i.path;
      if (campo === 'comissoesBp' && typeof indice === 'number') erros.niveis[indice] ??= i.message;
      else if (campo === 'tetoDiarioX100') erros.teto ??= i.message;
      else erros.geral ??= i.message;
    }
  }
  return { corpo, erros, ok: !erros.niveis.some(Boolean) && !erros.teto && !erros.geral };
}

/** Erros de validação vindos do servidor (PAYLOAD_INVALIDO) para os campos certos. */
function errosDoServidor(e: unknown): Erros | null {
  if (!(e instanceof ErroApi) || e.codigo !== 'PAYLOAD_INVALIDO' || !Array.isArray(e.detalhes?.issues)) return null;
  const erros: Erros = { niveis: [], teto: null, geral: null };
  for (const i of e.detalhes.issues as { caminho?: string; mensagem?: string }[]) {
    const [campo, indice] = (i.caminho ?? '').split('.');
    const msg = i.mensagem ?? 'Valor inválido.';
    if (campo === 'comissoesBp' && indice !== undefined && /^\d+$/.test(indice)) erros.niveis[Number(indice)] ??= msg;
    else if (campo === 'tetoDiarioX100') erros.teto ??= msg;
    else erros.geral ??= msg;
  }
  return erros;
}

// ---------------------------------------------------------------- simulação

function Simulacao({ novo, atual, valido }: { novo: ConfigAfiliadosDTO; atual: ConfigAfiliadosDTO; valido: boolean }) {
  const id = useId();
  const [venda, setVenda] = useState('100,00');
  const vendaX100 = lerMoedas(venda);
  const sim = simularVenda(novo.comissoesBp, vendaX100 ?? 0);
  const antes = simularVenda(atual.comissoesBp, vendaX100 ?? 0);
  const maior = Math.max(1, ...sim.linhas.map((l) => l.valorX100));
  const teto1 = vendaParaTeto(novo.tetoDiarioX100, novo.comissoesBp[0] ?? 0);
  return (
    <Cartao className="afi-simulacao" titulo={<TituloSecao Icone={Calculator} texto="Simulação" tom="azul" sub="ao vivo" />}>
      {!novo.ativo && (
        <p className="afi-sim-pausado">
          <Pause className="h-4 w-4 shrink-0" aria-hidden />
          Pausado: hoje esta venda não pagaria nada. Os valores abaixo valem quando o programa for ligado.
        </p>
      )}
      <label className="afi-sim-venda" htmlFor={id}>
        <span>Se um indicado vender</span>
        <span className="afi-sim-venda-campo">
          <Moeda className="h-5 w-5 shrink-0" />
          <input
            id={id}
            className="adm-input"
            type="text"
            inputMode="decimal"
            value={venda}
            maxLength={12}
            autoComplete="off"
            aria-invalid={vendaX100 === null || undefined}
            onChange={(e) => setVenda(e.target.value)}
            onBlur={() => vendaX100 !== null && setVenda(fmt.moedas(vendaX100))}
          />
        </span>
        <span>moedas em ovos:</span>
      </label>
      {vendaX100 === null ? (
        <p className="adm-campo-erro">Digite um valor de venda (ex.: 100,00).</p>
      ) : (
        <>
          <ul className="afi-sim-lista" aria-live="polite">
            {sim.linhas.map((l) => {
              const antigo = antes.linhas[l.nivel - 1];
              const mudou = !antigo || antigo.valorX100 !== l.valorX100;
              return (
                <li key={l.nivel} className="afi-sim-item" data-mudou={mudou || undefined}>
                  <div className="afi-sim-item-topo">
                    <span className="afi-sim-nivel">Nível {l.nivel}</span>
                    <span className="afi-sim-quem">{quemRecebe(l.nivel)}</span>
                    <span className="afi-sim-valor">
                      {valido ? (
                        <>
                          recebe <strong>{fmt.moedas(l.valorX100)}</strong>
                        </>
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>
                  <span className="afi-barra" data-tom="ambar" aria-hidden>
                    <span style={{ width: `${valido ? (l.valorX100 / maior) * 100 : 0}%` }} />
                  </span>
                  {mudou && valido && (
                    <span className="afi-sim-antes">{antigo ? `hoje: ${fmt.moedas(antigo.valorX100)}` : 'nível novo'}</span>
                  )}
                </li>
              );
            })}
            {antes.linhas.slice(sim.linhas.length).map((l) => (
              <li key={`r${l.nivel}`} className="afi-sim-item" data-removido>
                <div className="afi-sim-item-topo">
                  <span className="afi-sim-nivel">Nível {l.nivel}</span>
                  <span className="afi-sim-quem">removido</span>
                  <span className="afi-sim-valor">
                    deixa de receber <s>{fmt.moedas(l.valorX100)}</s>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {valido && (
            <>
              <div className="afi-sim-total">
                <p>
                  O jogo paga <strong>{fmt.moedas(sim.totalX100)}</strong> a mais — <strong>{pct(sim.totalBp)}</strong> sobre cada venda
                  {sim.totalBp !== antes.totalBp && (
                    <>
                      {' '}
                      <span className="afi-sim-antes">(hoje {pct(antes.totalBp)})</span>
                    </>
                  )}
                  .
                </p>
                <p className="afi-sim-sub">
                  Quem vendeu recebe os {fmt.moedas(vendaX100)} inteiros: a comissão sai do jogo, não do indicado. Com menos níveis
                  acima de quem vende, paga menos.
                </p>
              </div>
              <p className="afi-sim-teto">
                {novo.tetoDiarioX100 === null ? (
                  <>
                    <SemLimite className="h-4 w-4 shrink-0" aria-hidden />
                    <span>Sem teto: não há limite para o que um membro recebe por dia.</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
                    <span>
                      Teto de <strong>{fmt.moedas(novo.tetoDiarioX100)}</strong> por membro por dia
                      {teto1 !== null && (
                        <>
                          : só com o nível 1, isso exige que os indicados diretos vendam <strong>{fmt.moedas(teto1)}</strong> moedas no
                          mesmo dia
                        </>
                      )}
                      .
                    </span>
                  </>
                )}
              </p>
            </>
          )}
        </>
      )}
    </Cartao>
  );
}

// ---------------------------------------------------------------- última alteração

function UltimaAlteracao({ agora }: { agora: number }) {
  const resumo = useResumoAfiliados(30, 'rede');
  const auditoria = useQuery({
    queryKey: ['admin', 'auditoria', 'taxas'],
    queryFn: async ({ signal }) => (await chamar<AdminListaAcoesDTO>('GET', '/api/admin/auditoria?pagina=1&porPagina=100', { sinal: signal })).data,
    staleTime: 30_000,
  });
  const em = resumo.data?.configAtualizadaEm ?? null;
  const acoes = (auditoria.data?.itens ?? []).filter((a) => a.acao === 'configurar_afiliados');
  const ultima = acoes[0];
  // a ação da auditoria é a mesma alteração quando foi gravada junto (até 2 min de diferença)
  const mesma = ultima && em && Math.abs(Date.parse(ultima.criadoEm) - Date.parse(em)) < 120_000 ? ultima : undefined;
  const de = mesma ? lerConfig(mesma.detalhes.de) : null;
  const para = mesma ? lerConfig(mesma.detalhes.para) : null;
  const mudancas = de && para ? mudancasConfig(de, para) : [];
  return (
    <Cartao className="afi-ultima" titulo={<TituloSecao Icone={History} texto="Última alteração" tom="neutro" />}>
      {!em ? (
        resumo.isError ? (
          <p className="afi-texto-suave">Não deu para ver quando as taxas mudaram ({mensagemAdmin(resumo.error)}).</p>
        ) : (
          <Carregando texto="Conferindo…" />
        )
      ) : (
        <>
          <p className="afi-ultima-quando">
            <strong>{fmt.dataHora(em)}</strong> <span className="afi-texto-suave">({fmt.relativo(em, agora)})</span>
            {mesma && (
              <>
                {' '}
                por <strong>{mesma.adminNome ?? 'administrador removido'}</strong>
              </>
            )}
          </p>
          {mudancas.length > 0 && <p className="afi-ultima-mudou">{mudancas.join(' · ')}</p>}
          {!mesma && auditoria.data && <p className="afi-texto-suave">Sem registro desta alteração entre as últimas ações da auditoria.</p>}
          <Link href="/admin/auditoria" className="afi-link-seta">
            Ver na auditoria <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </>
      )}
    </Cartao>
  );
}

// ---------------------------------------------------------------- confirmação

function ModalConfirmar({ atual, novo, salvando, erro, aoConfirmar, aoFechar }: {
  atual: ConfigAfiliadosDTO;
  novo: ConfigAfiliadosDTO;
  salvando: boolean;
  erro: string | null;
  aoConfirmar: () => void;
  aoFechar: () => void;
}) {
  const mudancas = mudancasConfig(atual, novo);
  const antes = atual.comissoesBp.reduce((s, b) => s + b, 0);
  const depois = novo.comissoesBp.reduce((s, b) => s + b, 0);
  return (
    <ModalAdm aberto titulo="Salvar taxas e comissões?" aoFechar={aoFechar}>
      <div className="adm-us-form">
        <div>
          <p className="adm-campo-rotulo">O que muda</p>
          <ul className="adm-us-efeitos">
            {mudancas.map((m) => (
              <li key={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</li>
            ))}
          </ul>
        </div>
        <div className="afi-confirmar-novo">
          <p className="adm-campo-rotulo">Fica assim</p>
          <div className="afi-confirmar-linha">
            <SeloPrograma ativo={novo.ativo} />
            <FichasNiveis comissoesBp={novo.comissoesBp} pausado={!novo.ativo} />
          </div>
          <p className="afi-texto-suave">
            Teto: {novo.tetoDiarioX100 === null ? 'sem teto' : `${fmt.moedas(novo.tetoDiarioX100)} moedas por membro por dia`} ·{' '}
            {novo.ativo ? 'o jogo paga' : 'quando ligado, o jogo paga'} até {pct(depois)} a mais sobre cada venda
            {depois !== antes ? ` (hoje ${pct(antes)})` : ''}.
          </p>
        </div>
        {!novo.ativo && atual.ativo && (
          <Alerta tom="ambar" icone={<Pause className="h-4 w-4" />}>
            Com o programa pausado, ninguém recebe comissão até ele ser ligado de novo. A rede e o histórico continuam.
          </Alerta>
        )}
        {novo.ativo && depois > antes && (
          <Alerta tom="ambar" icone={<TriangleAlert className="h-4 w-4" />}>
            O jogo passa a pagar mais moedas a cada venda de ovos ({pct(antes)} → {pct(depois)}): mais moedas entram em circulação.
          </Alerta>
        )}
        <Alerta tom="azul" icone={<Info className="h-4 w-4" />}>
          Vale só para as vendas <strong>daqui em diante</strong>: o que já foi pago não muda. A alteração fica registrada na auditoria.
        </Alerta>
        <ErroModal texto={erro} />
        <AcoesModal>
          <BotaoAdm onClick={aoFechar} disabled={salvando}>
            Cancelar
          </BotaoAdm>
          <BotaoAdm variante="primario" onClick={aoConfirmar} disabled={salvando}>
            <Save className="h-4 w-4" aria-hidden />
            {salvando ? 'Salvando…' : 'Salvar taxas'}
          </BotaoAdm>
        </AcoesModal>
      </div>
    </ModalAdm>
  );
}

// ---------------------------------------------------------------- formulário

function Formulario({ base, recarregar }: { base: ConfigAfiliadosDTO; recarregar: () => void }) {
  const qc = useQueryClient();
  const idForm = useId();
  const [r, setR] = useState<Rascunho>(() => deConfig(base));
  const [baseUsada, setBaseUsada] = useState(base);
  const [tentou, setTentou] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const novoCampo = useRef<number | null>(null);
  const agora = useAgoraLento();

  const { corpo, erros: errosLocais, ok } = validar(r);
  // campos mexidos (texto) × valores que mudam de verdade (o que vai na auditoria)
  const sujo = JSON.stringify(deConfig(baseUsada)) !== JSON.stringify(r);
  const mudancas = ok ? mudancasConfig(baseUsada, corpo) : [];
  const configMudouFora = JSON.stringify(base) !== JSON.stringify(baseUsada);

  // taxas mudaram no servidor (outra aba/admin): sem edição em andamento, o formulário acompanha
  useEffect(() => {
    if (configMudouFora && !sujo) {
      setBaseUsada(base);
      setR(deConfig(base));
    }
  }, [base, configMudouFora, sujo]);

  // sair com alterações não salvas: o navegador pergunta
  useEffect(() => {
    if (!sujo) return;
    const aviso = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [sujo]);

  // foco no campo do nível recém-adicionado
  useEffect(() => {
    if (novoCampo.current === null) return;
    document.getElementById(`${idForm}-n${novoCampo.current}`)?.focus();
    novoCampo.current = null;
  }, [r.niveis.length, idForm]);

  const salvar = useMutation({
    mutationFn: async (c: ConfigAfiliadosDTO) => (await chamar<ConfigAfiliadosDTO>('PUT', '/api/admin/afiliados/config', { corpo: c })).data,
    onSuccess: async (salvo) => {
      qc.setQueryData([...CHAVE_AFILIADOS, 'config'], salvo);
      setBaseUsada(salvo);
      setR(deConfig(salvo));
      setTentou(false);
      setConfirmar(false);
      toast('Taxas salvas. Valem para as vendas daqui em diante.', 'sucesso');
      await Promise.all([
        qc.invalidateQueries({ queryKey: CHAVE_AFILIADOS }),
        qc.invalidateQueries({ queryKey: ['admin', 'auditoria'] }),
      ]);
    },
  });
  const errosServ = salvar.isError ? errosDoServidor(salvar.error) : null;
  const erroNivel = (i: number) => errosServ?.niveis[i] ?? (tentou || r.niveis[i]?.trim() ? errosLocais.niveis[i] : null) ?? null;
  const erroTeto = errosServ?.teto ?? (tentou || r.teto.trim() ? errosLocais.teto : null);
  const erroGeral = errosServ?.geral ?? (tentou ? errosLocais.geral : null);
  const erroModal = salvar.isError ? (errosServ ? (errosServ.geral ?? 'Confira os campos marcados.') : mensagemAdmin(salvar.error)) : null;

  const mexer = (f: (a: Rascunho) => Rascunho) => {
    setR(f);
    if (salvar.isError) salvar.reset();
  };
  const definirNivel = (i: number, texto: string) => mexer((a) => ({ ...a, niveis: a.niveis.map((t, j) => (j === i ? texto : t)) }));
  const adicionar = () => {
    if (r.niveis.length >= NIVEIS_MAX) return;
    novoCampo.current = r.niveis.length;
    mexer((a) => ({ ...a, niveis: [...a.niveis, ''] }));
  };
  const remover = () => mexer((a) => ({ ...a, niveis: a.niveis.slice(0, -1) }));
  const desfazer = () => {
    setR(deConfig(baseUsada));
    setTentou(false);
    salvar.reset();
  };
  const pedir = (e?: FormEvent) => {
    e?.preventDefault();
    setTentou(true);
    if (!ok) return;
    if (!mudancas.length) {
      toast('Nada mudou nos valores: as taxas em vigor continuam as mesmas.', 'info');
      return;
    }
    salvar.reset();
    setConfirmar(true);
  };

  const soma = corpo.comissoesBp.reduce((s, b) => s + b, 0);

  return (
    <>
      {configMudouFora && sujo && (
        <div className="afi-aviso-fora" role="alert">
          <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1">
            As taxas foram alteradas em outro lugar enquanto você editava (agora: {resumoConfig(base)}).
          </p>
          <BotaoAdm
            tamanho="p"
            onClick={() => {
              setBaseUsada(base);
              setR(deConfig(base));
              setTentou(false);
            }}
          >
            Usar as novas
          </BotaoAdm>
        </div>
      )}

      <form className="afi-taxas-grade" onSubmit={pedir} noValidate aria-describedby={`${idForm}-nota`}>
        <div className="afi-taxas-form">
          <Cartao titulo={<TituloSecao Icone={Power} texto="Programa" tom="verde" />}>
            <fieldset className="adm-us-opcoes">
              <legend className="sr-only">Situação do programa de convites</legend>
              <div className="adm-us-opcoes-grade" data-colunas="2">
                <label className="adm-us-opcao adm-us-opcao-linha">
                  <input type="radio" name={`${idForm}-ativo`} className="sr-only" checked={r.ativo} onChange={() => mexer((a) => ({ ...a, ativo: true }))} />
                  <Play className="adm-us-opcao-icone" aria-hidden />
                  <span className="min-w-0">
                    <span className="adm-us-opcao-nome">Ligado</span>
                    <span className="adm-us-opcao-sub">Cada venda de ovos de um indicado paga comissão a quem está acima.</span>
                  </span>
                </label>
                <label className="adm-us-opcao adm-us-opcao-linha afi-opcao-pausa">
                  <input type="radio" name={`${idForm}-ativo`} className="sr-only" checked={!r.ativo} onChange={() => mexer((a) => ({ ...a, ativo: false }))} />
                  <Pause className="adm-us-opcao-icone" aria-hidden />
                  <span className="min-w-0">
                    <span className="adm-us-opcao-nome">Pausado</span>
                    <span className="adm-us-opcao-sub">Ninguém recebe comissão. A rede e o histórico continuam.</span>
                  </span>
                </label>
              </div>
            </fieldset>
          </Cartao>

          <Cartao
            titulo={<TituloSecao Icone={Layers} texto="Comissão por nível" tom="roxo" sub={`${r.niveis.length} de ${NIVEIS_MAX} níveis`} />}
            acoes={<span className="afi-soma" title="Soma das % de todos os níveis">soma {ok || errosLocais.niveis.every((e) => !e) ? pct(soma) : '—'}</span>}
          >
            <p className="afi-texto-suave afi-explica">
              Sobre cada venda de ovos de um membro, o jogo paga a cada nível acima dele a sua %. Nível 1 = quem convidou quem vendeu;
              nível 2 = quem convidou o nível 1; e assim por diante.
            </p>
            <ol className="afi-campos-niveis">
              {r.niveis.map((t, i) => {
                const erro = erroNivel(i);
                const campoId = `${idForm}-n${i}`;
                const ultimo = i === r.niveis.length - 1 && r.niveis.length > 1;
                return (
                  <li key={i} className="afi-campo-nivel" data-erro={erro ? true : undefined}>
                    <span className="afi-campo-nivel-n" aria-hidden>
                      {i + 1}
                    </span>
                    <label className="afi-campo-nivel-texto" htmlFor={campoId}>
                      <span className="afi-campo-nivel-nome">Nível {i + 1}</span>
                      <span className="afi-campo-nivel-sub">{quemRecebe(i + 1)}</span>
                    </label>
                    <span className="afi-campo-pct">
                      <input
                        id={campoId}
                        className="adm-input"
                        type="text"
                        inputMode="decimal"
                        value={t}
                        maxLength={6}
                        placeholder="0"
                        autoComplete="off"
                        aria-invalid={erro ? true : undefined}
                        aria-describedby={erro ? `${campoId}-erro` : undefined}
                        onChange={(e) => definirNivel(i, e.target.value)}
                        onBlur={() => {
                          const bp = lerPercentual(t);
                          if (bp !== null && bp >= 0 && bp <= BP_MAX) definirNivel(i, bpParaTexto(bp));
                        }}
                      />
                      <span aria-hidden>%</span>
                    </span>
                    {ultimo ? (
                      <button type="button" className="afi-remover" onClick={remover} aria-label={`Remover o nível ${i + 1}`} title={`Remover o nível ${i + 1}`}>
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    ) : (
                      <span className="afi-remover-vago" aria-hidden />
                    )}
                    {erro && (
                      <p id={`${campoId}-erro`} className="adm-campo-erro afi-campo-nivel-erro">
                        {erro}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="afi-niveis-acoes">
              <BotaoAdm tamanho="p" onClick={adicionar} disabled={r.niveis.length >= NIVEIS_MAX}>
                <Plus className="h-4 w-4" aria-hidden />
                {r.niveis.length >= NIVEIS_MAX ? `Máximo de ${NIVEIS_MAX} níveis` : `Adicionar nível ${r.niveis.length + 1}`}
              </BotaoAdm>
              <span className="adm-campo-dica">Até 50% por nível, com até 2 casas decimais (ex.: 2,5). 0% deixa o nível sem pagar.</span>
            </div>
            {erroGeral && <p className="adm-campo-erro mt-2">{erroGeral}</p>}
          </Cartao>

          <Cartao titulo={<TituloSecao Icone={ShieldCheck} texto="Teto diário por membro" tom="ambar" />}>
            <fieldset className="adm-us-opcoes">
              <legend className="sr-only">Limite de comissões por dia</legend>
              <div className="adm-us-opcoes-grade" data-colunas="2">
                <label className="adm-us-opcao adm-us-opcao-linha">
                  <input type="radio" name={`${idForm}-teto`} className="sr-only" checked={r.comTeto} onChange={() => mexer((a) => ({ ...a, comTeto: true }))} />
                  <ShieldCheck className="adm-us-opcao-icone" aria-hidden />
                  <span className="min-w-0">
                    <span className="adm-us-opcao-nome">Com teto</span>
                    <span className="adm-us-opcao-sub">Cada membro recebe no máximo um valor por dia.</span>
                  </span>
                </label>
                <label className="adm-us-opcao adm-us-opcao-linha">
                  <input type="radio" name={`${idForm}-teto`} className="sr-only" checked={!r.comTeto} onChange={() => mexer((a) => ({ ...a, comTeto: false }))} />
                  <SemLimite className="adm-us-opcao-icone" aria-hidden />
                  <span className="min-w-0">
                    <span className="adm-us-opcao-nome">Sem teto</span>
                    <span className="adm-us-opcao-sub">Não há limite para o que um membro recebe.</span>
                  </span>
                </label>
              </div>
            </fieldset>
            {r.comTeto && (
              <label className="adm-campo afi-campo-teto">
                <span className="adm-campo-rotulo">Teto por membro (moedas por dia)</span>
                <span className="adm-us-campo-moeda">
                  <Moeda className="adm-us-campo-moeda-icone" />
                  <input
                    className="adm-input"
                    type="text"
                    inputMode="decimal"
                    value={r.teto}
                    maxLength={14}
                    autoComplete="off"
                    aria-invalid={erroTeto ? true : undefined}
                    onChange={(e) => mexer((a) => ({ ...a, teto: e.target.value }))}
                    onBlur={() => {
                      const v = lerMoedas(r.teto);
                      if (v !== null) mexer((a) => ({ ...a, teto: fmt.moedas(v) }));
                    }}
                  />
                </span>
                {erroTeto ? (
                  <span className="adm-campo-erro">{erroTeto}</span>
                ) : (
                  <span className="adm-campo-dica">Mínimo 1,00. Ao bater o teto, o membro para de receber comissões até a meia-noite (horário de Brasília).</span>
                )}
              </label>
            )}
          </Cartao>

          <div id={`${idForm}-nota`} className="afi-avisos">
            <p>
              <Info className="h-4 w-4 shrink-0" aria-hidden />
              <span>
                Vale só para as vendas <strong>daqui em diante</strong>: o que já foi pago não muda.
              </span>
            </p>
            <p>
              <Moeda className="h-4 w-4 shrink-0" />
              <span>Comissões são pagas pelo jogo em moedas do jogo; o indicado não perde nada e nada pode ser sacado.</span>
            </p>
          </div>
        </div>

        <aside className="afi-taxas-lado" aria-label="Simulação e histórico">
          <Simulacao novo={corpo} atual={baseUsada} valido={ok} />
          <UltimaAlteracao agora={agora} />
        </aside>

        <div className="afi-salvar" data-sujo={sujo || undefined} role="region" aria-label="Salvar alterações">
          <div className="min-w-0 flex-1">
            {sujo && !ok ? (
              <>
                <p className="afi-salvar-titulo">Alterações não salvas</p>
                <p className="afi-salvar-detalhe" data-erro>
                  Corrija os campos marcados para poder salvar.
                </p>
              </>
            ) : mudancas.length ? (
              <>
                <p className="afi-salvar-titulo">
                  {mudancas.length} {mudancas.length === 1 ? 'alteração não salva' : 'alterações não salvas'}
                </p>
                <p className="afi-salvar-detalhe">{mudancas.join(' · ')}</p>
              </>
            ) : (
              <p className="afi-salvar-ok">
                <CircleCheck className="h-4 w-4 shrink-0" aria-hidden /> Sem alterações: estas são as taxas em vigor.
              </p>
            )}
          </div>
          <div className="afi-salvar-botoes">
            <BotaoAdm onClick={desfazer} disabled={!sujo || salvar.isPending}>
              <RotateCcw className="h-4 w-4" aria-hidden /> Desfazer
            </BotaoAdm>
            <BotaoAdm type="submit" variante="primario" disabled={!sujo || salvar.isPending}>
              <Save className="h-4 w-4" aria-hidden /> Salvar alterações
            </BotaoAdm>
          </div>
        </div>
      </form>

      {confirmar && (
        <ModalConfirmar
          atual={baseUsada}
          novo={corpo}
          salvando={salvar.isPending}
          erro={erroModal}
          aoConfirmar={() => {
            if (ok) salvar.mutate(corpo);
          }}
          aoFechar={() => {
            if (salvar.isPending) return;
            setConfirmar(false);
            if (salvar.isError) recarregar();
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------- tela

export function TelaTaxas() {
  const voltar = useCaminhoPainel();
  const config = useConfigAfiliados();
  return (
    <div className="afi-taxas">
      <div className="adm-us-voltar-barra">
        <Link href={voltar} className="adm-us-voltar">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Rede de afiliados
        </Link>
      </div>
      <CabecalhoAdm
        titulo="Taxas e comissões"
        descricao="Quanto o jogo paga, em moedas do jogo, a quem convidou — sobre cada venda de ovos dos indicados."
      />
      {config.data ? (
        <Formulario base={config.data} recarregar={() => void config.refetch()} />
      ) : config.isError ? (
        <Falha erro={config.error} tentar={() => void config.refetch()} titulo="Não deu para carregar as taxas." />
      ) : (
        <Cartao>
          <Carregando texto="Carregando as taxas…" />
        </Cartao>
      )}
    </div>
  );
}

