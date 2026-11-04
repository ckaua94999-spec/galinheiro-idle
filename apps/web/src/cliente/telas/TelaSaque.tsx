'use client';

// Saque PIX: o CPF digitado é a chave. 1,00 moeda = R$ 1,00. A LofyPay envia e avisa quando liquidar.
import { cpfValido, digitosCpf, formatarCpf, type ListaSaquesDTO, type SaqueCriadoDTO, type SaqueDTO, type StatusSaque } from '@galinheiro/api-contract';
import { CONFIG, liquidoSaqueCentavos, taxaSaqueCentavos } from '@galinheiro/game-core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { chamar } from '../api';
import { Moeda } from '../arte/Icones';
import { aplicarNoEstado, useEstado } from '../estado';
import { toast } from '../ui';
import { mensagemDeErro, moedas } from '../util';

const ROTULO: Record<StatusSaque, string> = {
  processando: 'Em processamento',
  pago: 'Pago',
  falhou: 'Não concluído',
};

function centavosDe(texto: string): number | null {
  const t = texto.trim().replace(/\s/g, '');
  if (!t) return null;
  let normal = t;
  if (t.includes(',')) normal = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) normal = t.replace(/\./g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return null;
  const [inteiro, frac = ''] = normal.split('.');
  const centavos = Number(inteiro) * 100 + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(centavos) ? centavos : null;
}

