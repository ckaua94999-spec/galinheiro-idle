// Textos, formatos e ações (copiar/compartilhar) do programa de convites. Regra do produto: as comissões são
// MOEDAS DO JOGO — nunca falar em dinheiro, saque ou conversão em nada que o jogador ganhe.
import { agoraServidor } from '../relogio';

/** Frase obrigatória sempre que o programa é explicado. */
export const AVISO_MOEDAS = 'As comissões são moedas do jogo: não valem dinheiro e não podem ser sacadas.';

const PCT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
/** Pontos-base → "10%" / "2,5%". */
export const porcento = (bp: number): string => `${PCT.format(bp / 100)}%`;

/** Quem fica em cada nível da rede, visto por quem convidou. */
export function quemNoNivel(nivel: number): string {
  if (nivel <= 1) return 'quem você convidou';
  if (nivel === 2) return 'quem seus convidados convidaram';
  return `quem o nível ${nivel - 1} convidou`;
}

/** "Nível 1 — quem você convidou: 10% das vendas de ovos" (leitor de tela e textos corridos). */
export const descricaoNivel = (nivel: number, bp: number): string =>
  bp > 0 ? `Nível ${nivel} — ${quemNoNivel(nivel)}: ${porcento(bp)} das vendas de ovos` : `Nível ${nivel} — ${quemNoNivel(nivel)}: sem comissão`;

// ---------------------------------------------------------------- datas (relógio do servidor, como o resto do jogo)
const HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const DIA = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const DIA_ANO = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
const chaveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function rotuloDia(d: Date, agora: Date): 'hoje' | 'ontem' | null {
  if (chaveDia(d) === chaveDia(agora)) return 'hoje';
  const ontem = new Date(agora);
  ontem.setDate(agora.getDate() - 1);
  return chaveDia(d) === chaveDia(ontem) ? 'ontem' : null;
}

const diaCurto = (d: Date, agora: Date) => (d.getFullYear() === agora.getFullYear() ? DIA : DIA_ANO).format(d);

/** Quando a comissão caiu: "agora", "há 12 min", "hoje, 14:32", "ontem, 09:10" ou "3 de out.". */
export function quando(iso: string, agoraMs: number = agoraServidor()): string {
  const d = new Date(iso);
  const diff = agoraMs - d.getTime();
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)} min`;
  const agora = new Date(agoraMs);
  const dia = rotuloDia(d, agora);
  return dia ? `${dia}, ${HORA.format(d)}` : diaCurto(d, agora);
}

/** Desde quando o convidado está no jogo: "desde hoje", "desde ontem" ou "desde 3 de out.". */
export function desde(iso: string, agoraMs: number = agoraServidor()): string {
  const d = new Date(iso);
  const agora = new Date(agoraMs);
  return `desde ${rotuloDia(d, agora) ?? diaCurto(d, agora)}`;
}

// ---------------------------------------------------------------- copiar e compartilhar

/** Copia um texto (área de transferência; sem ela — página sem HTTPS, navegador antigo — o jeito antigo). */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // permissão negada: tenta o plano B
  }
  return copiarPeloDocumento(texto);
}

/** Plano B para HTTP (IP da rede) e Safari, onde `navigator.clipboard` não existe. */
function copiarPeloDocumento(texto: string): boolean {
  try {
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.setAttribute('aria-hidden', 'true');
    // Fora da tela, mas selecionável: opacity 0 e pointer-events none fazem o iOS recusar a cópia.
    Object.assign(area.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '1px',
      height: '1px',
      padding: '0',
      border: '0',
      fontSize: '16px',
      userSelect: 'text',
      webkitUserSelect: 'text',
    });
    document.body.appendChild(area);
    const ios = /ipad|iphone|ipod/i.test(navigator.userAgent);
    if (ios) {
      area.contentEditable = 'true';
      area.readOnly = false;
      const faixa = document.createRange();
      faixa.selectNodeContents(area);
      const selecao = window.getSelection();
      selecao?.removeAllRanges();
      selecao?.addRange(faixa);
    }
    area.focus();
    area.select();
    area.setSelectionRange(0, texto.length);
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Mensagem que vai junto com o link (sem promessas de ganho: o convite é para jogar). */
export const mensagemConvite = (codigo: string): string =>
  `Vem jogar Galinheiro comigo! Cuide das galinhas, colete ovos e gire a roleta para achar bichos raros. Entre pelo meu convite (código ${codigo}):`;

export type ResultadoCompartilhar = 'compartilhado' | 'copiado' | 'cancelado' | 'falhou';

/** Abre o compartilhar do aparelho; sem ele (ou se falhar), copia a mensagem com o link. */
export async function compartilharConvite(link: string, codigo: string): Promise<ResultadoCompartilhar> {
  const texto = mensagemConvite(codigo);
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Galinheiro', text: texto, url: link });
      return 'compartilhado';
    } catch (erro) {
      // o jogador fechou a folha de compartilhar: não é erro
      if ((erro as { name?: string } | null)?.name === 'AbortError') return 'cancelado';
    }
  }
  return (await copiarTexto(`${texto}\n${link}`)) ? 'copiado' : 'falhou';
}
