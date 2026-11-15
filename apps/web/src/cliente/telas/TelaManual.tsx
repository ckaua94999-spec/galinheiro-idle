'use client';

// Manual do jogo (aba ao lado da Coleção): todas as regras num lugar só, em seções que abrem e fecham.
// Todo número vem de CONFIG (game-core) ou da configuração viva do servidor (convites): mudou o balanceamento,
// o manual acompanha sozinho.
import {
  ALCANCE_BOMBA, ANIMAIS, CONFIG, CONFIG_BOMBAS, CONFIG_CHUVA, EMOJI_TIER, LINHAS_BOMBAS, NOME_BOMBA, TIPOS_BOMBA, FAIXAS_ROLETA, GALOS, NOME_RARIDADE, NOME_TIER, NOME_TIPO, TIERS, TIPOS,
  chanceRinhaPct, efeitosDoTier, formatarMoedas, retornoMedioRinhaPct, type Tier,
} from '@galinheiro/game-core';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { FiguraAnimal } from '../arte/Animal';
import { IconeManual, Moeda, Ovo } from '../arte/Icones';
import { useMeuConvite } from '../convites/consultas';
import { useEstado } from '../estado';

/** Moedas sem ",00" quando o valor é inteiro (12 em vez de 12,00). */
const m = (x100: number) => formatarMoedas(x100).replace(/,00$/, '');
const pct = (n: number) => `${n.toLocaleString('pt-BR')}%`;
const DIAS_VIDA = CONFIG.vida.vidaUtilMs / 86_400_000;
const TIERS_ORDEM: Tier[] = ['feliz', 'neutro', 'cansado', 'triste'];

function Secao({ id, titulo, emoji, aberta = false, children }: { id: string; titulo: string; emoji: string; aberta?: boolean; children: ReactNode }) {
  return (
    <details className="painel manual-secao" id={id} open={aberta}>
      <summary className="manual-secao-titulo">
        <span className="manual-secao-emoji" aria-hidden>
          {emoji}
        </span>
        <span className="min-w-0 flex-1">{titulo}</span>
      </summary>
      <div className="manual-secao-corpo">{children}</div>
    </details>
  );
}

function Convites() {
  const { data } = useMeuConvite();
  const cfg = data?.config;
  if (cfg && !cfg.ativo) {
    return <p>O programa de convites está pausado agora. Seu link continua guardado em Ajustes › Convidar amigos.</p>;
  }
  return (
    <>
      <p>
        Em <Link href="/convites" className="manual-link">Ajustes › Convidar amigos</Link> você tem um link próprio. Quem se cadastra por ele fica na
        sua rede.
      </p>
      <ul>
        <li>
          Cada venda de ovos de alguém da sua rede rende uma comissão em moedas do jogo para você
          {cfg?.comissoesBp.length
            ? `: ${cfg.comissoesBp.map((bp, i) => `${pct(bp / 100)} no nível ${i + 1}`).join(', ')}.`
            : ', em alguns níveis da rede.'}
        </li>
        <li>Quem vende não perde nada: a comissão é paga pelo jogo, por cima da venda.</li>
        {cfg?.tetoDiarioX100 != null && <li>Cada membro recebe no máximo {m(cfg.tetoDiarioX100)} moedas de comissão por dia.</li>}
        <li>Comissão é moeda do jogo, como todo o resto: não é renda nem investimento.</li>
      </ul>
    </>
  );
}

