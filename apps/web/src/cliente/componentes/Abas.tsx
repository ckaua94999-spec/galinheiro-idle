'use client';

// Abas inferiores (GDD 3.7.3) com badges. Visual estilo Clash Royale (DIRECAO_DE_ARTE 11): barra de madeira
// escura, ícones ilustrados e a aba ativa elevada numa cápsula clara que desliza entre as abas.
import { CONFIG } from '@galinheiro/game-core';
import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconeColecao, IconeGalinheiro, IconeLoja, IconeRoleta } from '../arte/Icones';
import { contarProntos } from '../derivados';
import type { Estado } from '../estado';
import { EASE, MOLA } from '../movimento';
import { useAgora } from '../relogio';
import { cx } from '../util';

export function Abas({ estado, caminhoAtivo }: { estado: Estado; /** força a aba ativa (galeria de dev) */ caminhoAtivo?: string }) {
  const caminhoRota = usePathname();
  const caminho = caminhoAtivo ?? caminhoRota;
  const agora = useAgora();
  const { capacidade, nivelGalinheiro } = estado.player;
  const cheio = estado.entidades.length >= capacidade;
  const prontos = contarProntos(estado.entidades, agora);

  const abas = [
    { href: '/galinheiro', rotulo: 'Galinheiro', Icone: IconeGalinheiro, badge: prontos > 0 ? String(prontos) : null, tut: 'aba-galinheiro' },
    {
      href: '/loja',
      rotulo: 'Loja',
      Icone: IconeLoja,
      badge: cheio && nivelGalinheiro < CONFIG.galinheiro.nivelMax ? '!' : null,
      tut: 'aba-loja',
    },
    {
      href: '/roleta',
      rotulo: 'Roleta',
      Icone: IconeRoleta,
      badge: null,
      tut: 'aba-roleta',
    },
    { href: '/colecao', rotulo: 'Coleção', Icone: IconeColecao, badge: null, tut: 'aba-colecao' },
  ];

  return (
    <nav className="abas" aria-label="Navegação principal">
      <ul className="abas-lista">
        {abas.map(({ href, rotulo, Icone, badge, tut }) => {
          const ativa = !!caminho?.startsWith(href);
          return (
            <li key={href} className="relative">
              <Link
                href={href}
                data-tut={tut}
                aria-current={ativa ? 'page' : undefined}
                aria-label={badge ? `${rotulo} (${badge === '!' ? 'novidade' : `${badge} prontos`})` : rotulo}
                className="aba"
              >
                {ativa && <motion.span layoutId="aba-ativa" className="aba-capsula" transition={MOLA.aba} aria-hidden />}
                <motion.span
                  className="aba-icone"
                  initial={false}
                  animate={ativa ? { scale: [1, 1.24, 1.14], y: -8, opacity: 1 } : { scale: 0.92, y: 0, opacity: 0.92 }}
                  transition={ativa ? { duration: 0.26, times: [0, 0.55, 1], ease: EASE.suave } : { duration: 0.18 }}
                  aria-hidden
                >
                  <Icone />
                </motion.span>
                <span className="aba-rotulo texto-contorno-fino">{rotulo}</span>
                {badge && (
                  <span className={cx('badge', badge === '!' && 'badge-pulsa')} aria-hidden>
                    {badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
