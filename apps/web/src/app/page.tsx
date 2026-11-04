import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { temCookieDeSessao } from '@/server/auth/sessao';

/** Raiz: quem já tem sessão vai direto ao galinheiro; quem não tem, para a tela de entrada. */
export default async function Inicio() {
  const temSessao = temCookieDeSessao(await cookies());
  redirect(temSessao ? '/galinheiro' : '/entrar');
}