export function TelaManual() {
  const { data: estado } = useEstado();
  const liberada = estado?.player.roletaLiberada ?? false;
  const { custoX100, liberacaoX100 } = CONFIG.roleta;
  const { ninhosPorNivel, nivelMax, custoUpgradeX100 } = CONFIG.galinheiro;
  const feliz = efeitosDoTier('feliz');

  return (
    <div className="tela manual-tela">
      <div className="tela-cabeca">
        <IconeManual className="tela-cabeca-icone" />
        <h1 className="titulo-tela">Manual</h1>
      </div>
      <p className="manual-intro">
        Tudo o que você precisa saber para cuidar do galinheiro. Toque num assunto para abrir.
      </p>

      <nav className="manual-indice" aria-label="Assuntos do manual">
        {[
          ['comeco', 'Começo'],
          ['ovos', 'Ovos'],
          ['humor', 'Humor'],
          ['animais', 'Animais'],
          ['roleta', 'Roleta'],
          ['galinheiro', 'Ninhos'],
          ['rinha', 'Rinha'],
          ['chuva', 'Chuva de Ovos'],
          ['bombas', 'Ovos-Bomba'],
          ['tickets', 'Tickets'],
          ['convites', 'Convites'],
          ['regras', 'Regras'],
        ].map(([id, rotulo]) => (
          <a key={id} href={`#${id}`} className="manual-chip" onClick={() => document.getElementById(id!)?.setAttribute('open', '')}>
            {rotulo}
          </a>
        ))}
      </nav>

      <Secao id="comeco" titulo="Como o jogo funciona" emoji="🐣" aberta>
        <p>O ciclo é sempre o mesmo:</p>
        <ol>
          <li><b>Colete</b> os ovos dos animais no galinheiro.</li>
          <li><b>Venda</b> os ovos no botão Vender e ganhe moedas do jogo.</li>
          <li><b>Gire a roleta</b> para ganhar animais novos, que botam ovos mais valiosos.</li>
          <li><b>Amplie</b> o galinheiro na Loja para caber mais animais.</li>
        </ol>
        <div className="manual-destaque">
          <span className="manual-destaque-arte" aria-hidden>
            <FiguraAnimal tipo="codorna" ninho={false} detalhe="p" />
          </span>
          <p>
            Toda conta começa com <b>0 moedas</b> e uma <b>codorna</b>, cujo ovo vale <b>{formatarMoedas(ANIMAIS.codorna.precoOvoX100)}</b>. A roleta começa
            trancada: venda os ovos da codorna até juntar <b>{m(liberacaoX100)} moedas</b> e libere a roleta na aba Roleta. A liberação é paga uma vez só e já
            vem com o <b>primeiro giro de graça</b>.
            {liberada ? ' Sua roleta já está liberada.' : ''}
          </p>
        </div>
      </Secao>

      <Secao id="ovos" titulo="Ovos e coleta" emoji="🥚">
        <ul>
          <li>Cada animal bota de novo a cada <b>{CONFIG.ciclo.baseH} horas</b> (mais um atraso quando ele está cansado; veja Humor).</li>
          <li>
            Cada coleta dá de <b>1 a 3 ovos</b>: o primeiro é garantido e cada ovo a mais tem chance de {pct(CONFIG.ciclo.limiarExtraBase / 100)} quando o animal está
            feliz. Três ovos de uma vez é o <b>UAU!</b> ({pct(feliz.chanceTresOvosPct)} de chance quando feliz).
          </li>
          <li>Quantos ovos vêm é sorteado antes, no servidor: você só descobre na hora de coletar.</li>
          <li>Animal novo já chega com ovos prontos para coletar.</li>
          <li>
            <b>Janela de graça:</b> se você coletar atrasado, até {CONFIG.ciclo.janelaGracaH} horas de atraso não contam: o próximo ciclo começa como se você tivesse
            coletado na hora. Depois disso, o atraso faz o animal botar mais tarde.
          </li>
          <li>O botão <b>Coletar Todos</b> pega de uma vez tudo o que está pronto.</li>
          <li>Os ovos ficam guardados no estoque até você vender. Vender converte pelo preço da tabela de Animais.</li>
        </ul>
      </Secao>

      <Secao id="humor" titulo="Humor, vida e aposentadoria" emoji="😄">
        <p>
          Todo animal nasce com 100% de vida, que cai devagar com o tempo. Quanto menos vida, pior o humor e menos ele bota:
        </p>
        <table className="manual-tabela">
          <thead>
            <tr>
              <th>Humor</th>
              <th>Vida</th>
              <th>Chance de ovo extra</th>
              <th>Bota a cada</th>
            </tr>
          </thead>
          <tbody>
            {TIERS_ORDEM.map((t) => {
              const e = efeitosDoTier(t);
              return (
                <tr key={t}>
                  <td>
                    {EMOJI_TIER[t]} {NOME_TIER[t]}
                  </td>
                  <td>acima de {TIERS[t].acimaDe}%</td>
                  <td>{pct((CONFIG.ciclo.limiarExtraBase * TIERS[t].multPct) / 10_000)}</td>
                  <td>{e.duracaoCicloH} h</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <ul>
          <li>
            Cada animal vive <b>{DIAS_VIDA} dias</b>. Os mais raros cansam mais devagar: o pato perde vida {pct(100 - ANIMAIS.pato.fatorPct)} mais devagar, o ganso{' '}
            {pct(100 - ANIMAIS.ganso.fatorPct)} e a avestruz {pct(100 - ANIMAIS.avestruz.fatorPct)}.
          </li>
          <li>
            No fim da vida o animal se <b>aposenta</b>: os ovos que estavam no ninho vão para o seu estoque como presente de despedida, e o ninho fica livre.
          </li>
          <li>Os aposentados continuam na Coleção, para você lembrar de cada um.</li>
        </ul>
      </Secao>

      <Secao id="animais" titulo="Animais e preço dos ovos" emoji="🐔">
        <table className="manual-tabela">
          <thead>
            <tr>
              <th>Animal</th>
              <th>Raridade</th>
              <th>Ovo vale</th>
              <th>Na roleta</th>
            </tr>
          </thead>
          <tbody>
            {TIPOS.map((t) => {
              const faixa = FAIXAS_ROLETA.find((f) => f.tipo === t);
              return (
                <tr key={t}>
                  <td>
                    <span className="manual-animal">
                      <Ovo tipo={t} className="manual-animal-ovo" />
                      {NOME_TIPO[t]}
                    </span>
                  </td>
                  <td>{NOME_RARIDADE[ANIMAIS[t].raridade]}</td>
                  <td className="numeros">{formatarMoedas(ANIMAIS[t].precoOvoX100)}</td>
                  <td>{faixa ? pct((faixa.ate - faixa.de + 1) / 100) : 'só no começo'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p>Você pode dar nome a cada animal tocando na carta dele.</p>
      </Secao>

      <Secao id="roleta" titulo="Roleta" emoji="🎡">
        <ul>
          <li>
            Cada giro custa <b className="manual-preco"><Moeda className="manual-moeda" />{m(custoX100)}</b> moedas e dá um animal novo, que vai para o menor ninho
            livre. Sem ninho livre, a roleta não gira: amplie o galinheiro primeiro.
          </li>
          <li>As chances de cada animal estão no botão Chances e na tabela de Animais. Cada giro é independente: giros anteriores não mudam as chances.</li>
          <li>O resultado é sorteado no servidor antes da animação; a roda só mostra o que saiu.</li>
          <li>Giros grátis (da liberação ou de cupons) são usados antes das moedas.</li>
          <li>Conta nova: a roleta abre depois da liberação de {m(liberacaoX100)} moedas (veja Como o jogo funciona).</li>
        </ul>
      </Secao>

      <Secao id="galinheiro" titulo="Ninhos e Loja" emoji="🏠">
        <ul>
          <li>Você começa com <b>{ninhosPorNivel} ninhos</b>. Cada animal ocupa um.</li>
          <li>
            Na Loja, <b>Ampliar</b> custa <b className="manual-preco"><Moeda className="manual-moeda" />{m(custoUpgradeX100)}</b> moedas e dá mais {ninhosPorNivel} ninhos, até o nível{' '}
            {nivelMax} ({nivelMax * ninhosPorNivel} ninhos).
          </li>
        </ul>
      </Secao>

      <Secao id="rinha" titulo="Rinha de galo" emoji="🐓">
        <p>
          Um minijogo de aposta <b>só com moedas do jogo</b>. Ele abre depois que você libera a roleta. A aposta vai de {m(CONFIG.rinha.apostaMinX100)} a{' '}
          {m(CONFIG.rinha.apostaMaxX100)} moedas.
        </p>
        <table className="manual-tabela">
          <thead>
            <tr>
              <th>Galo</th>
              <th>Chance</th>
              <th>Paga</th>
              <th>Volta em média</th>
            </tr>
          </thead>
          <tbody>
            {GALOS.map((g) => (
              <tr key={g}>
                <td>{CONFIG.rinha.galos[g].nome}</td>
                <td>{pct(chanceRinhaPct(g))}</td>
                <td>{(CONFIG.rinha.galos[g].premioPct / 100).toLocaleString('pt-BR')}×</td>
                <td>{pct(retornoMedioRinhaPct(g))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul>
          <li>Se o seu galo vence, você recebe a aposta multiplicada pelo prêmio. Se perde, perde a aposta.</li>
          <li>
            <b>A casa leva vantagem:</b> a cada 100 moedas apostadas, voltam em média menos de 100 (a última coluna). Quem aposta muito tende a perder moedas.
          </li>
          <li>Um sorteio no servidor decide a luta antes da animação. Os golpes na tela só mostram esse resultado.</li>
        </ul>
      </Secao>

      <Secao id="chuva" titulo="Chuva de Ovos" emoji="🥚">
        <p>
          Um caça-níquel <b>só com moedas do jogo</b>, na Loja. Abre depois que você libera a roleta. A aposta vai de {m(CONFIG_CHUVA.apostaMinX100)} a{' '}
          {m(CONFIG_CHUVA.apostaMaxX100)} moedas.
        </p>
        <ul>
          <li>
            A grade tem {CONFIG_CHUVA.colunas} × {CONFIG_CHUVA.linhas} casas com penas, asas e ovos. <b>{CONFIG_CHUVA.minimoIguais} ou mais iguais</b> em qualquer lugar pagam;
            os ovos de avestruz pagam mais, as penas pagam menos (a tabela completa está no botão Prêmios).
          </li>
          <li>
            Os premiados estouram, os de cima caem e entram novos: a <b>cascata</b> continua enquanto houver prêmio. Cada cascata seguida vale mais: a 2ª
            paga em dobro, a 3ª em triplo, até ×{CONFIG_CHUVA.cascataMultMax}.
          </li>
          <li>
            <b>Ovo de ouro:</b> traz um multiplicador (×{CONFIG_CHUVA.bombas.valores[0]} a ×{CONFIG_CHUVA.bombas.valores.at(-1)}). No fim da cascata, se houve prêmio,
            a soma deles multiplica o ganho.
          </li>
          <li>
            <b>Ninho de ouro:</b> {CONFIG_CHUVA.rodadasGratis.ninhos} ou mais dão {CONFIG_CHUVA.rodadasGratis.rodadas} rodadas grátis. Nelas, {CONFIG_CHUVA.rodadasGratis.ninhosExtra} ninhos
            dão mais {CONFIG_CHUVA.rodadasGratis.extras}.
          </li>
          <li>
            <b>A casa leva vantagem:</b> de cada 100 moedas apostadas, voltam em média {CONFIG_CHUVA.retornoPct}. Cerca de 1 em cada {Math.round(100 / CONFIG_CHUVA.acertoPct)} giros
            paga alguma coisa; parte desses prêmios é menor do que a aposta.
          </li>
          <li>Tudo é sorteado no servidor antes da animação. Uma jogada paga no máximo {CONFIG_CHUVA.tetoVezes.toLocaleString('pt-BR')}× a aposta.</li>
        </ul>
      </Secao>

      <Secao id="bombas" titulo="Ovos-Bomba" emoji="💣">
        <p>
          Outro caça-níquel <b>só com moedas do jogo</b>, na Loja. Abre depois que você libera a roleta. Apostas de{' '}
          {CONFIG_BOMBAS.apostasX100.map((a) => m(a)).join(', ')} moedas.
        </p>
        <ul>
          <li>
            Grade de {CONFIG_BOMBAS.colunas} × {CONFIG_BOMBAS.linhas} com <b>{LINHAS_BOMBAS.length} linhas</b>. Paga com 3, 4 ou 5 símbolos iguais seguidos numa linha, a partir
            da esquerda (a tabela está no botão Regras).
          </li>
          <li>
            O <b>ovo-bomba</b> para junto com o rolo, fica preso na casa e conta um número a menos a cada giro (chega marcando de{' '}
            {CONFIG_BOMBAS.bomba.contagemMin} a {CONFIG_BOMBAS.bomba.contagemMax}), enquanto os outros símbolos continuam girando. No zero ele explode: a
            casa dele e as vizinhas atingidas viram o mesmo símbolo, sorteado na hora.
          </li>
          <li>
            Cada tipo explode de um jeito: {TIPOS_BOMBA.map((t) => `${NOME_BOMBA[t].toLowerCase()} atinge ${ALCANCE_BOMBA[t]}`).join('; ')}.
          </li>
          <li>Bomba presa atingida por outra explosão detona junto (reação em cadeia), mesmo com a contagem alta.</li>
          <li>Enquanto está presa, a bomba ocupa a casa e interrompe as linhas que passam por ela.</li>
          <li>
            <b>Cada aposta tem o seu tabuleiro:</b> as bombas presas numa aposta ficam esperando lá se você trocar de valor.
          </li>
          <li>
            <b>A casa leva vantagem:</b> de cada 100 moedas apostadas, voltam em média {CONFIG_BOMBAS.retornoPct}. Cerca de {CONFIG_BOMBAS.acertoPct}% dos giros pagam
            alguma coisa, e sai uma explosão a cada ~{CONFIG_BOMBAS.explosaoACada} giros. O prêmio máximo é {CONFIG_BOMBAS.premioMaxVezes.toLocaleString('pt-BR')}× a aposta.
          </li>
        </ul>
      </Secao>

      <Secao id="tickets" titulo="Tickets, Intercâmbio e cupons" emoji="🎟️">
        <ul>
          <li>Tickets são vales do jogo. Vêm de cupons e de presentes da equipe.</li>
          <li>
            Em <Link href="/intercambio" className="manual-link">Loja › Intercâmbio</Link> você troca tickets por ovos ou por um animal. A tabela de trocas aparece lá e pode
            mudar.
          </li>
          <li>Cupom é um código da equipe: digite em Ajustes › Resgatar cupom. Cada cupom vale uma vez por pessoa e pode dar tickets ou giros grátis.</li>
        </ul>
      </Secao>

      <Secao id="convites" titulo="Convidar amigos" emoji="💌">
        <Convites />
      </Secao>

      <Secao id="regras" titulo="Regras importantes" emoji="📜">
        <ul>
          <li>
            <b>Nada do jogo vale dinheiro.</b> Moedas, ovos, tickets e animais não podem ser comprados com dinheiro, nem sacados, transferidos ou trocados por
            dinheiro, PIX ou cripto.
          </li>
          <li>A equipe nunca pede pagamento. Se alguém cobrar em nome do jogo, é golpe: avise o suporte.</li>
          <li>Uma conta por pessoa. Robôs ou falhas exploradas de propósito podem levar ao bloqueio da conta.</li>
          <li>Preços, chances e regras podem mudar para manter o jogo equilibrado. Este manual mostra sempre os números atuais.</li>
        </ul>
        <div className="manual-acoes">
          <Link href="/termos" className="botao botao-secundario botao-p">
            Termos de uso
          </Link>
          <Link href="/suporte" className="botao botao-secundario botao-p">
            Falar com o suporte
          </Link>
        </div>
      </Secao>
    </div>
  );
}
