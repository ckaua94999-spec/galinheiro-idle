'use client';

// Peças compartilhadas pelas telas de usuários do painel: avatar com iniciais, cópia para a área de
// transferência, relógio "lento" (tempos relativos), leitura de moedas digitadas ("12,50" → 1250), o
// caminho da lista com os filtros em uso (para o "voltar" da ficha) e pequenos blocos de formulário.
import type { Item } from '@galinheiro/game-core';
import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { agoraServidor } from '../../relogio';
import { toast } from '../../ui';
import { cx } from '../../util';
import { fmt } from '../ui';

/** Ações da ficha que abrem um modal. */
export type AcaoFicha =
  | { tipo: 'perfil' }
  | { tipo: 'saldo'; sentido: 'creditar' | 'debitar' }
  | { tipo: 'ovos'; item?: Item }
  | { tipo: 'nivel' }
  | { tipo: 'animal' }
  | { tipo: 'sessoes' }
  | { tipo: 'codigo' }
  | { tipo: 'bloquear' }
  | { tipo: 'desbloquear' }
  | { tipo: 'bonus-saque' }
  | { tipo: 'bonus-link' }
  | { tipo: 'bonus-geral' }
  | { tipo: 'cobranca' }
  | { tipo: 'mensagem' }
  | { tipo: 'excluir' };

/** "Ana Lima Souza" → "Ana" */
export const primeiroNome = (nome: string): string => nome.trim().split(/\s+/)[0] ?? nome;

// ---------------------------------------------------------------- avatar

const CORES_AVATAR = ['#16a34a', '#2563eb', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#ea580c', '#0f766e', '#9333ea'];

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0]?.[0] ?? '?';
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : '';
  return (primeira + ultima).toUpperCase();
}

function corDoId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return CORES_AVATAR[Math.abs(h) % CORES_AVATAR.length] ?? '#16a34a';
}

/** Bolinha com as iniciais do membro (cor fixa por conta). */
export function Avatar({ id, nome, tamanho = 'm' }: { id: string; nome: string; tamanho?: 'p' | 'm' | 'g' }) {
  return (
    <span className="adm-us-avatar" data-tamanho={tamanho} style={{ background: corDoId(id) }} aria-hidden>
      {iniciais(nome)}
    </span>
  );
}

// ---------------------------------------------------------------- utilidades

/**
 * Copia um texto e avisa com um toast (com alternativa para navegadores sem a API de área de transferência).
 * Devolve se deu certo.
 */
export async function copiar(texto: string, aviso = 'Copiado!'): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    if (!ok) {
      toast('Não deu para copiar. Selecione o texto e copie manualmente.', 'erro');
      return false;
    }
  }
  toast(aviso, 'sucesso');
  return true;
}

/** Botãozinho de copiar (e-mail, telefone, ID): mostra um ✓ por 1,5 s depois de copiar. */
export function BotaoCopiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [feito, setFeito] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className="adm-us-copiar"
      title={`Copiar ${rotulo}`}
      aria-label={`Copiar ${rotulo}`}
      onClick={async () => {
        if (!(await copiar(texto, `${rotulo.charAt(0).toUpperCase()}${rotulo.slice(1)} copiado`))) return;
        setFeito(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setFeito(false), 1500);
      }}
    >
      {feito ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
    </button>
  );
}

/** Último acesso relativo com bolinha: verde (< 24 h), âmbar (< 7 dias), cinza (mais antigo ou nunca). */
export function UltimoAcesso({ iso, agora }: { iso: string | null; agora: number }) {
  const horas = iso ? (agora - Date.parse(iso)) / 3_600_000 : Infinity;
  const tom = horas < 24 ? 'verde' : horas < 24 * 7 ? 'ambar' : 'cinza';
  return (
    <span className="adm-us-acesso" data-tom={tom} title={iso ? `Último acesso: ${fmt.dataHora(iso)}` : 'Nunca entrou no jogo'}>
      {iso ? fmt.relativo(iso, agora) : 'nunca'}
    </span>
  );
}

/** Hora do servidor, atualizada de tempos em tempos (tempos relativos e próximos rendimentos). */
export function useAgoraLento(intervaloMs = 30_000): number {
  const [agora, setAgora] = useState(() => agoraServidor());
  useEffect(() => {
    setAgora(agoraServidor());
    const t = window.setInterval(() => setAgora(agoraServidor()), intervaloMs);
    return () => window.clearInterval(t);
  }, [intervaloMs]);
  return agora;
}

