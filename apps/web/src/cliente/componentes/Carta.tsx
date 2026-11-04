'use client';

// Carta colecionável no estilo Clash Royale (GDD 3.7.4; DIRECAO_DE_ARTE seção 6): moldura metálica na cor da
// raridade, arte grande sobre cenário, "gota" com o valor do ovo, gemas, plaqueta de nome, vida e timer.
// Camadas e estados vivem em estilos/cartas.css (data-raridade, data-tamanho, data-estado). Sem filtros.
import type { EntityDTO } from '@galinheiro/api-contract';
import {
  CONFIG, EMOJI_TIER, GEMAS_RARIDADE, NOME_RARIDADE, NOME_TIPO, formatarDuracao, formatarTimer, tierDe, validarNome,
} from '@galinheiro/game-core';
import { Check, Clock, Gift, Pencil, X } from 'lucide-react';
import { useId, useState, type CSSProperties } from 'react';
import { FiguraAnimal } from '../arte/Animal';
import { Moeda, Ovo } from '../arte/Icones';
import { diasRestantesAgora, estaProntoAgora, humorDe, vidaDe } from '../derivados';
import { cx, formatarData, moedas } from '../util';
import { BarraVida } from './BarraVida';
import { GemasCarta, JoiaCrista, OvoValor } from './carta/pecas';

export { EsqueletoCarta } from './carta/EsqueletoCarta';
export { VersoCarta } from './carta/VersoCarta';

/** Erros do nome: frase completa (leitores de tela e editor fora da carta) e versão curta de 1 linha para a
 *  etiqueta pendurada sob a plaqueta da carta. */
const MENSAGEM_NOME: Record<string, { longa: string; curta: string }> = {
  VAZIO: { longa: 'Digite um nome.', curta: 'Digite um nome' },
  LONGO_DEMAIS: { longa: 'No máximo 20 caracteres.', curta: 'Máx. 20 caracteres' },
  CARACTERE_INVALIDO: { longa: 'Use letras, números, espaço, hífen, apóstrofo ou ponto.', curta: "Só letras, números e . - '" },
  ESPACOS: { longa: 'Sem espaços duplos.', curta: 'Sem espaços duplos' },
  SEM_LETRA: { longa: 'Use pelo menos uma letra.', curta: 'Falta uma letra' },
};

export function EditorNome({ inicial, aoSalvar, aoCancelar, salvando }: { inicial: string; aoSalvar: (nome: string) => void; aoCancelar: () => void; salvando?: boolean }) {
  const [valor, setValor] = useState(inicial);
  const idErro = useId();
  const r = validarNome(valor);
  const erro = !r.ok && r.erro === 'NOME_INVALIDO' && valor.trim() !== '' ? MENSAGEM_NOME[r.motivo] : null;
  const enviar = () => {
    if (r.ok) aoSalvar(r.nome);
  };
  return (
    <div className="editor-nome w-full">
      <div className="flex items-center gap-1.5">
        <input
          data-autofoco
          className="campo editor-nome-campo"
          value={valor}
          maxLength={CONFIG.nome.max + 5}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') enviar();
            if (e.key === 'Escape') aoCancelar();
          }}
          aria-label="Nome do animal"
          aria-invalid={!!erro}
          aria-describedby={erro ? idErro : undefined}
        />
        <button type="button" className="botao botao-icone botao-confirmar" onClick={enviar} disabled={!r.ok || salvando} aria-label="Salvar nome">
          <Check />
        </button>
        <button type="button" className="botao botao-icone" onClick={aoCancelar} aria-label="Cancelar">
          <X />
        </button>
      </div>
      {/* na carta, o erro é uma etiqueta curta pendurada sob a plaqueta (absoluta): a plaqueta não cresce e a arte fica à vista */}
      {erro && (
        <p id={idErro} className="editor-nome-erro" role="alert">
          <span className="editor-nome-erro-curta" aria-hidden>
            {erro.curta}
          </span>
          <span className="editor-nome-erro-longa">{erro.longa}</span>
        </p>
      )}
    </div>
  );
}

