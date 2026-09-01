const HERO_BENEFITS = [
  {
    id: "setup",
    strong: "Pár óra alatt",
    rest: " telepítés, ingyenes bevezetéssel.",
    Icon: IconClock,
  },
  {
    id: "admin",
    strong: "75%-kal kevesebb",
    rest: " adminisztrációs feladat.",
    Icon: IconTrendDown,
  },
] as const;

function IconClock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 7.5V12l3 2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrendDown() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 16l6-6 4 4 6-8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 6h6v6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProGateHeroBenefits() {
  return (
    <div className="pg-hero-footer">
      <div className="pg-hero-benefits" aria-label="Előnyök">
        {HERO_BENEFITS.map(({ id, strong, rest, Icon }) => (
          <div className="pg-hero-benefit" key={id}>
            <span className="pg-hero-benefit-icon">
              <Icon />
            </span>
            <p className="pg-hero-benefit-text">
              <strong>{strong}</strong>
              {rest}
            </p>
          </div>
        ))}
      </div>

      <div className="pg-hero-curve" aria-hidden>
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path
            d="M0,48 C360,88 720,8 1080,40 C1260,56 1380,64 1440,72 L1440,80 L0,80 Z"
            fill="var(--pg-bg-alt)"
          />
        </svg>
      </div>
    </div>
  );
}
