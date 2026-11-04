'use client';

// Galeria da área "telas" (dev): vitrine da Loja, Extrato, blocos dos Ajustes, abertura (Entrar) e os
// modais de ação (Vender e Aposentadorias), tudo com dados fictícios.
import type { TransacaoDTO } from '@galinheiro/api-contract';
import { Bell, Clapperboard, Headphones, Megaphone, Music, Volume2 } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { ModalAposentadorias } from '@/cliente/componentes/ModalAposentadorias';
import { ModalVender } from '@/cliente/componentes/ModalVender';
import { useMontado } from '@/cliente/componentes/ShellJogo';
import { Azulejo, Interruptor, Linha, Secao, Segmentado } from '@/cliente/telas/TelaAjustes';
import { TelaEntrar } from '@/cliente/telas/TelaEntrar';
import { CartaoSaldo, ListaExtrato } from '@/cliente/telas/TelaExtrato';
import { VitrineAmpliacao, VitrineEmBreve } from '@/cliente/telas/TelaLoja';
import { useUi } from '@/cliente/ui';
import { AGORA_FICTICIO, entidadeFicticia, estadoFicticio } from '../_mock';
import { Exemplo, Moldura } from '../_Moldura';

const H = 3_600_000;

// Palco para os modais (fixed): o transform cria um bloco de contenção e prende o modal na caixa.
function Palco({ altura, children, largura = 390 }: { altura: number; children: React.ReactNode; largura?: number }) {
  const montado = useMontado();
  return (
    <div
      className="relative overflow-hidden rounded-3xl border-2 border-contorno/40"
      style={{
        width: largura,
        maxWidth: '100%',
        height: altura,
        transform: 'translateZ(0)',
        background: 'linear-gradient(180deg, #49b8ff 0%, #8fd6ff 40%, #c4ecff 75%, #dff6c8 100%)',
      }}
    >
      {montado && children}
    </div>
  );
}

function transacao(id: string, tipo: TransacaoDTO['tipo'], valorX100: number, saldoAposX100: number, horasAtras: number, detalhes: Record<string, unknown> = {}): TransacaoDTO {
  return { id, tipo, valorX100, saldoAposX100, detalhes, criadoEm: new Date(AGORA_FICTICIO - horasAtras * H).toISOString() };
}

const TRANSACOES: TransacaoDTO[] = [
  transacao('t1', 'VENDA_OVOS', 5_530, 18_430, 0.5),
  transacao('t2', 'GIRO_ROLETA', -4_000, 12_900, 2, { tipo: 'avestruz' }),
  transacao('t3', 'GIRO_ROLETA', -4_000, 16_900, 3, { tipo: 'pato' }),
  transacao('t4', 'UPGRADE_NINHO', -2_000, 20_900, 26, { nivelPara: 4 }),
  transacao('t5', 'VENDA_OVOS', 12_840, 22_900, 27),
  transacao('t6', 'AJUSTE_SUPORTE', 1_000, 10_060, 52),
  transacao('t7', 'BONUS_INICIAL', 5_000, 5_000, 75),
];

/** Blocos dos Ajustes com estado local. */
function AjustesFicticios() {
  const [ambiente, setAmbiente] = useState(true);
  const [push, setPush] = useState(false);
  const [volume, setVolume] = useState(70);
  const [reduzir, setReduzir] = useState<'sistema' | 'ligado' | 'desligado'>('sistema');
  return (
    <div className="ajustes-secoes" style={{ maxWidth: 380 }}>
      <Secao titulo="Som" Icone={Headphones} cor="azul">
        <div className="linha-ajuste-bloco ajustes-volume">
          <div className="flex items-center gap-3">
            <Azulejo Icone={Volume2} cor="azul" />
            <p className="linha-ajuste-titulo flex-1">Efeitos sonoros</p>
            <span className="valor-volume numeros">{volume}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="deslizador mt-1"
            style={{ ['--p' as string]: volume }}
            aria-label="Volume dos efeitos"
          />
        </div>
        <Linha Icone={Music} cor="roxo" titulo="Som ambiente" descricao="Passarinhos e vento ao fundo">
          <Interruptor ligado={ambiente} aoMudar={setAmbiente} rotulo="Som ambiente" />
        </Linha>
      </Secao>
      <Secao titulo="Animações" Icone={Clapperboard} cor="roxo">
        <div className="linha-ajuste-bloco">
          <Segmentado
            rotulo="Reduzir animações"
            valor={reduzir}
            aoMudar={setReduzir}
            opcoes={[
              { valor: 'sistema', rotulo: 'Como o sistema', curto: 'Sistema' },
              { valor: 'ligado', rotulo: 'Ligado' },
              { valor: 'desligado', rotulo: 'Desligado' },
            ]}
          />
        </div>
      </Secao>
      <Secao titulo="Notificações" Icone={Megaphone} cor="vermelho">
        <Linha Icone={Bell} cor={push ? 'verde' : 'cinza'} titulo="Avisar quando os ovos ficarem prontos" descricao="No máximo 1 aviso por dia, entre 8 h e 22 h">
          <Interruptor ligado={push} aoMudar={setPush} rotulo="Notificações" />
        </Linha>
      </Secao>
    </div>
  );
}