export type EstadoCarta = 'normal' | 'pronto' | 'ultimo-ciclo' | 'aposentado';

interface PropsCarta {
  e: EntityDTO;
  agora: number;
  compacta?: boolean;
  editando?: boolean;
  salvandoNome?: boolean;
  aoEditar?: () => void;
  aoSalvarNome?: (nome: string) => void;
  aoCancelarNome?: () => void;
  /** Ações (botões) mostradas abaixo da carta, fora da moldura. */
  children?: React.ReactNode;
  className?: string;
  /** Liga/desliga as animações contínuas (reflexo, aura, faíscas). Padrão: ligadas. */
  animada?: boolean;
  /** A carta acabou de abrir (folha, revelação): uma passada de reflexo na chegada, inclusive no comum. */
  entrada?: boolean;
  /** Esconde o selo de estado ("Pronto!", "Último ciclo"…) — a revelação mostra a carta "nova", sem status. */
  semSelo?: boolean;
  /** Esconde o anel verde de "pronto" em volta da moldura. */
  semAnel?: boolean;
}

/** Timer curto com unidade, para não confundir com o hh:mm:ss da completa: "5h09", "42m", "<1m". */
function timerComUnidade(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return m > 0 ? `${m}m` : '<1m';
}

/** Mesmo tempo por extenso, para leitores de tela: "5 horas e 9 minutos". */
function tempoFalado(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  const partes = [h > 0 && `${h} ${h === 1 ? 'hora' : 'horas'}`, m > 0 && `${m} ${m === 1 ? 'minuto' : 'minutos'}`].filter(Boolean);
  return partes.length ? partes.join(' e ') : 'menos de 1 minuto';
}

// Posições das faíscas que sobem na arte (épico/lendário, só na completa)
const FAISCAS = [
  { x: 16, d: 0, t: 3.1 },
  { x: 38, d: 1.4, t: 2.7 },
  { x: 64, d: 0.7, t: 3.4 },
  { x: 84, d: 2.1, t: 2.9 },
];