export function TelaSaque() {
  const qc = useQueryClient();
  const { data: estado } = useEstado();
  const lista = useQuery({
    queryKey: ['saques'],
    queryFn: async () => (await chamar<ListaSaquesDTO>('GET', '/saques')).data,
  });
  const saldo = estado?.player.moedasX100 ?? 0;
  const minimo = lista.data?.minimoCentavos ?? 625;
  const disponivel = lista.data?.disponivelCentavos ?? saldo;
  const bonusBloqueado = lista.data?.bonusBloqueadoCentavos ?? 0;
  const rendimentosBloqueados = lista.data?.rendimentosBloqueadosCentavos ?? 0;
  const carencia = lista.data?.carenciaRendimento ?? false;
  const bonus = lista.data?.bonusCentavos ?? CONFIG.moedasIniciaisX100;
  const baseDaTaxa = Math.min(bonus, disponivel);
  const taxaFixa = lista.data?.taxaFixaCentavos ?? CONFIG.saque.taxaFixaX100;
  const taxaBp = lista.data?.taxaPercentualBp ?? CONFIG.saque.taxaPercentualBp;
  const [cpf, setCpf] = useState('');
  const [nome, setNome] = useState(estado?.conta.nome ?? '');
  const [valor, setValor] = useState('');
  const [nomeEditado, setNomeEditado] = useState(false);
  const nomeExibido = nomeEditado ? nome : nome || estado?.conta.nome || '';

  const enviar = useMutation({
    mutationFn: (corpo: { centavos: number; cpf: string; nome: string }) =>
      chamar<SaqueCriadoDTO>('POST', '/saques', { corpo, idempotente: true }),
    onSuccess: (r) => {
      aplicarNoEstado(qc, r, (e) => ({ ...e, player: { ...e.player, moedasX100: r.data.saldoX100 } }));
      void qc.invalidateQueries({ queryKey: ['extrato'] });
      void qc.invalidateQueries({ queryKey: ['saques'] });
      setValor('');
      toast(`Saque solicitado. Cai no PIX R$ ${moedas(r.data.saque.liquidoCentavos)}.`, 'sucesso');
    },
    onError: (erro) => toast(mensagemDeErro(erro), 'erro'),
  });

  const centavos = centavosDe(valor);
  const taxa = centavos === null ? 0 : taxaSaqueCentavos(centavos);
  const liquido = centavos === null ? 0 : liquidoSaqueCentavos(centavos);
  const percentual = taxa - taxaFixa;
  const cpfOk = cpfValido(cpf);
  const aberto = lista.data?.itens.some((s) => s.status === 'processando') ?? false;
  const pode = !aberto && !!centavos && centavos >= minimo && liquido >= 100 && centavos <= disponivel && cpfOk && nomeExibido.trim().length >= 3 && !enviar.isPending;

  const pedir = () => {
    if (!pode || centavos === null) return;
    void enviar.mutate({ centavos, cpf: digitosCpf(cpf), nome: nomeExibido.trim() });
  };

  return (
    <div className="tela saque-tela">
      <div className="tela-cabeca">
        <Link href="/extrato" className="botao botao-icone botao-secundario tela-cabeca-voltar" aria-label="Voltar para o extrato">
          <ChevronLeft strokeWidth={3} />
        </Link>
        <h1 className="titulo-tela">Sacar</h1>
      </div>

      <div className="painel-madeira extrato-saldo">
        <Moeda className="extrato-saldo-moeda" />
        <div className="relative min-w-0">
          <p className="extrato-saldo-rotulo">Disponível para saque</p>
          <p className="extrato-saldo-valor texto-contorno numeros">R$ {moedas(disponivel)}</p>
        </div>
      </div>

      <form
        className="painel saque-form"
        onSubmit={(e) => {
          e.preventDefault();
          pedir();
        }}
      >
        <label className="saque-rotulo" htmlFor="saque-nome">
          Nome de quem recebe
        </label>
        <input
          id="saque-nome"
          className="campo"
          autoComplete="name"
          value={nomeExibido}
          onChange={(e) => {
            setNomeEditado(true);
            setNome(e.target.value);
          }}
          maxLength={80}
        />

        <label className="saque-rotulo" htmlFor="saque-cpf">
          CPF (chave PIX)
        </label>
        <input
          id="saque-cpf"
          className="campo"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          value={cpf}
          aria-invalid={cpf.length > 0 && !cpfOk ? true : undefined}
          onChange={(e) => setCpf(formatarCpf(e.target.value))}
        />

        <label className="saque-rotulo" htmlFor="saque-valor">
          Valor
        </label>
        <div className="saque-valor-linha">
          <input
            id="saque-valor"
            className="campo"
            inputMode="decimal"
            placeholder="0,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
          <button
            type="button"
            className="botao botao-secundario botao-p"
            onClick={() => setValor(moedas(disponivel))}
            disabled={disponivel < minimo}
          >
            Tudo
          </button>
        </div>
        <section className="saque-regras" aria-label="Taxas do saque">
          <h2 className="saque-rotulo">Taxas do saque</h2>
          <dl className="saque-taxa">
            <div className="saque-taxa-linha">
              <dt>Taxa fixa</dt>
              <dd className="numeros">R$ {moedas(taxaFixa)}</dd>
            </div>
            <div className="saque-taxa-linha">
              <dt>Taxa percentual</dt>
              <dd className="numeros">{taxaBp / 100}% do valor</dd>
            </div>
            {centavos !== null ? (
              <>
                <div className="saque-taxa-linha">
                  <dt>Sai do saldo</dt>
                  <dd className="numeros">R$ {moedas(centavos)}</dd>
                </div>
                <div className="saque-taxa-linha">
                  <dt>Total da taxa</dt>
                  <dd className="numeros">R$ {moedas(taxaFixa)} + R$ {moedas(Math.max(0, percentual))} = R$ {moedas(taxa)}</dd>
                </div>
                <div className="saque-taxa-linha" data-total="">
                  <dt>Cai no PIX</dt>
                  <dd className="numeros">R$ {moedas(Math.max(0, liquido))}</dd>
                </div>
              </>
            ) : carencia && baseDaTaxa > 0 && (
              <>
                <div className="saque-taxa-linha">
                  <dt>Em cima do bônus</dt>
                  <dd className="numeros">R$ {moedas(baseDaTaxa)}</dd>
                </div>
                <div className="saque-taxa-linha">
                  <dt>Total da taxa</dt>
                  <dd className="numeros">R$ {moedas(taxaFixa)} + R$ {moedas(Math.max(0, taxaSaqueCentavos(baseDaTaxa) - taxaFixa))} = R$ {moedas(taxaSaqueCentavos(baseDaTaxa))}</dd>
                </div>
                <div className="saque-taxa-linha" data-total="">
                  <dt>Cai no PIX</dt>
                  <dd className="numeros">R$ {moedas(liquidoSaqueCentavos(baseDaTaxa))}</dd>
                </div>
              </>
            )}
          </dl>
          <p className="saque-ajuda">
            {carencia
              ? `Nos 3 primeiros dias a taxa incide em cima do bônus de R$ ${moedas(bonus)}: saem R$ ${moedas(bonus)} e caem R$ ${moedas(liquidoSaqueCentavos(bonus))} no PIX.`
              : `A taxa de R$ ${moedas(taxaFixa)} + ${taxaBp / 100}% incide em cima do valor sacado.`}
          </p>
        </section>
        <p className="saque-ajuda">
          {aberto
            ? 'Você já tem um saque em processamento. Espere ele concluir para pedir outro.'
            : carencia && rendimentosBloqueados > 0 && bonusBloqueado === 0
              ? `Nos 3 primeiros dias, liberado agora: só o bônus de R$ ${moedas(bonus)}. O rendimento das galinhas (R$ ${moedas(rendimentosBloqueados)}) entra no saque 24 horas depois de a colheita virar moeda.`
              : bonusBloqueado > 0
                ? `Bônus inicial de R$ ${moedas(bonusBloqueado)} bloqueado. Ele só entra no saque com um plano ativo: um animal comprado na roleta.${carencia && rendimentosBloqueados > 0 ? ` Nos 3 primeiros dias, o rendimento das galinhas (R$ ${moedas(rendimentosBloqueados)}) entra 24 horas depois de virar moeda.` : ''}`
                : carencia
                  ? `Nos 3 primeiros dias, só o bônus de R$ ${moedas(bonus)} sai na hora. O rendimento das galinhas entra 24 horas depois de virar moeda.`
                  : `Mínimo R$ ${moedas(minimo)}, já com as taxas. 1,00 moeda = R$ 1,00.`}
        </p>

        <button type="submit" className="botao botao-saque" disabled={!pode}>
          {enviar.isPending ? 'Enviando…' : pode && centavos !== null ? `Sacar · recebe R$ ${moedas(liquido)}` : 'Solicitar saque'}
        </button>
      </form>

      <Lista itens={lista.data?.itens ?? []} carregando={lista.isLoading} taxaFixa={taxaFixa} taxaBp={taxaBp} />
    </div>
  );
}

function Lista({ itens, carregando, taxaFixa, taxaBp }: { itens: SaqueDTO[]; carregando: boolean; taxaFixa: number; taxaBp: number }) {
  if (carregando || itens.length === 0) return null;
  return (
    <section className="saque-lista" aria-labelledby="saque-historico">
      <h2 id="saque-historico" className="placa-secao">
        Seus saques
      </h2>
      <ul className="painel lista-painel overflow-hidden">
        {itens.map((s) => (
          <li key={s.id} className="saque-item">
            <div>
              <p className="saque-item-valor numeros">R$ {moedas(s.liquidoCentavos)}</p>
              <p className="saque-item-meta numeros">
                {s.taxaCentavos > 0
                  ? `sai R$ ${moedas(s.centavos)} · taxa fixa R$ ${moedas(Math.min(taxaFixa, s.taxaCentavos))} + ${taxaBp / 100}% R$ ${moedas(s.taxaCentavos - Math.min(taxaFixa, s.taxaCentavos))} · `
                  : `sai R$ ${moedas(s.centavos)} · `}
                {s.cpfMascarado}
              </p>
            </div>
            <span className="saque-status" data-status={s.status}>
              {ROTULO[s.status]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
