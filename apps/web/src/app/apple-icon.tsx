// Ícone do iOS (apple-touch-icon): a composição grande, sem cantos — o iOS arredonda sozinho.
import { ImageResponse } from 'next/og';
import { dataUri, svgIcone } from './icones/arte';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={dataUri(svgIcone(false, { sangria: true }))} width={180} height={180} alt="" />
    ),
    size,
  );
}
