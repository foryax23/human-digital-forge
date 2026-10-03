/*
 * Known booking, delivery and chat providers, detected from script sources,
 * iframe sources and links in the raw HTML (client-safe). A JavaScript widget
 * is invisible to a static text crawl, so finding its script is how deep
 * research avoids a false "no online booking" (D25).
 */

type Provider = { name: string; pattern: RegExp };

const BOOKING: Provider[] = [
  { name: "Mero", pattern: /\bmero\.ro\b/i },
  { name: "Booksy", pattern: /\bbooksy\.(com|net)\b/i },
  { name: "Fresha", pattern: /\bfresha\.com\b/i },
  { name: "Calendly", pattern: /\bcalendly\.com\b/i },
  { name: "SimplyBook.me", pattern: /\bsimplybook\.(me|it|net)\b/i },
  { name: "Setmore", pattern: /\bsetmore\.com\b/i },
  { name: "TheFork", pattern: /\bthefork\.(com|ro)\b|\blafourchette\.com\b/i },
  { name: "Cal.com", pattern: /\bcal\.com\//i },
  { name: "Acuity", pattern: /\bacuityscheduling\.com\b/i },
  { name: "Square Appointments", pattern: /\bsquareup\.com\/appointments\b/i },
  {
    name: "Microsoft Bookings",
    pattern: /\boutlook\.office365\.com\/owa\/calendar\/.*\/bookings\b/i,
  },
  {
    name: "Google Calendar",
    pattern: /\bcalendar\.app\.google\b|calendar\.google\.com\/calendar\/appointments/i,
  },
];

const DELIVERY: Provider[] = [
  { name: "Glovo", pattern: /\bglovoapp\.com\b|\bglovo\.com\b/i },
  { name: "Wolt", pattern: /\bwolt\.com\b/i },
  { name: "Bolt Food", pattern: /\bfood\.bolt\.eu\b|\bbolt\.eu\/[a-z-]*\/?food\b/i },
  { name: "Tazz", pattern: /\btazz\.ro\b/i },
];

const CHAT: Provider[] = [
  {
    name: "WhatsApp",
    pattern: /\bwa\.me\/|\bapi\.whatsapp\.com\b|\bchat\.whatsapp\.com\b|\bwhatsapp:\/\//i,
  },
  { name: "Messenger", pattern: /\bm\.me\/|xfbml\.customerchat|fb-customerchat/i },
  { name: "Tidio", pattern: /\btidio\.co\b|code\.tidio\.co/i },
  { name: "Crisp", pattern: /\bclient\.crisp\.chat\b|\$crisp/i },
  { name: "Tawk.to", pattern: /\bembed\.tawk\.to\b|\btawk\.to\b/i },
  { name: "Smartsupp", pattern: /\bsmartsuppchat\.com\b|\bsmartsupp\b/i },
  { name: "LiveChat", pattern: /\bcdn\.livechatinc\.com\b/i },
  { name: "Intercom", pattern: /\bwidget\.intercom\.io\b|\bintercomcdn\.com\b/i },
  { name: "Zendesk", pattern: /\bstatic\.zdassets\.com\b|\bzopim\b/i },
  { name: "HubSpot chat", pattern: /\bjs\.usemessages\.com\b/i },
];

/** Only attribute values that load or link something: src, data-src, href. */
function references(html: string): string {
  const out: string[] = [];
  for (const match of html.matchAll(
    /\b(?:src|data-src|href|data-href|data-url)\s*=\s*["']([^"']{4,500})["']/gi,
  )) {
    out.push(match[1]);
  }
  // Inline loaders write the widget host into a string ("//code.tidio.co/…").
  for (const match of html.matchAll(
    /["'](?:https?:)?\/\/([a-z0-9.-]+\.[a-z]{2,}\/[^"'\s]{0,120})["']/gi,
  )) {
    out.push(match[1]);
  }
  return out.join("\n");
}

function pick(providers: Provider[], haystack: string): string[] {
  return providers.filter((p) => p.pattern.test(haystack)).map((p) => p.name);
}

export function detectProviders(html: string): {
  booking: string[];
  delivery: string[];
  chat: string[];
} {
  const refs = references(html);
  const inlineCalls = /\$crisp|Tawk_API|smartsupp\(|tidioChatApi/.test(html) ? html : "";
  return {
    booking: pick(BOOKING, refs),
    delivery: pick(DELIVERY, refs),
    chat: [...new Set([...pick(CHAT, refs), ...pick(CHAT, inlineCalls)])],
  };
}

/** Analytics or advertising tags that set cookies (for the consent check). */
export function detectAnalytics(html: string): string[] {
  const found: string[] = [];
  if (
    /googletagmanager\.com\/gtag\/js|gtag\(\s*['"]config['"]|google-analytics\.com\/(analytics|ga)\.js/i.test(
      html,
    )
  ) {
    found.push("Google Analytics");
  }
  if (/googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/.test(html))
    found.push("Google Tag Manager");
  if (/connect\.facebook\.net\/[^"']*\/fbevents\.js|fbq\(\s*['"]init['"]/i.test(html))
    found.push("Meta Pixel");
  if (/static\.hotjar\.com|hotjar\.com\/c\/hotjar/i.test(html)) found.push("Hotjar");
  if (/analytics\.tiktok\.com|ttq\.load/i.test(html)) found.push("TikTok Pixel");
  if (/clarity\.ms\/tag/i.test(html)) found.push("Microsoft Clarity");
  return found;
}

/** A consent manager is present (Cookiebot, OneTrust, CookieYes, Complianz…). */
export function detectConsentManager(html: string): string[] {
  const managers: Array<[string, RegExp]> = [
    ["Cookiebot", /consent\.cookiebot\.com|Cookiebot/],
    ["OneTrust", /cdn\.cookielaw\.org|optanon/i],
    ["CookieYes", /cdn-cookieyes\.com|cookieyes/i],
    ["Complianz", /complianz/i],
    ["Cookie Notice", /cookie-notice|cn-notice/i],
    ["Iubenda", /iubenda\.com/i],
    ["Usercentrics", /usercentrics/i],
    ["Termly", /app\.termly\.io/i],
    ["CookieScript", /cookie-script\.com/i],
    ["Osano", /osano\.com/i],
    ["GDPR Cookie Consent", /cookie-law-info|cli_user_preference/i],
    ["Consent Mode", /gtag\(\s*['"]consent['"]\s*,\s*['"]default['"]/i],
  ];
  return managers.filter(([, re]) => re.test(html)).map(([name]) => name);
}