export function Carta({
  e,
  agora,
  compacta,
  editando,
  salvandoNome,
  aoEditar,
  aoSalvarNome,
  aoCancelarNome,
  children,
  className,
  animada = true,
  entrada,
  semSelo,
  semAnel,
}: PropsCarta) {
  const ativo = e.status === 'ativo';
  const pronto = estaProntoAgora(e, agora);
  const falta = Date.parse(e.proximoRendimento) - agora;
  const restaMs = Date.parse(e.expiracao) - agora;
  const dias = diasRestantesAgora(e, agora);
  const ultimoDia = ativo && restaMs < 86_400_000;
  const vida = vidaDe(e, agora);
  const humor = humorDe(e, agora);
  const tier = ativo ? tierDe(vida) : null;
  const estado: EstadoCarta = !ativo ? 'aposentado' : pronto ? 'pronto' : e.ultimoCiclo || ultimoDia ? 'ultimo-ciclo' : 'normal';
  const { raridade } = e;
  const completa = !compacta;
  const brilhos = ativo && raridade !== 'comum';

  return (
    <article
      className={cx('carta', !animada && 'carta-parada', entrada && 'carta-entrando', className)}
      data-raridade={raridade}
      data-tipo={e.tipo}
      data-tamanho={compacta ? 'compacta' : 'completa'}
      data-estado={estado}
      aria-label={`${e.nome}, ${NOME_RARIDADE[raridade]}`}
    >
      <div className="carta-corpo">
        {brilhos && raridade !== 'lendario' && <span className="carta-halo" aria-hidden />}
        {brilhos && raridade === 'lendario' && (
          <span className="carta-aura" aria-hidden>
            <span />
          </span>
        )}
        <span className="carta-sombra" aria-hidden />
        {pronto && !semAnel && <span className="carta-anel" aria-hidden />}
        <div className="carta-contorno">
          <div className="carta-moldura">
            <div className="carta-arte-caixa">
              <div className="carta-arte">
                <FiguraAnimal tipo={e.tipo} humor={humor} detalhe={compacta ? 'm' : 'g'} pronto={pronto} className="carta-figura" />
                {brilhos && completa && (
                  <span className="carta-faiscas" aria-hidden>
                    {FAISCAS.map((f) => (
                      <span key={f.x} className="carta-faisca" style={{ left: `${f.x}%`, animationDelay: `${f.d}s`, animationDuration: `${f.t}s` }} />
                    ))}
                  </span>
                )}
                {(brilhos || (ativo && entrada)) && <span className="carta-reflexo" aria-hidden />}
                {!ativo && (
                  <span className="carta-faixa-aposentado" aria-hidden>
                    <span className="texto-contorno-fino">Aposentado</span>
                  </span>
                )}
              </div>
              <GemasCarta raridade={raridade} quantidade={GEMAS_RARIDADE[raridade]} />
              {compacta && tier && (
                <span className="carta-humor" aria-hidden>
                  {EMOJI_TIER[tier]}
                </span>
              )}
            </div>

            <div className="carta-placa">
              {editando && aoSalvarNome && aoCancelarNome ? (
                <EditorNome inicial={e.nome} aoSalvar={aoSalvarNome} aoCancelar={aoCancelarNome} salvando={salvandoNome} />
              ) : (
                <>
                  <h3 className="carta-nome texto-contorno">{e.nome}</h3>
                  {completa && (
                    <p className="carta-especie texto-contorno-fino">
                      {NOME_TIPO[e.tipo]} · {NOME_RARIDADE[raridade]}
                    </p>
                  )}
                  {aoEditar && (
                    <button type="button" onClick={aoEditar} className="carta-lapis" aria-label={`Renomear ${e.nome}`}>
                      <Pencil />
                    </button>
                  )}
                </>
              )}
            </div>

            {compacta ? (
              <InfoCompacta e={e} ativo={ativo} pronto={pronto} falta={falta} dias={dias} ultimoDia={ultimoDia} vida={vida} />
            ) : (
              <InfoCompleta e={e} ativo={ativo} pronto={pronto} falta={falta} dias={dias} ultimoDia={ultimoDia} restaMs={restaMs} vida={vida} />
            )}
          </div>
        </div>

        {(raridade === 'epico' || raridade === 'lendario') && <JoiaCrista raridade={raridade} />}
        <OvoValor valorX100={e.valorOvoX100} apagado={!ativo} />
        {!semSelo && <Selo estado={estado} ultimoDia={ultimoDia} compacta={!!compacta} />}
      </div>
      {children && <div className="carta-acoes">{children}</div>}
    </article>
  );
}

function Selo({ estado, ultimoDia, compacta }: { estado: EstadoCarta; ultimoDia: boolean; compacta: boolean }) {
  if (estado === 'pronto') {
    return (
      <span className="carta-selo">
        <span className="pilula pilula-pronto badge-pulsa">Pronto!</span>
      </span>
    );
  }
  if (estado !== 'ultimo-ciclo') return null;
  if (ultimoDia) {
    return (
      <span className="carta-selo">
        <span className="pilula pilula-perigo numeros">
          Último dia!
        </span>
      </span>
    );
  }
  // na compacta, o "Último ciclo" vira um selo redondo de presente (a pílula longa encostava na joia do topo)
  if (compacta) {
    return (
      <span className="carta-selo">
        <span className="carta-selo-presente" role="img" aria-label="Último ciclo">
          <Gift strokeWidth={2.75} />
        </span>
      </span>
    );
  }
  return (
    <span className="carta-selo">
      <span className="pilula pilula-aviso">
        <Gift strokeWidth={3} /> Último ciclo
      </span>
    </span>
  );
}

const ovosNaVida = (n: number) => `${n} ${n === 1 ? 'ovo' : 'ovos'} na vida`;

interface PropsInfo {
  e: EntityDTO;
  ativo: boolean;
  pronto: boolean;
  falta: number;
  dias: number;
  ultimoDia: boolean;
  vida: number;
}

