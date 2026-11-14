'use client';

// Portão dos termos: quem ainda não aceitou a versão atual (contas antigas, ou termos atualizados) vê o texto
// por cima do jogo e só continua depois de marcar a caixa e aceitar. O cadastro novo já aceita no formulário.
import { TERMOS_VERSAO } from '@galinheiro/api-contract';
import { useId, useState } from 'react';
import { useAceitarTermos, type Estado } from '../estado';
import { toast } from '../ui';
import { mensagemDeErro } from '../util';
import { TextoTermos } from './TextoTermos';

export function PortaoTermos({ estado }: { estado: Estado }) {
  const aceitar = useAceitarTermos();
  const [marcado, setMarcado] = useState(false);
  const id = useId();
  if (!estado.conta.termosPendentes) return null;

  const confirmar = async () => {
    if (!marcado || aceitar.isPending) return;
    try {
      await aceitar.mutateAsync(TERMOS_VERSAO);
    } catch (erro) {
      toast(mensagemDeErro(erro), 'erro');
    }
  };

  return (
    <div className="termos-portao" role="dialog" aria-modal="true" aria-labelledby={`${id}-titulo`}>
      <div className="painel termos-portao-caixa">
        <h2 id={`${id}-titulo`} className="termos-portao-titulo">
          Termos de uso
        </h2>
        <div className="termos-portao-rolagem" tabIndex={0}>
          <TextoTermos />
        </div>
        <div>
          <label className="termos-aceite">
            <input type="checkbox" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} />
            <span>Li e aceito os termos de uso. Sei que nada do jogo vale dinheiro.</span>
          </label>
          <button
            type="button"
            className="botao botao-confirmar botao-g mt-3 w-full"
            onClick={() => void confirmar()}
            disabled={!marcado || aceitar.isPending}
          >
            {aceitar.isPending ? 'Salvando…' : 'Aceitar e continuar'}
          </button>
        </div>
      </div>
    </div>
  );
}
