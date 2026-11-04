// Ícones PNG do manifest gerados no build a partir do SVG (sem depender de ferramentas de imagem).
import { ImageResponse } from 'next/og';
import { dataUri, svgIcone, svgSelo } from '../arte';

export const dynamic = 'force-static';

const ICONES: Record<string, { tamanho: number; svg: () => string }> = {
  'icone-192.png': { tamanho: 192, svg: () => svgIcone(false) },
  'icone-512.png': { tamanho: 512, svg: () => svgIcone(false) },
  'icone-maskable-512.png': { tamanho: 512, svg: () => svgIcone(true) },
  'selo-96.png': { tamanho: 96, svg: () => svgSelo() },
};

export function generateStaticParams() {
  return Object.keys(ICONES).map((arquivo) => ({ arquivo }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ arquivo: string }> }) {
  const { arquivo } = await ctx.params;
  const icone = ICONES[arquivo];
  if (!icone) return new Response('Não encontrado', { status: 404 });
  const { tamanho } = icone;
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={dataUri(icone.svg())} width={tamanho} height={tamanho} alt="" />
    ),
    { width: tamanho, height: tamanho, headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
  );
}
