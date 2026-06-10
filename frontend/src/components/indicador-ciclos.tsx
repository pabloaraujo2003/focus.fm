const CICLOS_ATE_PAUSA_LONGA = 4;

// Quatro pinos como num gravador de fita: acendem conforme os ciclos
// do bloco atual avançam (4 acesos = pausa longa conquistada).
export function IndicadorCiclos({ ciclos }: { ciclos: number }) {
  const acesos = ciclos === 0 ? 0 : ((ciclos - 1) % CICLOS_ATE_PAUSA_LONGA) + 1;
  return (
    <div className="ciclos" title={`${ciclos} ciclos completados`}>
      {Array.from({ length: CICLOS_ATE_PAUSA_LONGA }, (_, i) => (
        <span key={i} className="cicloPino" data-aceso={i < acesos} />
      ))}
      <span className="ciclosTotal">{ciclos} ciclos</span>
    </div>
  );
}