/** Só no cliente: datas e horas dependem do fuso do navegador (evita divergência de hidratação). */
function SoCliente({ children }: { children: React.ReactNode }) {
  return useMontado() ? <>{children}</> : null;
}

/** Abre o modal de venda pelo estado de UI (como o botão Vender do HUD faz). */
function AbreVenda() {
  useEffect(() => {
    useUi.setState({ vendaAberta: true });
  }, []);
  return null;
}

const ESTADO_VENDA = estadoFicticio();
const ESTADO_SEM_OVOS = { ...estadoFicticio(), inventario: { ovo_galinha: 0, ovo_pato: 0, ovo_ganso: 0, ovo_avestruz: 0 } };
const ESTADO_APOSENTADORIAS = {
  ...estadoFicticio(),
  aposentadoriasNaoVistas: [
    entidadeFicticia({ tipo: 'galinha', aposentado: true, nome: 'Dona Cocó', id: 'ap-1' }),
    entidadeFicticia({ tipo: 'avestruz', aposentado: true, nome: 'Estrela', id: 'ap-2' }),
    entidadeFicticia({ tipo: 'pato', aposentado: true, nome: 'Patolino', id: 'ap-3' }),
  ],
};

export function SecaoTelas() {
  const agora = new Date(AGORA_FICTICIO);
  return (
    <Moldura titulo="Telas">
      {/* pt-7: a fita da vitrine sobe 22 px acima do painel e cobria a legenda */}
      <Exemplo titulo="Loja: vitrine (nível 4, PIX) e Em breve" className="flex flex-wrap items-start gap-6 pt-7">
        <div style={{ width: 358 }} className="space-y-8">
          <VitrineAmpliacao nivel={4} capacidade={16} />
          <VitrineEmBreve />
        </div>
        <div style={{ width: 358 }}>
          <VitrineAmpliacao nivel={1} capacidade={4} />
        </div>
        <div style={{ width: 358 }}>
          <VitrineAmpliacao nivel={32} capacidade={128} />
        </div>
      </Exemplo>

      <Exemplo titulo="Extrato: saldo, agrupado por dia, carregando e vazio" className="flex flex-wrap items-start gap-6">
        <div style={{ width: 358 }}>
          <CartaoSaldo saldoX100={18_430} />
          <SoCliente>
            <ListaExtrato itens={TRANSACOES} agora={agora} />
          </SoCliente>
        </div>
        <div style={{ width: 358 }} className="space-y-6">
          <ListaExtrato itens={[]} carregando />
          <ListaExtrato itens={[]} />
        </div>
      </Exemplo>

      <Exemplo titulo="Ajustes: placas, azulejos, volume, interruptores e seletor segmentado">
        <AjustesFicticios />
      </Exemplo>

      <Exemplo titulo="Modal Vender (390 px, 320×568 compacto com rodapé fixo e sem ovos)" className="flex flex-wrap gap-6">
        <AbreVenda />
        <Palco altura={800}>
          <ModalVender estado={ESTADO_VENDA} />
        </Palco>
        {/* a ficha compacta vem de @container (largura do painel), então aparece aqui mesmo no desktop */}
        {/* 568 px de altura: as fichas rolam, Total + "Vender tudo" ficam no rodapé fixo */}
        <Palco altura={568} largura={320}>
          <ModalVender estado={ESTADO_VENDA} />
        </Palco>
        <Palco altura={420}>
          <ModalVender estado={ESTADO_SEM_OVOS} />
        </Palco>
      </Exemplo>

      <Exemplo titulo="Modal Aposentadorias" className="flex flex-wrap gap-6">
        <Palco altura={800}>
          <ModalAposentadorias estado={ESTADO_APOSENTADORIAS} />
        </Palco>
      </Exemplo>

      <Exemplo titulo="Entrar (abertura)">
        <Palco altura={844}>
          <Suspense fallback={null}>
            <TelaEntrar />
          </Suspense>
        </Palco>
      </Exemplo>
    </Moldura>
  );
}
