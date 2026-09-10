type CompanionBotProps = {
  attentive?: boolean;
};

export default function CompanionBot({ attentive = false }: CompanionBotProps) {
  return (
    <div
      className={`companion-bot ${attentive ? "companion-bot-attentive" : ""}`}
      aria-hidden="true"
      title="Probe"
    >
      <svg viewBox="0 0 80 88" width="64" height="70" fill="none">
        <ellipse cx="40" cy="84" rx="16" ry="3" fill="#67e8f9" opacity="0.12" />
        <path d="M28 70 L40 80 L52 70 L48 58 L32 58 Z" fill="#1c2430" stroke="#67e8f9" strokeWidth="1" />
        <rect x="24" y="40" width="32" height="20" rx="3" fill="#151b24" stroke="#4b5d73" strokeWidth="1.2" />
        <path d="M18 46 L24 50 L24 56 L18 52 Z" fill="#2d3a4a" />
        <path d="M62 46 L56 50 L56 56 L62 52 Z" fill="#2d3a4a" />
        <g className="companion-lenses">
          <polygon points="40,10 58,22 40,34 22,22" fill="#0b1220" stroke="#8b9bb0" strokeWidth="1.2" />
          <circle cx="40" cy="22" r="7" fill="#061018" stroke="#67e8f9" strokeWidth="1.6" />
          <circle className="companion-led" cx="40" cy="22" r="2.4" fill="#67e8f9" />
        </g>
        <line x1="40" y1="34" x2="40" y2="40" stroke="#67e8f9" strokeWidth="1" opacity="0.7" />
      </svg>
    </div>
  );
}
