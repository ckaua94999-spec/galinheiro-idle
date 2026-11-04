'use client';

// Atendimento do painel (/admin/atendimento): chat da equipe com os membros. No desktop, fila à esquerda e
// conversa à direita; no celular, a fila e, ao tocar, a conversa em tela cheia com botão de voltar.
// A conversa aberta fica na URL (?c=<conversaId>), então dá para abrir direto de um link (ex.: da ficha).
import { MessagesSquare } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { CabecalhoAdm } from '../ShellAdmin';
import { Vazio } from '../ui';
import { FilaConversas } from './FilaConversas';
import { PainelConversa } from './PainelConversa';

const ROTA = '/admin/atendimento';

export function TelaAtendimento() {
  const params = useSearchParams();
  const selecionada = params.get('c');
  const [resumo, setResumo] = useState<{ abertas: number; naoLidas: number } | null>(null);
  // abrir a 1ª conversa empilha no histórico (o "voltar" do celular volta para a fila); trocar de conversa só substitui
  const empilhou = useRef(false);

  const escolher = useCallback(
    (id: string) => {
      if (id === selecionada) return;
      const url = `${ROTA}?c=${encodeURIComponent(id)}`;
      if (selecionada) {
        window.history.replaceState(null, '', url);
      } else {
        window.history.pushState(null, '', url);
        empilhou.current = true;
      }
    },
    [selecionada],
  );
  const voltar = useCallback(() => {
    if (empilhou.current) {
      empilhou.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, '', ROTA);
    }
  }, []);

  const descricao = resumo
    ? `${resumo.abertas} ${resumo.abertas === 1 ? 'conversa aberta' : 'conversas abertas'} · ${resumo.naoLidas} ${resumo.naoLidas === 1 ? 'mensagem não lida' : 'mensagens não lidas'}`
    : 'Converse com os membros pelo chat do jogo.';

  return (
    <div className="atd-tela" data-aberta={selecionada ? '1' : undefined}>
      <div className="atd-tela-cabeca">
        <CabecalhoAdm titulo="Atendimento" descricao={descricao} />
      </div>
      <div className="atd-grade" data-aberta={selecionada ? '1' : undefined}>
        <FilaConversas selecionada={selecionada} aoEscolher={escolher} aoResumo={setResumo} />
        <section className="adm-cartao atd-conversa" aria-label="Conversa">
          {selecionada ? (
            <PainelConversa key={selecionada} id={selecionada} aoVoltar={voltar} />
          ) : (
            <div className="atd-conversa-estado">
              <MessagesSquare className="h-10 w-10 text-slate-300" aria-hidden />
              <Vazio titulo="Escolha uma conversa">Toque em uma conversa da fila para ler as mensagens e responder.</Vazio>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
