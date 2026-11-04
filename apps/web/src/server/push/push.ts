// Notificações push (Web Push + VAPID). Sem contas externas: os serviços de push dos navegadores
// aceitam chaves VAPID geradas localmente.
import webpush from 'web-push';
import type { Banco, Consulta } from '../db/banco';
import { lerOuCriarArquivoLocal } from '../auth/segredos';

const H = 3_600_000;
let vapid: { publica: string } | null | undefined;

export function configurarVapid(): { publica: string } | null {
  if (vapid !== undefined) return vapid;
  let publica = process.env.VAPID_PUBLIC_KEY;
  let privada = process.env.VAPID_PRIVATE_KEY;
  if ((!publica || !privada) && process.env.NODE_ENV !== 'production') {
    const chaves = lerOuCriarArquivoLocal('vapid.json', () => webpush.generateVAPIDKeys());
    publica = chaves.publicKey;
    privada = chaves.privateKey;
  }
  if (!publica || !privada) {
    vapid = null;
    return vapid;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:contato@galinheiro.app', publica, privada);
  vapid = { publica };
  return vapid;
}

export async function salvarAssinatura(
  c: Consulta, playerId: string, a: { endpoint: string; keys: { p256dh: string; auth: string }; fusoMin: number },
): Promise<void> {
  await c.q(
    `insert into push_assinaturas (player_id, endpoint, p256dh, auth, fuso_min)
     values ($1, $2, $3, $4, $5)
     on conflict (endpoint) do update
        set player_id = excluded.player_id, p256dh = excluded.p256dh, auth = excluded.auth, fuso_min = excluded.fuso_min`,
    [playerId, a.endpoint, a.keys.p256dh, a.keys.auth, a.fusoMin],
  );
}

export async function removerAssinatura(c: Consulta, playerId: string, endpoint: string): Promise<void> {
  await c.q('delete from push_assinaturas where player_id = $1 and endpoint = $2', [playerId, endpoint]);
}

/**
 * "Ovos prontos!": no máximo 1 por jogador a cada 20 h, entre 8 h e 22 h no fuso do aparelho,
 * e só para quem não abriu o jogo nos últimos 30 min (GDD P-09).
 */
export async function enviarNotificacoesProntas(banco: Banco, agora: number): Promise<number> {
  if (!configurarVapid()) return 0;
  const linhas = await banco.q<{
    id: string; endpoint: string; p256dh: string; auth: string; fuso_min: number; prontos: number;
  }>(
    `select pa.id, pa.endpoint, pa.p256dh, pa.auth, pa.fuso_min,
            (select count(*)::int from entities e
              where e.player_id = pa.player_id and e.status = 'ativo' and e.proximo_rendimento <= $1) as prontos
       from push_assinaturas pa
       join players p on p.id = pa.player_id
      where (pa.ultimo_envio_em is null or pa.ultimo_envio_em < $2)
        and (p.ultimo_acesso_em is null or p.ultimo_acesso_em < $3)`,
    [new Date(agora), new Date(agora - 20 * H), new Date(agora - 0.5 * H)],
  );
  let enviados = 0;
  for (const l of linhas) {
    if (l.prontos <= 0) continue;
    const horaLocal = new Date(agora + l.fuso_min * 60_000).getUTCHours();
    if (horaLocal < 8 || horaLocal >= 22) continue;
    const corpo = l.prontos === 1 ? 'Um dos seus animais botou. Venha coletar!' : `${l.prontos} animais botaram. Venha coletar!`;
    try {
      await webpush.sendNotification(
        { endpoint: l.endpoint, keys: { p256dh: l.p256dh, auth: l.auth } },
        JSON.stringify({ titulo: 'Ovos prontos! 🥚', corpo, url: '/galinheiro', tag: 'ovos-prontos' }),
        { TTL: 6 * 3600, urgency: 'normal', topic: 'ovos-prontos' },
      );
      await banco.q('update push_assinaturas set ultimo_envio_em = $2 where id = $1', [l.id, new Date(agora)]);
      enviados++;
    } catch (erro) {
      const status = (erro as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await banco.q('delete from push_assinaturas where id = $1', [l.id]);
      } else {
        console.warn('[push] falha ao enviar', status ?? erro);
      }
    }
  }
  return enviados;
}
