/* Indicador de carregamento de página: um anel girando no lugar de textos como
   "Carregando dados…". O texto continua disponível para leitores de tela. */

interface Props {
  /** O que está carregando, lido pelos leitores de tela (ex.: "Carregando contas"). */
  label?: string;
}

export default function Loading({ label = "Carregando" }: Props) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="loading-ring" aria-hidden="true" />
      <span className="sr-only">{label}…</span>
    </div>
  );
}
