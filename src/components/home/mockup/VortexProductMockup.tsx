import styles from './VortexProductMockup.module.css';

type IconProps = { className?: string };

function CheckIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.6 9.1 16.7 19 6.8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.4 12h17.2M12 3c2.25 2.55 3.35 5.55 3.35 9S14.25 18.45 12 21M12 3C9.75 5.55 8.65 8.55 8.65 12S9.75 18.45 12 21" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BotIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4V2.5M8 7h8a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="9.3" cy="12.7" r="1" fill="currentColor" />
      <circle cx="14.7" cy="12.7" r="1" fill="currentColor" />
      <path d="M9 16h6M9 4.5h6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m13.6 2.5-8 11.1h5l-1.1 7.9 8.9-12h-5.2l.4-7Z" fill="currentColor" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.2 4.3a3 3 0 0 0-4.1 3.1 3.4 3.4 0 0 0-1 5.8 3.5 3.5 0 0 0 2.3 5.4 3 3 0 0 0 5.6.8V5.5a3 3 0 0 0-2.8-1.2Zm5.6 0a3 3 0 0 1 4.1 3.1 3.4 3.4 0 0 1 1 5.8 3.5 3.5 0 0 1-2.3 5.4 3 3 0 0 1-5.6.8V5.5a3 3 0 0 1 2.8-1.2Z" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 9.2c1.2.15 2 .8 2.4 1.8M16 9.2c-1.2.15-2 .8-2.4 1.8M7.6 14.7c1.45-.1 2.45.45 2.9 1.55M16.4 14.7c-1.45-.1-2.45.45-2.9 1.55" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 20V13h3v7H5Zm5.5 0V8h3v12h-3ZM16 20V4h3v16h-3Z" fill="currentColor" />
    </svg>
  );
}

function VortexMark() {
  return (
    <div className={styles.brandMark} aria-label="Vortex Hub">
      <span className={styles.brandSwirl} aria-hidden="true" />
      <span className={styles.brandWord}>VORTEX</span>
      <small>HUB</small>
    </div>
  );
}