function InfoCompacta({ e, ativo, pronto, falta, dias, ultimoDia, vida }: PropsInfo) {
  if (!ativo) {
    return (
      <div className="carta-info">
        <p className="carta-linha carta-ovos-vida">
          <Ovo tipo={e.tipo} className="carta-ovo-icone" />
          <span className="texto-contorno-fino numeros">{ovosNaVida(e.stats.ovosTotal)}</span>
        </p>
      </div>
    );
  }
  return (
    <div className="carta-info">
      <BarraVida vida={vida} compacta />
      <div className="carta-linha">
        {pronto ? (
          // status (não é botão): mesma pílula escura do timer, com texto verde
          <span className="pilula pilula-timer carta-status-pronto">
            <Ovo tipo={e.tipo} /> Pronto
          </span>
        ) : (
          <span
            className={cx('pilula pilula-timer numeros', e.ultimoCiclo && 'carta-timer-presente')}
            role="timer"
            aria-label={`${e.ultimoCiclo ? 'Últimos ovos' : 'Próximos ovos'} em ${tempoFalado(falta)}`}
          >
            {e.ultimoCiclo ? <Gift strokeWidth={3} aria-hidden /> : <Clock strokeWidth={3} aria-hidden />}
            <span aria-hidden>{timerComUnidade(falta)}</span>
          </span>
        )}
        <span className={cx('carta-dias texto-contorno-fino numeros', ultimoDia && 'carta-dias-fim')} aria-label={`${dias} dias restantes`}>
          {dias}d
        </span>
      </div>
    </div>
  );
}

function InfoCompleta({ e, ativo, pronto, falta, dias, ultimoDia, restaMs, vida }: PropsInfo & { restaMs: number }) {
  const valor = (
    <span className="carta-valor">
      Ovo: <span className="numeros">{moedas(e.valorOvoX100)}</span>
      <Moeda className="carta-valor-moeda" />
    </span>
  );
  if (!ativo) {
    return (
      <div className="carta-info">
        <p className="carta-timer">Aposentado em {formatarData(e.expiradoEm ?? e.expiracao)}</p>
        <div className="carta-linha">
          <span className="carta-ovos-vida">
            <Ovo tipo={e.tipo} className="carta-ovo-icone" />
            <span className="numeros">{ovosNaVida(e.stats.ovosTotal)}</span>
          </span>
          {valor}
        </div>
      </div>
    );
  }
  return (
    <div className="carta-info">
      <BarraVida vida={vida} />
      <p className={cx('carta-timer', pronto && 'carta-timer-pronto', !pronto && e.ultimoCiclo && 'carta-timer-ultimo')}>
        {pronto ? (
          <>
            <Ovo tipo={e.tipo} className="carta-timer-icone" /> Pronto!
          </>
        ) : e.ultimoCiclo ? (
          <>
            <Gift className="carta-timer-icone" strokeWidth={2.75} /> <span className="carta-timer-rotulo">Último ciclo:</span>{' '}
            <span className="carta-timer-valor numeros">{formatarTimer(falta)}</span>
          </>
        ) : (
          <>
            <Clock className="carta-timer-icone" strokeWidth={2.75} />{' '}
            <span className="carta-timer-rotulo">
              <span className="carta-rotulo-longo">Próximos ovos em</span>
              <span className="carta-rotulo-curto">Ovos em</span>
            </span>{' '}
            <span className="carta-timer-valor numeros">{formatarTimer(falta)}</span>
          </>
        )}
      </p>
      <div className="carta-linha">
        <span className={cx('carta-dias-rotulo numeros', ultimoDia && 'carta-dias-fim')}>
          {ultimoDia ? `Aposenta em ${formatarDuracao(restaMs)}` : `${dias}/90 dias`}
        </span>
        {!ultimoDia && (
          <span className="barra carta-barra-dias" data-cor="azul" aria-hidden>
            <span className="barra-preenchimento" style={{ '--p': Math.max(4, (dias / 90) * 100) } as CSSProperties} />
          </span>
        )}
        {valor}
      </div>
    </div>
  );
}