/**
 * Moedas digitadas em reais do jogo → centavos. Aceita "12,50", "12,5", "1.234,56", "12.50" e "1234".
 * Devolve null se não for um número válido (letras, mais de 2 casas decimais, vazio).
 */
export function lerMoedas(texto: string): number | null {
  const t = texto.trim().replace(/\s/g, '');
  if (!t) return null;
  let inteiro: string;
  let fracao = '';
  if (t.includes(',')) {
    const partes = t.split(',');
    if (partes.length > 2) return null;
    inteiro = (partes[0] ?? '').replace(/\./g, '');
    fracao = partes[1] ?? '';
  } else {
    const partes = t.split('.');
    const ultima = partes[partes.length - 1] ?? '';
    // "12.50" (ponto decimal) × "1.234" (separador de milhar)
    if (partes.length > 1 && ultima.length <= 2) {
      fracao = ultima;
      inteiro = partes.slice(0, -1).join('');
    } else {
      inteiro = partes.join('');
    }
  }
  if (!/^\d*$/.test(inteiro) || !/^\d{0,2}$/.test(fracao) || (!inteiro && !fracao)) return null;
  return Number(inteiro || '0') * 100 + Number(fracao.padEnd(2, '0'));
}

/** Só dígitos (quantidades inteiras). */
export const soDigitos = (texto: string, max = 7): string => texto.replace(/\D/g, '').slice(0, max);

// ---------------------------------------------------------------- caminho da lista

const CHAVE_LISTA = 'gi-admin-usuarios-lista';

/** Guarda a busca/filtros da lista para o "voltar" da ficha devolver o admin ao mesmo lugar. */
export function lembrarLista(busca: string): void {
  try {
    sessionStorage.setItem(CHAVE_LISTA, busca);
  } catch {
    // modo privado/armazenamento bloqueado: o voltar só perde os filtros
  }
}

export function caminhoDaLista(): string {
  try {
    const busca = sessionStorage.getItem(CHAVE_LISTA);
    return busca ? `/admin/usuarios?${busca}` : '/admin/usuarios';
  } catch {
    return '/admin/usuarios';
  }
}

/** Caminho da lista (com os filtros da última visita), resolvido só no navegador para não divergir da hidratação. */
export function useCaminhoDaLista(): string {
  const [caminho, setCaminho] = useState('/admin/usuarios');
  useEffect(() => setCaminho(caminhoDaLista()), []);
  return caminho;
}

// ---------------------------------------------------------------- blocos de formulário dos modais

/** Caixa de aviso dentro dos modais e cartões. */
export function Alerta({ tom = 'ambar', icone, children, className }: {
  tom?: 'ambar' | 'vermelho' | 'azul' | 'verde';
  icone?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('adm-us-alerta', className)} data-tom={tom}>
      {icone && (
        <span className="adm-us-alerta-icone" aria-hidden>
          {icone}
        </span>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Sugestões rápidas de motivo (tocar preenche o campo). */
export function SugestoesMotivo({ opcoes, aoEscolher }: { opcoes: string[]; aoEscolher: (m: string) => void }) {
  return (
    <div className="adm-us-sugestoes" aria-label="Sugestões de motivo">
      {opcoes.map((o) => (
        <button key={o} type="button" className="adm-us-sugestao" onClick={() => aoEscolher(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

/** Controle segmentado (ex.: Creditar | Debitar). */
export function Segmentos<T extends string>({ valor, opcoes, aoMudar, rotulo }: {
  valor: T;
  opcoes: { valor: T; rotulo: ReactNode; tom?: 'verde' | 'vermelho' }[];
  aoMudar: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div className="adm-us-segmentos" role="radiogroup" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          data-tom={o.tom}
          className="adm-us-segmento"
          onClick={() => aoMudar(o.valor)}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Rodapé padrão dos modais: Cancelar + ação principal. */
export function AcoesModal({ children }: { children: ReactNode }) {
  return <div className="adm-us-modal-acoes">{children}</div>;
}

/** Mensagem de erro da API dentro do modal. */
export function ErroModal({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <p className="adm-us-erro" role="alert">
      {texto}
    </p>
  );
}

/** "1 animal" / "3 animais". */
export const plural = (n: number, um: string, varios: string): string => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;
