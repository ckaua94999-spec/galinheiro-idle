'use client';

// "Resgatar cupom": campo + botão num painel com faixa. O código aceita minúsculas, espaço e traço (o servidor
// normaliza; aqui só conferimos o formato antes de mandar). Erro do servidor (inválido, já usado, esgotado…)
// aparece colado no campo, com o campo tremendo; ganhar tickets dispara a celebração (tickets voando até o
// bilhete do saldo, jingle e faíscas) e a confirmação verde embaixo do campo.
import { CODIGO_CUPOM, normalizarCupom, type CupomResgatadoDTO } from '@galinheiro/api-contract';
import { Check, CircleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { useConexao } from '../conexao';
import { CSS_EASE } from '../movimento';
import { som } from '../som';
import { mensagemDeErro } from '../util';
import { vibracao } from '../vibracao';
import { useResgatarCupom } from './consultas';
import { IconeTicket } from './IconeTicket';
import type { FestaTickets } from './Saldo';
import { tickets } from './texto';

export function ResgatarCupom({ festa, campoRef, focar }: { festa: FestaTickets; campoRef: RefObject<HTMLInputElement | null>; focar: boolean }) {
  const id = useId();
  const online = useConexao((s) => s.online);
  const resgatar = useResgatarCupom();
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ganho, setGanho] = useState<CupomResgatadoDTO | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const linha = useRef<HTMLDivElement>(null);
  const relogio = useRef<number | undefined>(undefined);

  // veio de "Resgatar cupom" (Ajustes): rola até o campo e põe o cursor nele
  useEffect(() => {
    if (!focar) return;
    const t = window.setTimeout(() => {
      const campo = campoRef.current;
      if (!campo) return;
      campo.scrollIntoView({ block: 'center', behavior: 'smooth' });
      campo.focus({ preventScroll: true });
    }, 380);
    return () => window.clearTimeout(t);
  }, [focar, campoRef]);
  useEffect(() => () => window.clearTimeout(relogio.current), []);

  const tremer = () => {
    if (document.documentElement.classList.contains('reduzir-movimento')) return;
    linha.current?.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(2px)' }, { transform: 'translateX(0)' }],
      { duration: 320, easing: CSS_EASE.suave },
    );
  };

  const falhar = (mensagem: string) => {
    setErro(mensagem);
    setGanho(null);
    som.erro();
    vibracao.erro();
    tremer();
  };

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (resgatar.isPending) return;
    const normal = normalizarCupom(codigo);
    if (!normal) return falhar('Digite o código do cupom.');
    if (!CODIGO_CUPOM.test(normal)) return falhar('O código tem de 4 a 20 letras e números.');
    if (!online) return falhar('Sem conexão. Tente quando a internet voltar.');
    festa.segurar();
    try {
      const r = await resgatar.mutateAsync(normal);
      setCodigo('');
      setErro(null);
      setGanho(r.data);
      window.clearTimeout(relogio.current);
      relogio.current = window.setTimeout(() => setGanho(null), 6000);
      festa.ganhar(r.data.giros > 0 ? r.data.giros : r.data.tickets, botao.current);
      som.jackpot();
      vibracao.jackpot();
    } catch (e) {
      festa.soltar();
      falhar(mensagemDeErro(e));
    }
  };

  const idErro = `${id}-erro`;
  const idDica = `${id}-dica`;
  return (
    <section className="painel painel-com-faixa intercambio-cupom" aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`} className="faixa faixa-verde intercambio-cupom-faixa">
        Resgatar cupom
      </h2>
      <form onSubmit={(e) => void enviar(e)} noValidate>
        <label htmlFor={`${id}-campo`} className="intercambio-rotulo">
          Código do cupom
        </label>
        <div ref={linha} className="intercambio-cupom-linha">
          <span className="intercambio-cupom-caixa">
            <IconeTicket className="intercambio-cupom-icone" />
            <input
              ref={campoRef}
              id={`${id}-campo`}
              className="campo intercambio-cupom-campo"
              value={codigo}
              onChange={(e) => {
                setCodigo(e.target.value);
                if (erro) setErro(null);
              }}
              placeholder="Ex.: PASCOA26"
              maxLength={40}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              enterKeyHint="send"
              readOnly={resgatar.isPending}
              aria-invalid={!!erro}
              aria-describedby={erro ? idErro : idDica}
            />
          </span>
          <button
            ref={botao}
            type="submit"
            className="botao botao-primario intercambio-cupom-botao"
            aria-busy={resgatar.isPending || undefined}
            data-pressionado={resgatar.isPending ? '' : undefined}
          >
            {/* enquanto confere, o botão fica afundado (a largura não muda e o campo não encolhe) */}
            Resgatar
          </button>
        </div>
        {erro ? (
          <p id={idErro} className="intercambio-cupom-msg" data-tipo="erro" role="alert">
            <CircleAlert strokeWidth={2.75} aria-hidden />
            {erro}
          </p>
        ) : ganho ? (
          <p className="intercambio-cupom-msg" data-tipo="ok" role="status">
            <Check strokeWidth={3.2} aria-hidden />
            <span>
              Cupom <b>{ganho.codigo}</b> resgatado:{' '}
              <b>{ganho.giros > 0 ? `+${ganho.giros} ${ganho.giros === 1 ? 'giro' : 'giros'} na roleta` : `+${tickets(ganho.tickets)}`}</b>!
            </span>
          </p>
        ) : (
          <p id={idDica} className="intercambio-cupom-msg" data-tipo="dica">
            Os códigos vêm da equipe do jogo, em avisos e eventos. Cada cupom vale uma vez por conta.
          </p>
        )}
      </form>
    </section>
  );
}
