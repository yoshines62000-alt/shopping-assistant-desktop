/** Décor d'ambiance fixe : orbes cyan flous qui dérivent lentement derrière
 *  toute l'app (pointer-events: none). Donne la profondeur « futuriste/magique »
 *  sans gêner l'interaction. La trame blueprint vient de body (globals.css). */
export default function BackgroundFX() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      {/* Voile de vignettage pour assombrir doucement les bords */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 0%, transparent 55%, rgb(var(--c-ink) / 0.7) 100%)',
        }}
      />
    </div>
  );
}
