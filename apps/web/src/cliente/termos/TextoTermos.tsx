// Texto dos termos de uso (mesmo conteúdo na página /termos e no portão de aceite dentro do jogo).
// Mudou o texto? Suba TERMOS_VERSAO em @galinheiro/api-contract: todo membro aceita de novo ao abrir o jogo.
import { CONFIG, GALOS, formatarMoedas, retornoMedioRinhaPct } from '@galinheiro/game-core';
import { TERMOS_VERSAO } from '@galinheiro/api-contract';

const versaoLegivel = (v: string) => v.split('-').reverse().join('/');

export function TextoTermos() {
  const retornos = GALOS.map((g) => `${CONFIG.rinha.galos[g].nome} ${retornoMedioRinhaPct(g).toLocaleString('pt-BR')}%`).join(', ');
  return (
    <div className="termos-texto">
      <p>
        <b>Versão de {versaoLegivel(TERMOS_VERSAO)}.</b> Ao criar a conta ou continuar jogando, você concorda com estas regras.
      </p>

      <h2>1. O que é o Galinheiro Idle</h2>
      <p>Um jogo de entretenimento: você cuida de animais virtuais, coleta ovos, vende no mercado do jogo e coleciona.</p>

      <h2>2. Nada aqui vale dinheiro</h2>
      <ul>
        <li>Moedas, ovos, tickets, giros e animais são itens virtuais do jogo. Não têm valor em dinheiro.</li>
        <li>Não é possível comprar moedas com dinheiro, nem sacar, transferir ou trocar nada do jogo por dinheiro, PIX, criptomoeda ou qualquer bem fora do jogo.</li>
        <li>O jogo não é investimento, renda ou aplicação. Os animais &ldquo;rendem&rdquo; só moedas do jogo.</li>
        <li>A equipe nunca pede pagamento. Se alguém cobrar em nome do jogo, é golpe: avise o suporte.</li>
      </ul>

      <h2>3. Começo com a codorna e a roleta</h2>
      <p>
        A conta nova começa com uma codorna. Vendendo os ovos dela, você junta {formatarMoedas(CONFIG.roleta.liberacaoX100)} moedas e libera a
        roleta, que já vem com o primeiro giro. Depois, cada giro custa {formatarMoedas(CONFIG.roleta.custoX100)} moedas do jogo. As chances de
        cada animal ficam no botão &ldquo;Chances&rdquo; da roleta.
      </p>

      <h2>4. Rinha de galo</h2>
      <ul>
        <li>É um minijogo de aposta só com moedas do jogo. Você pode perder as moedas apostadas.</li>
        <li>A casa leva vantagem: a cada 100 moedas apostadas, voltam em média menos de 100 ({retornos}).</li>
        <li>A chance e o prêmio de cada galo aparecem antes da aposta. O resultado é sorteado no servidor; a luta só mostra esse resultado.</li>
        <li>Os galos são desenhos. O jogo não apoia nem promove rinha de animais de verdade, que é crime no Brasil.</li>
      </ul>

      <h2>5. Idade</h2>
      <p>O jogo é para maiores de 18 anos.</p>

      <h2>6. Sua conta e seus dados</h2>
      <ul>
        <li>Usamos nome, telefone e e-mail para o login, o suporte e a segurança da conta. Não vendemos seus dados.</li>
        <li>Você pode apagar a conta e todos os dados a qualquer momento em Ajustes.</li>
        <li>Uma conta por pessoa. Robôs, falhas exploradas de propósito ou abuso de convites podem levar ao bloqueio da conta.</li>
      </ul>

      <h2>7. Mudanças</h2>
      <p>
        Preços, chances e regras do jogo podem mudar para manter o equilíbrio. Quando estes termos mudarem, o jogo pede o seu aceite de
        novo antes de continuar.
      </p>

      <h2>8. Contato</h2>
      <p>Dúvidas ou problemas: Ajustes › Falar com o suporte.</p>
    </div>
  );
}
