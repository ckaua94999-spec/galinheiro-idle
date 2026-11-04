'use client';

// Prévia ao vivo do popup num "telefone": o mesmo painel creme com a faixa do título e o mesmo miolo
// (PopupAvisoConteudo: imagem, mensagem e botão) que o membro vê no jogo, sobre um cenário simplificado da fazenda
// escurecido como no modal do jogo. A tela tem 360 px "de verdade" e é reduzida com zoom, para a quebra das linhas
// sair igual à de um celular.
import type { PopupDTO } from '@galinheiro/api-contract';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { PopupAvisoConteudo } from '../../componentes/PopupAviso';

/** Mesmo cálculo do Modal do jogo: título longo encolhe na faixa (e, no limite, quebra em 2 linhas). */
function tamanhoDaFaixa(titulo: string): number {
  const n = titulo.length;
  return n <= 14 ? 22 : n <= 20 ? 20 : n <= 26 ? 18 : 16;
}

const nada = () => {};

export function PreviaPopup({ popup }: { popup: Pick<PopupDTO, 'titulo' | 'mensagem' | 'imagemUrl' | 'botaoTexto' | 'link'> }) {
  const tela = useRef<HTMLDivElement>(null);
  // a prévia é só para olhar: nada dentro dela entra na ordem do Tab
  useEffect(() => {
    tela.current?.querySelectorAll<HTMLElement>('button, a, [tabindex]').forEach((el) => {
      el.tabIndex = -1;
    });
  });
  const titulo = popup.titulo.trim() || 'Título do aviso';
  return (
    <div className="pop-telefone" aria-hidden>
      <div ref={tela} className="pop-telefone-tela">
        <div className="pop-cena">
          <span className="pop-cena-sol" />
          <span className="pop-cena-morro" />
          <span className="pop-cena-galinheiro" />
          <span className="pop-cena-hud">
            <span />
            <span />
          </span>
        </div>
        <span className="pop-telefone-ilha" />
        <div className="pop-tela-fundo">
          <div className="painel modal-caixa painel-com-faixa pop-tela-modal">
            <div className="absolute inset-x-0 top-0 isolate">
              <div className="faixa faixa-modal" style={{ ['--faixa-fs' as string]: `${tamanhoDaFaixa(titulo)}px` }}>
                {titulo}
              </div>
            </div>
            <span className="botao botao-icone botao-perigo modal-fechar">
              <span className="icone-contorno">
                <X />
                <X />
              </span>
            </span>
            <div className="modal-corpo">
              <PopupAvisoConteudo popup={popup} aoClicar={nada} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
