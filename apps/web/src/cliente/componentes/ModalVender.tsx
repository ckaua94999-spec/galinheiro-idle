'use client';

// Modal Vender Ovos (GDD 3.5.4 e 6.7): tudo selecionado por padrão, seletores por tipo.
// Visual: uma "ficha" por espécie tingida pela raridade (ovo grande num medalhão,
// seletor − / + redondo), total num letreiro dourado e o botão verde "Vender tudo" com o preço.
import { ANIMAIS, ITENS, NOME_TIPO, tipoDoItem, valorVendaX100, type Inventario } from '@galinheiro/game-core';
import { Minus, Plus, ShoppingBasket } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Moeda, Ovo } from '../arte/Icones';
import type { Estado } from '../estado';
import { useUi } from '../ui';
import { useAcoes } from '../useAcoes';
import { entradaDeLista } from '../movimento';
import { moedas } from '../util';
import { Modal } from './Modal';

/** Marca as bordas da rolagem que ainda escondem conteúdo (data-borda-topo/-fim): o CSS esmaece só esse lado. */
function useBordasDeRolagem(alvo: () => HTMLElement | null | undefined, ativo: boolean) {
  useEffect(() => {
    const el = ativo ? alvo() : null;
    if (!el) return;
    const atualizar = () => {
      el.toggleAttribute('data-borda-topo', el.scrollTop > 2);
      el.toggleAttribute('data-borda-fim', el.scrollTop + el.clientHeight < el.scrollHeight - 2);
    };
    atualizar();
    el.addEventListener('scroll', atualizar, { passive: true });
    const ro = new ResizeObserver(atualizar);
    ro.observe(el);
    for (const filho of Array.from(el.children)) ro.observe(filho);
    return () => {
      el.removeEventListener('scroll', atualizar);
      ro.disconnect();
    };
  }, [ativo]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Cesto vazio (estado sem ovos). */
function CestoVazio() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden>
      <ellipse cx="48" cy="86" rx="34" ry="6" fill="#6b4a26" opacity=".18" />
      <path d="M20 46C20 14 76 14 76 46" fill="none" stroke="#3b200c" strokeWidth="11" strokeLinecap="round" />
      <path d="M20 46C20 14 76 14 76 46" fill="none" stroke="#c4844a" strokeWidth="5" strokeLinecap="round" />
      <path d="M26 30Q34 20 46 19" fill="none" stroke="#f0bb7a" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="48" cy="48" rx="36" ry="9" fill="#4a2a10" stroke="#3b200c" strokeWidth="6" paintOrder="stroke" />
      <path d="M12 48H84L76 80Q75 85 70 85H26Q21 85 20 80Z" fill="#c4844a" stroke="#3b200c" strokeWidth="6" paintOrder="stroke" strokeLinejoin="round" />
      <g fill="none" stroke="#7a4a22" strokeWidth="2" strokeLinecap="round" opacity=".8">
        <path d="M15 59H81M17 70H79" />
        <path d="M30 50L32 84M48 50V84M66 50L64 84" />
      </g>
      <path d="M16 51H80" stroke="#ffe0b0" strokeWidth="2.4" strokeLinecap="round" opacity=".75" />
      {/* uma peninha caída para dar graça */}
      <path d="M70 30Q82 22 88 30Q80 34 70 30Z" fill="#fff4e2" stroke="#8a4a22" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function ModalVender({ estado }: { estado: Estado }) {
  const aberta = useUi((s) => s.vendaAberta);
  const abrirVenda = useUi((s) => s.abrirVenda);
  const { venderOvos, vendendo } = useAcoes();
  const [sel, setSel] = useState<Inventario>(estado.inventario);
  const refTudo = useRef<HTMLButtonElement>(null);
  const refLista = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (aberta) setSel(estado.inventario);
  }, [aberta]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalSel = valorVendaX100(sel);
  const totalTudo = valorVendaX100(estado.inventario);
  // a rolagem é do corpo do modal (pai da lista)
  useBordasDeRolagem(() => refLista.current?.closest<HTMLElement>('[data-corpo]'), aberta && totalTudo > 0);
  const ajustar = (item: (typeof ITENS)[number], delta: number) =>
    setSel((s) => ({ ...s, [item]: Math.max(0, Math.min(estado.inventario[item], s[item] + delta)) }));

  const vender = async (tudo: boolean) => {
    const corpo = tudo ? ({ tudo: true } as const) : { itens: Object.fromEntries(ITENS.filter((i) => sel[i] > 0).map((i) => [i, sel[i]])) };
    const ok = await venderOvos(corpo, refTudo.current);
    if (ok) abrirVenda(false);
  };

  // Total + ações num rodapé fixo do modal (fora da rolagem): o CTA verde fica sempre visível,
  // mesmo em 320×568 com as 4 fichas; só a lista rola.
  const rodape =
    totalTudo === 0 ? undefined : (
      <>
        <div className="venda-total">
          <Moeda className="venda-total-moeda" />
          <span className="venda-total-rotulo">
            Total<span className="venda-total-sel"> selecionado</span>
          </span>
          <span className="venda-total-valor texto-contorno numeros">{moedas(totalSel)}</span>
        </div>

        <div className="venda-acoes">
          <button
            ref={refTudo}
            type="button"
            className="botao botao-confirmar botao-g botao-brilho venda-tudo w-full"
            onClick={() => void vender(true)}
            disabled={vendendo}
            data-tut="vender-tudo"
            data-autofoco
          >
            Vender tudo
            <span className="botao-preco">
              {moedas(totalTudo)} <Moeda />
            </span>
          </button>
          <button type="button" className="botao botao-secundario w-full" onClick={() => void vender(false)} disabled={totalSel === 0 || vendendo}>
            <ShoppingBasket className="h-5 w-5" strokeWidth={2.6} />
            Vender selecionados
          </button>
        </div>
      </>
    );

  return (
    <Modal
      aberto={aberta}
      aoFechar={() => abrirVenda(false)}
      titulo="Vender ovos"
      className="rolagem-esmaecida venda-corpo"
      rodape={rodape}
      classeRodape="venda-rodape"
    >
      {totalTudo === 0 ? (
        <div className="venda-vazio">
          <CestoVazio />
          <p className="font-semibold text-texto-suave">Sem ovos para vender. Colete primeiro!</p>
        </div>
      ) : (
        <ul ref={refLista} className="venda-lista">
          {ITENS.map((item, i) => {
            const tipo = tipoDoItem(item);
            const estoque = estado.inventario[item];
            const preco = ANIMAIS[tipo].precoOvoX100;
            return (
              <motion.li
                key={item}
                className="painel-raridade venda-linha"
                data-raridade={ANIMAIS[tipo].raridade}
                data-vazio={estoque === 0 ? '' : undefined}
                {...entradaDeLista(i, 0.1)}
              >
                <span className="venda-ovo">
                  <Ovo tipo={tipo} />
                </span>
                <div className="venda-info">
                  <p className="venda-nome">{NOME_TIPO[tipo]}</p>
                  <p className="venda-preco numeros">
                    <span className="venda-preco-texto">
                      {estoque} × {moedas(preco)}
                    </span>
                    <Moeda />
                  </p>
                  <p className="venda-preco venda-sub numeros">
                    <span className="venda-preco-texto">= {moedas(sel[item] * preco)}</span>
                    <Moeda />
                  </p>
                </div>
                <div className="venda-passo">
                  <button
                    type="button"
                    className="botao botao-icone botao-secundario"
                    onClick={() => ajustar(item, -1)}
                    disabled={sel[item] <= 0}
                    aria-label={`Menos ${NOME_TIPO[tipo]}`}
                  >
                    <Minus />
                  </button>
                  <span className="venda-qtd texto-contorno numeros" aria-live="polite">
                    {sel[item]}
                  </span>
                  <button
                    type="button"
                    className="botao botao-icone botao-secundario"
                    onClick={() => ajustar(item, 1)}
                    disabled={sel[item] >= estoque}
                    aria-label={`Mais ${NOME_TIPO[tipo]}`}
                  >
                    <Plus />
                  </button>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
