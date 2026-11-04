// Registro das cenas da abertura. A oficial é a CenaA ("pôr do sol cinematográfico", vencedora do concurso
// de variantes, com as melhores ideias das outras enxertadas). Em desenvolvimento, /entrar?cena=<nome>
// escolhe a cena (comparação com a clássica antiga).
import type { ComponentType } from 'react';
import { CenaA } from './cena-a';
import { CenaClassica } from './CenaClassica';
import type { PropsCena } from './tipos';

export const CENAS: Record<string, ComponentType<PropsCena>> = { classica: CenaClassica, a: CenaA };
export const CENA_PADRAO: ComponentType<PropsCena> = CenaA;
