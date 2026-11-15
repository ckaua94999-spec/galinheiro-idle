// Gradientes/padrões SVG compartilhados da área "animais". Montados uma única vez na página por <DefsArte />;
// use nos desenhos com fill="url(#gi-animais-...)". Todo id DEVE começar com "gi-animais-".
// Orçamento: ≤ 44 ids no total (comuns 11 + galinha 6 + codorna 4; sobram ~6 por espécie).
import { DefsAvestruz } from '../animais/defs/DefsAvestruz';
import { DefsCodorna } from '../animais/defs/DefsCodorna';
import { DefsComuns } from '../animais/defs/DefsComuns';
import { DefsGalinha } from '../animais/defs/DefsGalinha';
import { DefsGanso } from '../animais/defs/DefsGanso';
import { DefsPato } from '../animais/defs/DefsPato';

export function DefsAnimais() {
  return (
    <>
      <DefsComuns />
      <DefsGalinha />
      <DefsCodorna />
      <DefsPato />
      <DefsGanso />
      <DefsAvestruz />
    </>
  );
}
