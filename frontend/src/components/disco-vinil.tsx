// Disco de vinil em CSS puro: sulcos via repeating-radial-gradient,
// brilho de luz de estúdio, selo central na cor do estado. Gira
// enquanto a sessão está ativa (animation-play-state via data-attr).
export function DiscoVinil({ girando }: { girando: boolean }) {
  return (
    <div className="vinilPalco" aria-hidden="true">
      <div className="vinil" data-girando={girando}>
        <div className="vinilSelo">
          <span className="vinilFuro" />
        </div>
      </div>
      <div className="vinilHalo" />
    </div>
  );
}