export default function VortexProductMockup() {
  return (
    <div className={styles.scene} data-vortex-mockup>
      <div className={styles.halo} aria-hidden="true" />
      <div className={styles.floorGlow} aria-hidden="true" />

      <section className={styles.browser} data-role="browser-card" aria-label="Website preview mockup">
        <div className={styles.browserChrome}>
          <div className={styles.chromeDots} aria-hidden="true">
            <span /><span /><span />
          </div>
        </div>

        <div className={styles.browserInner}>
          <div className={styles.browserNav}>
            <VortexMark />
            <nav className={styles.miniNav} aria-label="Mock navigation">
              <span>Soluții</span>
              <span>Despre noi</span>
              <span>Portofoliu</span>
              <span>Contact</span>
            </nav>
            <button className={styles.talkButton} type="button">Hai să discutăm</button>
          </div>

          <div className={styles.browserContent}>
            <div className={styles.browserCopy}>
              <h3>Branduri<br />mai puternice<br />prin <em>tehnologie.</em></h3>
              <p>Site-uri web. Automatizări AI. Rezultate reale.</p>
              <button className={styles.learnButton} type="button">Află mai multe <span>→</span></button>
            </div>

            <div className={styles.visualPanel} aria-hidden="true">
              <svg className={styles.mountainSvg} viewBox="0 0 740 420" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#16122e" />
                    <stop offset="0.5" stopColor="#24194a" />
                    <stop offset="1" stopColor="#070a19" />
                  </linearGradient>
                  <linearGradient id="mountainA" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#0a0e26" />
                    <stop offset="0.55" stopColor="#171740" />
                    <stop offset="1" stopColor="#090a16" />
                  </linearGradient>
                  <linearGradient id="mountainB" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#1e1b4d" />
                    <stop offset="1" stopColor="#090b17" />
                  </linearGradient>
                  <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#6449ff" stopOpacity="0" />
                    <stop offset="0.45" stopColor="#7553ff" stopOpacity="0.9" />
                    <stop offset="0.65" stopColor="#944fff" />
                    <stop offset="1" stopColor="#548dff" stopOpacity="0" />
                  </linearGradient>
                  <filter id="beamGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="8" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <radialGradient id="haze" cx="50%" cy="45%" r="60%">
                    <stop offset="0" stopColor="#7d63ff" stopOpacity="0.28" />
                    <stop offset="1" stopColor="#7d63ff" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <rect width="740" height="420" fill="url(#sky)" />
                <rect width="740" height="420" fill="url(#haze)" />
                <path d="M0 310 82 264 130 280 203 167 253 212 310 128 353 187 401 122 468 227 520 195 584 251 650 198 740 242V420H0Z" fill="url(#mountainA)" />
                <path d="M0 340 104 298 175 322 248 233 334 310 395 246 467 318 538 270 601 306 669 264 740 302V420H0Z" fill="url(#mountainB)" opacity="0.92" />
                <path d="M-20 362 C150 325 260 330 370 275 C474 222 542 193 760 212" fill="none" stroke="url(#beam)" strokeWidth="7" filter="url(#beamGlow)" />
                <path d="M25 384 C190 342 305 352 388 292 C475 229 551 216 750 236" fill="none" stroke="#6f51ff" strokeOpacity="0.28" strokeWidth="2" />
                <path d="M92 397 C248 361 335 373 409 309 C502 229 570 235 715 253" fill="none" stroke="#9964ff" strokeOpacity="0.18" strokeWidth="1.6" />
                <circle cx="465" cy="240" r="7" fill="#b591ff" filter="url(#beamGlow)" />
              </svg>

              <div className={styles.visualWords}>IDEI<br />SISTEME<br />REZULTATE</div>
              <div className={styles.visualRule} />
            </div>
          </div>
        </div>
      </section>

      <article className={`${styles.floatCard} ${styles.websiteCard}`} data-role="website-card">
        <div className={styles.cardHeading}>
          <span className={`${styles.iconBox} ${styles.purpleIcon}`}><GlobeIcon /></span>
          <strong>Website modern</strong>
        </div>
        <ul className={styles.checkList}>
          {['Design personalizat', 'Optimizat pentru performanță', 'Pregătit pentru creștere'].map((item) => (
            <li key={item}><span className={styles.checkDot}><CheckIcon /></span>{item}</li>
          ))}
        </ul>
      </article>

      <article className={`${styles.floatCard} ${styles.automationCard}`} data-role="automation-card">
        <div className={styles.cardHeadingDark}>
          <span className={`${styles.iconBox} ${styles.robotIcon}`}><BotIcon /></span>
          <strong>Automatizare AI</strong>
        </div>

        <div className={styles.flow}>
          <div className={styles.flowLine} aria-hidden="true" />
          <div className={styles.flowStep}>
            <span className={`${styles.flowIcon} ${styles.trigger}`}><BoltIcon /></span>
            <div><strong>Trigger</strong><small>Formular nou completat</small></div>
          </div>
          <div className={styles.flowStep}>
            <span className={`${styles.flowIcon} ${styles.process}`}><BrainIcon /></span>
            <div><strong>AI Procesează</strong><small>Analiză și clasificare</small></div>
          </div>
          <div className={styles.flowStep}>
            <span className={`${styles.flowIcon} ${styles.action}`}><CheckIcon /></span>
            <div><strong>Acțiune</strong><small>Răspuns automat + notificare</small></div>
          </div>
        </div>
      </article>

      <article className={`${styles.floatCard} ${styles.resultsCard}`} data-role="results-card">
        <div className={styles.cardHeading}>
          <span className={`${styles.iconBox} ${styles.chartIcon}`}><ChartIcon /></span>
          <strong>Rezultate reale</strong>
        </div>
        <ul className={styles.resultList}>
          <li><CheckIcon /><span>Mai mult timp<br />pentru ce contează</span></li>
          <li><CheckIcon /><span>Procese mai simple</span></li>
          <li><CheckIcon /><span>Clienți mai mulțumiți</span></li>
        </ul>
      </article>
    </div>
  );
}
