'use client';

// PIX e saque escolhem a gateway no painel. Cobranças e saques já abertos continuam na gateway em que nasceram.
import { CONFIG } from '@galinheiro/game-core';
import { valorUsdtX100 } from '@galinheiro/api-contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { chamar } from '../../api';
import { toast } from '../../ui';
import { CabecalhoAdm } from '../ShellAdmin';
import { BotaoAdm, Campo, Carregando, fmt, mensagemAdmin } from '../ui';
import { lerMoedas } from '../usuarios/comum';

type Gateway = 'lofypay' | 'kavropay' | 'swytchpay';
type Uso = 'pix' | 'saque';
type RedeUsdt = 'TRC20' | 'ERC20' | 'BEP20';

interface ConfigUsdt {
  rede: RedeUsdt;
  endereco: string;
  cotacaoCentavos: number;
}

interface EstadoPagamentos {
  pix: Gateway;
  saque: Gateway;
  usdt: ConfigUsdt;
  lofypayConfigurada: boolean;
  kavropayConfigurada: boolean;
  swytchpayConfigurada: boolean;
}

const OPCOES: { id: Gateway; nome: string; detalhe: string; webhook: string }[] = [
  { id: 'swytchpay', nome: 'SwytchPay', detalhe: 'api.go.swytchpay.app', webhook: '/api/webhooks/swytchpay' },
  { id: 'kavropay', nome: 'KavroPay', detalhe: 'api.kavropay.online', webhook: '/api/webhooks/kavropay' },
  { id: 'lofypay', nome: 'LofyPay', detalhe: 'app.lofypay.com', webhook: '/api/webhooks/lofypay' },
];

const NOMES: Record<Gateway, string> = { swytchpay: 'SwytchPay', kavropay: 'KavroPay', lofypay: 'LofyPay' };

function configurada(estado: EstadoPagamentos, id: Gateway): boolean {
  if (id === 'swytchpay') return estado.swytchpayConfigurada;
  if (id === 'kavropay') return estado.kavropayConfigurada;
  return estado.lofypayConfigurada;
}

export function TelaPagamentos() {
  const qc = useQueryClient();
  const consulta = useQuery({
    queryKey: ['admin', 'pagamentos'],
    queryFn: async () => (await chamar<EstadoPagamentos>('GET', '/api/admin/pagamentos')).data,
  });
  const salvar = useMutation({
    mutationFn: async (pedido: { uso: Uso; gateway: Gateway }) =>
      (await chamar<EstadoPagamentos>('PUT', '/api/admin/pagamentos', { corpo: pedido })).data,
    onSuccess: (data, pedido) => {
      qc.setQueryData(['admin', 'pagamentos'], data);
      const nome = NOMES[pedido.gateway];
      toast(pedido.uso === 'saque' ? `Saques agora saem pela ${nome}.` : `PIX agora sai pela ${nome}.`, 'sucesso');
    },
    onError: (e) => toast(mensagemAdmin(e), 'erro'),
  });

  const estado = consulta.data;

  return (
    <div className="adm-pagina">
      <CabecalhoAdm
        titulo="Pagamentos"
        descricao="PIX e saque escolhem a gateway à parte. O que já foi criado continua na gateway em que nasceu."
      />
      {consulta.isLoading && <Carregando />}
      {consulta.isError && <p className="adm-entrar-erro">{mensagemAdmin(consulta.error)}</p>}
      {estado && (
        <>
          <Grupo
            titulo="PIX criados"
            texto="Roleta e ampliação do galinheiro. O próximo PIX nasce na gateway marcada."
            ativa={estado.pix}
            estado={estado}
            pendente={salvar.isPending}
            aoEscolher={(gateway) => salvar.mutate({ uso: 'pix', gateway })}
          />
          <Grupo
            titulo="Saques"
            texto="O valor que cai no CPF do membro. O próximo saque sai pela gateway marcada."
            ativa={estado.saque}
            estado={estado}
            pendente={salvar.isPending}
            aoEscolher={(gateway) => salvar.mutate({ uso: 'saque', gateway })}
          />
          <CarteiraUsdt inicial={estado.usdt} />
        </>
      )}
    </div>
  );
}

