'use client';

// O animal recebido na troca chega com a MESMA revelação da roleta (RevelacaoAnimal: o verso da carta chega,
// treme, estoura e vira mostrando a carta e o selo da raridade). No fim, como na roleta, "Que tal dar um nome?"
// e os botões "Ver no galinheiro" / "Continuar trocando" (as classes rev-* do formulário são as da revelação).
import type { EntityDTO } from '@galinheiro/api-contract';
import { CONFIG, validarNome } from '@galinheiro/game-core';
import { useEffect, useState, type CSSProperties } from 'react';
import { RevelacaoAnimal } from '../componentes/RevelacaoAnimal';
import { useRenomear } from '../estado';
import { useAgora } from '../relogio';
import { mensagemDeErro } from '../util';

function FormNomeTroca({
  nome,
  aoMudarNome,
  erro,
  salvando,
  aoConfirmar,
}: {
  nome: string;
  aoMudarNome: (nome: string) => void;
  erro: string | null;
  salvando: boolean;
  /** '/galinheiro' = "Ver no galinheiro"; sem destino = "Continuar trocando" */
  aoConfirmar: (destino?: string) => void;
}) {
  return (
    <div className="painel rev-painel">
      <label className="rev-rotulo" htmlFor="nome-troca" data-rev-item style={{ '--i': 0 } as CSSProperties}>
        Que tal dar um nome?
      </label>
      <input
        id="nome-troca"
        className="campo rev-campo"
        data-rev-item
        style={{ '--i': 1 } as CSSProperties}
        value={nome}
        maxLength={CONFIG.nome.max + 5}
        onChange={(e) => aoMudarNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') aoConfirmar('/galinheiro');
        }}
        aria-invalid={!!erro}
        aria-describedby={erro ? 'nome-troca-erro' : undefined}
        autoComplete="off"
        data-autofoco
      />
      {erro && (
        <p id="nome-troca-erro" className="rev-erro" role="alert">
          {erro}
        </p>
      )}
      <div className="rev-botoes" data-rev-item style={{ '--i': 2 } as CSSProperties}>
        <button type="button" className="botao botao-primario" onClick={() => aoConfirmar('/galinheiro')} disabled={salvando}>
          <span className="rev-botao-longo">Ver no galinheiro</span>
          <span className="rev-botao-curto">Ver no ninho</span>
        </button>
        <button type="button" className="botao botao-secundario" onClick={() => aoConfirmar()} disabled={salvando}>
          <span className="rev-botao-longo">Continuar trocando</span>
          <span className="rev-botao-curto">Continuar</span>
        </button>
      </div>
    </div>
  );
}

/** Revelação do animal da troca + nome. Valida e renomeia antes de fechar. */
export function RevelacaoTroca({ entidade, aoFechar }: { entidade: EntityDTO | null; aoFechar: (destino?: string) => void }) {
  const renomear = useRenomear();
  const agora = useAgora();
  const [nome, setNome] = useState('');
  const [erroNome, setErroNome] = useState<string | null>(null);
  useEffect(() => {
    if (entidade) {
      setNome(entidade.nome);
      setErroNome(null);
    }
  }, [entidade]);

  const confirmar = async (destino?: string) => {
    if (!entidade || renomear.isPending) return;
    const v = validarNome(nome);
    if (!v.ok) {
      setErroNome(v.erro === 'NOME_IMPROPRIO' ? 'Esse nome não pode. Que tal outro?' : 'Use de 1 a 20 letras, números, espaço, hífen, apóstrofo ou ponto.');
      return;
    }
    if (v.nome !== entidade.nome) {
      try {
        await renomear.mutateAsync({ id: entidade.id, nome: v.nome });
      } catch (erro) {
        setErroNome(mensagemDeErro(erro));
        return;
      }
    }
    aoFechar(destino);
  };

  return (
    <RevelacaoAnimal entidade={entidade} agora={agora} aoEsc={() => void confirmar()} rotulo="Revelando o animal da troca">
      {entidade && (
        <FormNomeTroca
          nome={nome}
          aoMudarNome={(v) => {
            setNome(v);
            setErroNome(null);
          }}
          erro={erroNome}
          salvando={renomear.isPending}
          aoConfirmar={(destino) => void confirmar(destino)}
        />
      )}
    </RevelacaoAnimal>
  );
}
