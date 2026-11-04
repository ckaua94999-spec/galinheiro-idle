// Gradientes/padrões SVG compartilhados da área "ui". Montados uma única vez na página por <DefsArte />;
// use nos desenhos com fill="url(#gi-ui-...)". Todo id DEVE começar com "gi-ui-".
export function DefsUi() {
  return (
    <>
      {/* seta dourada do tutorial */}
      <linearGradient id="gi-ui-seta" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff3b0" />
        <stop offset=".45" stopColor="#ffcf3f" />
        <stop offset="1" stopColor="#e58a00" />
      </linearGradient>
    </>
  );
}
