/* Símbolo da DUO Arquitetura (arquitetura-duo.com). O original é branco, para o modo
   escuro; no modo claro entra a cópia em grafite. O CSS mostra só a do tema atual. */

interface Props {
  /** Classe com a altura do logo (a largura acompanha a proporção). */
  className?: string;
}

export default function DuoLogo({ className = "" }: Props) {
  return (
    <span className={`duo-logo ${className}`.trim()}>
      <img className="duo-logo-dark" src="/brand/duo-logo-dark.png" alt="" width={282} height={160} />
      <img className="duo-logo-light" src="/brand/duo-logo-light.png" alt="" width={282} height={160} />
    </span>
  );
}
