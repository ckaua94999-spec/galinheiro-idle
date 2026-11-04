'use client';

// Popup (aviso) da equipe na tela do membro. `PopupAvisoConteudo` é o miolo (imagem, mensagem e botão) — o
// mesmo no jogo e na prévia do painel; `PopupAviso` o coloca no modal do jogo, com o título na faixa.
import type { PopupDTO } from '@galinheiro/api-contract';
import { ExternalLink } from 'lucide-react';
import { Modal } from './Modal';

/** Link externo (https) abre em outra aba; caminho do jogo (/roleta) navega dentro do app. */
export const linkExterno = (link: string | null): boolean => !!link && /^https:\/\//.test(link);

export function PopupAvisoConteudo({ popup, aoClicar }: { popup: Pick<PopupDTO, 'mensagem' | 'imagemUrl' | 'botaoTexto' | 'link'>; aoClicar: () => void }) {
  const externo = linkExterno(popup.link);
  return (
    <div className="popup-aviso">
      {popup.imagemUrl && (
        // imagem informada pela equipe (https); sem otimização do Next de propósito (domínio livre)
        // eslint-disable-next-line @next/next/no-img-element
        <img className="popup-aviso-imagem" src={popup.imagemUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
      )}
      <p className="popup-aviso-mensagem">{popup.mensagem}</p>
      <button type="button" className="botao botao-primario botao-g w-full" onClick={aoClicar} data-autofoco>
        {popup.botaoTexto || (popup.link ? 'Ver agora' : 'Entendi')}
        {externo && <ExternalLink className="h-5 w-5" aria-hidden />}
      </button>
      {externo && <p className="popup-aviso-destino">Abre {new URL(popup.link!).hostname} em outra aba</p>}
    </div>
  );
}

export function PopupAviso({ popup, aberto, aoFechar, aoClicar }: { popup: PopupDTO | null; aberto: boolean; aoFechar: () => void; aoClicar: () => void }) {
  return (
    <Modal aberto={aberto && !!popup} aoFechar={aoFechar} titulo={popup?.titulo ?? ''}>
      {popup && <PopupAvisoConteudo popup={popup} aoClicar={aoClicar} />}
    </Modal>
  );
}