function CarteiraUsdt({ inicial }: { inicial: ConfigUsdt }) {
  const qc = useQueryClient();
  const [rede, setRede] = useState<RedeUsdt>(inicial.rede);
  const [endereco, setEndereco] = useState(inicial.endereco);
  const [cotacao, setCotacao] = useState(fmt.moedas(inicial.cotacaoCentavos));
  const valor = lerMoedas(cotacao);
  const salvar = useMutation({
    mutationFn: async () => (await chamar<ConfigUsdt>('POST', '/api/admin/pagamentos/usdt', {
      corpo: { rede, endereco: endereco.trim(), cotacaoCentavos: valor },
    })).data,
    onSuccess: (data) => {
      qc.setQueryData(['admin', 'pagamentos'], (atual: EstadoPagamentos | undefined) => atual ? { ...atual, usdt: data } : atual);
      toast('Carteira USDT salva.', 'sucesso');
    },
    onError: (e) => toast(mensagemAdmin(e), 'erro'),
  });
  const roleta = valor ? valorUsdtX100(CONFIG.roleta.custoX100, valor) : null;
  const ampliacao = valor ? valorUsdtX100(CONFIG.galinheiro.custoUpgradeX100, valor) : null;
  return (
    <section className="adm-gateway-bloco">
      <h2>USDT</h2>
      <p>Quem estiver marcado na ficha paga a roleta e a ampliação neste endereço. O QR é o endereço. A equipe confirma o pagamento na ficha.</p>
      <div className="adm-us-form">
        <fieldset className="adm-us-opcoes">
          <legend className="adm-campo-rotulo">Rede</legend>
          <div className="adm-us-botoes">
            {(['TRC20', 'ERC20', 'BEP20'] as const).map((op) => (
              <BotaoAdm key={op} tamanho="p" variante={rede === op ? 'primario' : undefined} onClick={() => setRede(op)}>{op}</BotaoAdm>
            ))}
          </div>
        </fieldset>
        <Campo rotulo="Endereço" dica="A carteira que recebe. Vazio deixa o USDT indisponível.">
          <input className="adm-input" value={endereco} autoComplete="off" spellCheck={false} onChange={(e) => setEndereco(e.target.value)} />
        </Campo>
        <Campo rotulo="1 USDT em reais" erro={valor === null ? 'Informe a cotação, como 5,50.' : null} dica={roleta !== null && ampliacao !== null ? `Roleta: ${fmt.moedas(roleta)} USDT. Ampliação: ${fmt.moedas(ampliacao)} USDT.` : undefined}>
          <input className="adm-input" inputMode="decimal" value={cotacao} autoComplete="off" onChange={(e) => setCotacao(e.target.value)} />
        </Campo>
        <BotaoAdm variante="primario" disabled={salvar.isPending || valor === null} onClick={() => salvar.mutate()}>
          {salvar.isPending ? 'Salvando…' : 'Salvar USDT'}
        </BotaoAdm>
      </div>
    </section>
  );
}

function Grupo({ titulo, texto, ativa, estado, pendente, aoEscolher }: {
  titulo: string;
  texto: string;
  ativa: Gateway;
  estado: EstadoPagamentos;
  pendente: boolean;
  aoEscolher: (gateway: Gateway) => void;
}) {
  const opcao = OPCOES.find((o) => o.id === ativa);
  return (
    <section className="adm-gateway-bloco">
      <h2>{titulo}</h2>
      <p>{texto}</p>
      <div className="adm-gateway">
        {OPCOES.map((op) => {
          const pronta = configurada(estado, op.id);
          const selecionada = ativa === op.id;
          return (
            <button
              key={op.id}
              type="button"
              className="adm-gateway-opcao"
              data-ativa={selecionada ? 'true' : 'false'}
              disabled={selecionada || !pronta || pendente}
              onClick={() => aoEscolher(op.id)}
            >
              <span className="adm-gateway-nome">
                {op.nome}
                {selecionada && <Check className="h-4 w-4" aria-hidden />}
              </span>
              <span className="adm-gateway-detalhe">{op.detalhe}</span>
              <span className="adm-gateway-estado">
                {selecionada ? 'Em uso' : pronta ? 'Clique para usar' : 'Sem chave no servidor'}
              </span>
            </button>
          );
        })}
      </div>
      {opcao && (
        <p className="adm-pagina-descricao">
          Webhook: <code>{opcao.webhook}</code>
        </p>
      )}
    </section>
  );
}
