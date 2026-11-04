// Um único <svg> invisível com as <defs> de todas as áreas (gradientes, padrões, clipPaths), montado uma
// vez pelo <Provedores>. Os desenhos referenciam por id (url(#gi-...)), sem repetir defs em cada instância.
// Não use display:none aqui: o Chrome deixa de pintar gradientes vindos de um <svg> com display:none.
import { DefsAnimais } from './defs/DefsAnimais';
import { DefsCartas } from './defs/DefsCartas';
import { DefsCenario } from './defs/DefsCenario';
import { DefsIcones } from './defs/DefsIcones';
import { DefsRoda } from './defs/DefsRoda';
import { DefsUi } from './defs/DefsUi';

export function DefsArte() {
  return (
    <svg aria-hidden focusable="false" width="0" height="0" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <defs>
        <DefsAnimais />
        <DefsCartas />
        <DefsRoda />
        <DefsIcones />
        <DefsCenario />
        <DefsUi />
      </defs>
    </svg>
  );
}
