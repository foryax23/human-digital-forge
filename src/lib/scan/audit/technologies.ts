import type { DetectedTechnology } from "@/lib/scan/types";

import type { TechMatch } from "./model";

/**
 * Vortex Scan's own technology fingerprints (written from public markers each
 * product leaves in pages, scripts, headers and cookies — no third-party
 * rule sets). Confidence: header/script/meta/cookie hits 0.95, HTML-only hits
 * 0.75 (+0.1 per extra pattern), implied technologies 0.7.
 */

type Category = DetectedTechnology["category"];

type TechRule = {
  name: string;
  category: Category;
  /** Raw HTML of every analysed page. */
  html?: RegExp[];
  /** Script src URLs. */
  scripts?: RegExp[];
  /** [header name, value pattern]. */
  headers?: Array<[string, RegExp]>;
  /** Cookie names from Set-Cookie. */
  cookies?: RegExp[];
  /** <meta name="generator"> contents. */
  generator?: RegExp;
  /** Capture group 1 = version, tried on generator, scripts then HTML. */
  version?: RegExp[];
  implies?: string[];
};

export type TechInput = {
  html: string;
  scriptSrcs: string[];
  headers: Headers;
  cookies: string[];
  generators: string[];
};

const RULES: TechRule[] = [
  /* ---------------------------------------------------------------- CMS */
  {
    name: "WordPress",
    category: "cms",
    html: [/\/wp-content\//i, /\/wp-includes\//i, /<link[^>]+https?:\/\/api\.w\.org\//i],
    generator: /^WordPress/i,
    version: [
      /^WordPress\s+(\d+\.\d+(?:\.\d+)?)/i,
      /wp-emoji-release\.min\.js\?ver=(\d+\.\d+(?:\.\d+)?)/i,
      /\/wp-includes\/css\/dist\/block-library\/style\.min\.css\?ver=(\d+\.\d+(?:\.\d+)?)/i,
    ],
  },
  {
    name: "Joomla",
    category: "cms",
    html: [/\/media\/jui\//i, /\/components\/com_[a-z]+/i, /joomla-script-options/i],
    generator: /^Joomla/i,
  },
  {
    name: "Drupal",
    category: "cms",
    html: [/\/sites\/(default|all)\/(files|themes|modules)\//i, /drupal-settings-json/i],
    headers: [
      ["x-generator", /Drupal/i],
      ["x-drupal-cache", /./],
    ],
    generator: /^Drupal/i,
  },
  /* ----------------------------------------------------------- builders */
  {
    name: "Elementor",
    category: "builder",
    html: [/elementor-frontend/i, /\/plugins\/elementor\//i, /class="[^"]*elementor-section/i],
    implies: ["WordPress"],
  },
  {
    name: "Divi",
    category: "builder",
    html: [/\/themes\/Divi\//i, /\bet_pb_(section|row|module)/i, /et-divi-/i],
    implies: ["WordPress"],
  },
  {
    name: "WPBakery",
    category: "builder",
    html: [/\/plugins\/js_composer\//i, /\bvc_row\b/i],
    implies: ["WordPress"],
  },
  {
    name: "Wix",
    category: "builder",
    html: [/static\.parastorage\.com/i, /static\.wixstatic\.com/i, /wix-bi-session/i],
    headers: [["x-wix-request-id", /./]],
    generator: /Wix\.com/i,
  },
  {
    name: "Squarespace",
    category: "builder",
    html: [/static1\.squarespace\.com/i, /Static\.SQUARESPACE_CONTEXT/i],
    generator: /Squarespace/i,
  },
  {
    name: "Webflow",
    category: "builder",
    html: [/data-wf-page=/i, /data-wf-site=/i, /(assets|cdn\.prod)\.website-files\.com/i],
    generator: /Webflow/i,
  },
  {
    name: "Framer",
    category: "builder",
    html: [/framerusercontent\.com/i, /data-framer-/i],
    generator: /Framer/i,
  },
  {
    name: "Tilda",
    category: "builder",
    html: [/tildacdn\.(com|net)/i],
  },
  {
    name: "GoDaddy Website Builder",
    category: "builder",
    html: [/img1\.wsimg\.com/i],
    generator: /Go Daddy Website Builder|Starfield Technologies/i,
  },
  {
    name: "Hostinger Website Builder",
    category: "builder",
    html: [/zyrosite\.com/i, /userapp\.zyrosite/i],
    generator: /Hostinger Website Builder|Zyro/i,
  },
  {
    name: "Lovable",
    category: "builder",
    html: [
      /cdn\.gpteng\.co\/gptengineer\.js/i,
      /lovable\.dev\/opengraph-image/i,
      /lovable-uploads\//i,
    ],
    scripts: [/gpteng\.co/i],
  },
  /* -------------------------------------------------------- e-commerce */
  {
    name: "WooCommerce",
    category: "ecommerce",
    // Class names alone aren't enough: many themes ship WooCommerce CSS without the plugin.
    html: [/\/plugins\/woocommerce\//i, /wc-ajax=/i, /woocommerce_params|wc_add_to_cart_params/i],
    cookies: [/^woocommerce_/i, /^wp_woocommerce_session/i],
    implies: ["WordPress"],
  },
  {
    name: "Shopify",
    category: "ecommerce",
    html: [/cdn\.shopify\.com/i, /Shopify\.theme/i, /\.myshopify\.com/i],
    headers: [
      ["x-shopify-stage", /./],
      ["x-shopid", /./],
      ["powered-by", /Shopify/i],
    ],
    cookies: [/^_shopify_/i],
  },
  {
    name: "Gomag",
    category: "ecommerce",
    html: [/gomagcdn\.ro/i, /\bgomag\.ro\b/i, /Platforma eCommerce Gomag/i],
  },
  {
    name: "MerchantPro",
    category: "ecommerce",
    html: [/merchantpro\.(com|ro)/i, /Powered by MerchantPro/i, /\bMPConfig\b/],
  },
  {
    name: "Shoptet",
    category: "ecommerce",
    html: [/cdn\.myshoptet\.com/i, /\bshoptet\b/i],
  },
  {
    name: "PrestaShop",
    category: "ecommerce",
    html: [/\bprestashop\b\s*=\s*\{/i, /\/modules\/ps_[a-z]+\//i, /var prestashop/i],
    cookies: [/^PrestaShop-/i],
    generator: /PrestaShop/i,
  },
  {
    name: "OpenCart",
    category: "ecommerce",
    html: [
      /catalog\/view\/(theme|javascript)\//i,
      /index\.php\?route=(product|common|checkout)\//i,
    ],
    cookies: [/^OCSESSID$/i],
  },
  {
    name: "Magento",
    category: "ecommerce",
    html: [/\/static\/version\d+\/frontend\//i, /Magento_[A-Za-z]+\//, /\bmage\/cookies/i],
    headers: [["x-magento-tags", /./]],
    cookies: [/^(mage-cache-storage|mage-translation-storage|X-Magento-Vary)/i],
  },
  /* -------------------------------------------------------- frameworks */
  {
    name: "Next.js",
    category: "framework",
    html: [/__NEXT_DATA__/, /\/_next\/static\//],
    headers: [["x-powered-by", /Next\.js/i]],
    implies: ["React"],
  },
  {
    name: "Nuxt",
    category: "framework",
    html: [/window\.__NUXT__/, /\/_nuxt\//],
    implies: ["Vue"],
  },
  { name: "Gatsby", category: "framework", html: [/id="___gatsby"/], implies: ["React"] },
  { name: "Astro", category: "framework", html: [/<astro-island/i, /data-astro-cid-/i] },
  { name: "Angular", category: "framework", html: [/\bng-version="/] },
  { name: "SvelteKit", category: "framework", html: [/__sveltekit_/, /data-sveltekit-/] },
  {
    name: "TanStack Start",
    category: "framework",
    html: [/\$_TSR\b/, /__TSR_SSR__/, /tsr-scripts/i],
    implies: ["React"],
  },
  {
    name: "React",
    category: "framework",
    html: [/data-reactroot/i, /react-dom(\.production)?(\.min)?\.js/i, /__react_router/i],
  },
  {
    name: "Vue",
    category: "framework",
    html: [
      /\bdata-v-[0-9a-f]{8}\b/,
      /vue(\.runtime)?(\.global)?(\.prod)?(\.min)?\.js/i,
      /data-server-rendered="true"/,
    ],
  },
  {
    name: "jQuery",
    category: "framework",
    scripts: [/\/jquery(-\d+\.\d+(\.\d+)?)?(\.min)?\.js/i, /\/jquery\/(\d+\.\d+(\.\d+)?)\/jquery/i],
    version: [
      /\/jquery-(\d+\.\d+(?:\.\d+)?)(?:\.slim)?(?:\.min)?\.js/i,
      /\/jquery\/(\d+\.\d+(?:\.\d+)?)\/jquery(?:\.slim)?(?:\.min)?\.js/i,
      /\/jquery(?:\.min)?\.js\?ver=(\d+\.\d+(?:\.\d+)?)/i,
    ],
  },
  {
    name: "Bootstrap",
    category: "framework",
    scripts: [/bootstrap(\.bundle)?(\.min)?\.js/i],
    html: [/bootstrap(\.min)?\.css/i],
  },
  /* --------------------------------------------------------- analytics */
  {
    name: "Google Analytics 4",
    category: "analytics",
    scripts: [/googletagmanager\.com\/gtag\/js\?id=G-/i],
    html: [/gtag\(\s*['"]config['"]\s*,\s*['"]G-[A-Z0-9]+/i],
  },
  {
    name: "Universal Analytics",
    category: "analytics",
    scripts: [
      /google-analytics\.com\/(analytics|ga)\.js/i,
      /googletagmanager\.com\/gtag\/js\?id=UA-/i,
    ],
    html: [/['"]UA-\d{4,10}-\d{1,4}['"]/],
  },
  {
    name: "Google Tag Manager",
    category: "analytics",
    scripts: [/googletagmanager\.com\/gtm\.js/i],
    html: [/googletagmanager\.com\/gtm\.js/i, /['"]GTM-[A-Z0-9]{4,9}['"]/],
  },
  {
    name: "Hotjar",
    category: "analytics",
    scripts: [/static\.hotjar\.com/i],
    html: [/static\.hotjar\.com/i, /_hjSettings/],
  },
  {
    name: "Microsoft Clarity",
    category: "analytics",
    scripts: [/clarity\.ms\/tag/i],
    html: [/clarity\.ms\/tag/i],
  },
  { name: "Plausible", category: "analytics", scripts: [/plausible\.io\/js/i] },
  {
    name: "Matomo",
    category: "analytics",
    scripts: [/matomo\.js|piwik\.js/i],
    html: [/_paq\.push/],
  },
  {
    name: "Yandex Metrica",
    category: "analytics",
    scripts: [/mc\.yandex\.ru\/metrika/i],
    html: [/mc\.yandex\.ru\/metrika/i],
  },
  {
    name: "Cloudflare Web Analytics",
    category: "analytics",
    scripts: [/static\.cloudflareinsights\.com\/beacon/i],
  },
  { name: "Vercel Analytics", category: "analytics", scripts: [/\/_vercel\/insights\//i] },
  {
    name: "Lovable Analytics",
    category: "analytics",
    scripts: [/\/~flock\.js/i],
    html: [/data-proxy-url=["']\/~api\/analytics/i],
  },
  /* --------------------------------------------------------- marketing */
  {
    name: "Meta Pixel",
    category: "marketing",
    scripts: [/connect\.facebook\.net\/[a-z_A-Z]+\/fbevents\.js/i],
    html: [
      /fbq\(\s*['"]init['"]/,
      /connect\.facebook\.net\/[a-z_A-Z]+\/fbevents\.js/i,
      /facebook\.com\/tr\?id=/i,
    ],
  },
  {
    name: "TikTok Pixel",
    category: "marketing",
    scripts: [/analytics\.tiktok\.com/i],
    html: [/analytics\.tiktok\.com\/i18n\/pixel/i, /ttq\.load\(/],
  },
  {
    name: "Google Ads",
    category: "marketing",
    scripts: [
      /googletagmanager\.com\/gtag\/js\?id=AW-/i,
      /googleadservices\.com\/pagead\/conversion/i,
    ],
    html: [/['"]AW-\d{6,12}['"]/, /googleadservices\.com\/pagead\/conversion/i],
  },
  {
    name: "LinkedIn Insight Tag",
    category: "marketing",
    scripts: [/snap\.licdn\.com/i],
    html: [/_linkedin_partner_id/],
  },
  {
    name: "Pinterest Tag",
    category: "marketing",
    scripts: [/s\.pinimg\.com\/ct\/core\.js/i],
    html: [/pintrk\(\s*['"]load/],
  },
  {
    name: "Microsoft Advertising",
    category: "marketing",
    scripts: [/bat\.bing\.com\/bat\.js/i],
    html: [/bat\.bing\.com\/bat\.js/i],
  },
  {
    name: "HubSpot",
    category: "marketing",
    scripts: [/js\.hs-scripts\.com|js\.hsforms\.net|js\.hs-analytics\.net/i],
  },
  {
    name: "Mailchimp",
    category: "marketing",
    html: [/list-manage\.com\/subscribe/i, /chimpstatic\.com/i, /\bmc4wp\b/i],
  },
  {
    name: "Brevo",
    category: "marketing",
    html: [/sibforms\.com/i, /sib-form/i],
    scripts: [/sendinblue|brevo\.com/i],
  },
  {
    name: "MailerLite",
    category: "marketing",
    scripts: [/mailerlite\.com/i],
    html: [/ml-form-embed/i],
  },
  { name: "Klaviyo", category: "marketing", scripts: [/static\.klaviyo\.com/i] },
  {
    name: "Newsman",
    category: "marketing",
    scripts: [/newsman\.(app|ro)/i],
    html: [/retargeting\.newsmanapp\.com|newsman\.app/i],
  },
  { name: "2Performant", category: "marketing", html: [/2performant\.com/i] },
  { name: "Profitshare", category: "marketing", html: [/profitshare\.ro/i] },
  /* ----------------------------------------------------------- consent */
  {
    name: "Cookiebot",
    category: "consent",
    scripts: [/consent\.cookiebot\.(com|eu)/i],
    html: [/consent\.cookiebot\.(com|eu)/i],
  },
  {
    name: "CookieYes",
    category: "consent",
    scripts: [/cdn-cookieyes\.com/i],
    html: [/cky-consent/i, /cookie-law-info/i],
  },
  { name: "Complianz", category: "consent", html: [/\bcmplz[-_]/i, /\/plugins\/complianz/i] },
  {
    name: "OneTrust",
    category: "consent",
    scripts: [/cdn\.cookielaw\.org|optanon/i],
    html: [/otSDKStub|optanon-category/i],
  },
  {
    name: "Iubenda",
    category: "consent",
    scripts: [/cdn\.iubenda\.com/i],
    html: [/_iub\.csConfiguration/],
  },
  { name: "Termly", category: "consent", scripts: [/app\.termly\.io/i] },
  { name: "Usercentrics", category: "consent", scripts: [/usercentrics\.eu/i] },
  {
    name: "Didomi",
    category: "consent",
    scripts: [/sdk\.privacy-center\.org/i],
    html: [/didomiConfig/],
  },
  { name: "Axeptio", category: "consent", scripts: [/axept\.io/i] },
  { name: "Borlabs Cookie", category: "consent", html: [/BorlabsCookie|borlabs-cookie/i] },
  { name: "Real Cookie Banner", category: "consent", html: [/real-cookie-banner/i] },
  {
    name: "Cookie Notice",
    category: "consent",
    html: [/id="cookie-notice"/i, /cookie-notice-js/i],
  },
  { name: "GDPR Cookie Compliance", category: "consent", html: [/moove_gdpr/i] },
  { name: "CookieFirst", category: "consent", scripts: [/consent\.cookiefirst\.com/i] },
  {
    name: "CookieScript",
    category: "consent",
    scripts: [/cdn\.cookie-script\.com/i],
    html: [/cdn\.cookie-script\.com/i],
  },
  {
    name: "Cookie banner",
    category: "consent",
    html: [
      /data-cookieconsent=/i,
      /(id|class)=["'][^"']*\b(cookie-?banner|cookie-?consent|cookies-?banner|cookie-?bar|gdpr-?banner|cc-window|cookie-popup)\b/i,
    ],
  },
  { name: "Klaro", category: "consent", html: [/klaro(\.min)?\.js|klaroConfig/i] },
  {
    name: "Osano Cookie Consent",
    category: "consent",
    html: [/cookieconsent(\.min)?\.js/i, /window\.cookieconsent\.initialise/],
  },
  /* -------------------------------------------------------------- chat */
  { name: "Tawk.to", category: "chat", scripts: [/embed\.tawk\.to/i], html: [/embed\.tawk\.to/i] },
  { name: "Tidio", category: "chat", scripts: [/code\.tidio\.co/i], html: [/code\.tidio\.co/i] },
  {
    name: "Intercom",
    category: "chat",
    scripts: [/widget\.intercom\.io|js\.intercomcdn\.com/i],
    html: [/intercomSettings/],
  },
  {
    name: "Crisp",
    category: "chat",
    scripts: [/client\.crisp\.chat/i],
    html: [/CRISP_WEBSITE_ID/],
  },
  {
    name: "Zendesk Chat",
    category: "chat",
    scripts: [/static\.zdassets\.com|zopim/i],
    html: [/id="ze-snippet"/i],
  },
  {
    name: "LiveChat",
    category: "chat",
    scripts: [/cdn\.livechatinc\.com/i],
    html: [/__lc\.license/],
  },
  { name: "Smartsupp", category: "chat", scripts: [/smartsuppchat\.com/i], html: [/smartsupp/i] },
  { name: "JivoChat", category: "chat", scripts: [/code\.jivosite\.com|code\.jivo\.ru/i] },
  { name: "Drift", category: "chat", scripts: [/js\.driftt\.com/i] },
  { name: "Freshchat", category: "chat", scripts: [/wchat\.freshchat\.com/i] },
  {
    name: "Messenger chat",
    category: "chat",
    html: [/class="fb-customerchat"/i, /xfbml\.customerchat/i],
  },
  {
    name: "WhatsApp chat widget",
    category: "chat",
    html: [
      /\bjoinchat\b/i,
      /ht-ctc|click-to-chat/i,
      /static\.getbutton\.io/i,
      /wa-chat-box|whatsapp-chat-widget|qlwapp/i,
      /\bwati\.io\b/i,
    ],
  },
  /* ----------------------------------------------------------- booking */
  {
    name: "Calendly",
    category: "booking",
    html: [/calendly\.com\/[a-z0-9_-]+/i],
    scripts: [/assets\.calendly\.com/i],
  },
  {
    name: "Booksy",
    category: "booking",
    html: [/booksy\.com\/[a-z]{2}-[a-z]{2}\//i, /booksy\.com\/widget/i],
  },
  {
    name: "Fresha",
    category: "booking",
    html: [/fresha\.com\/(a|book-now|providers)\//i, /widget\.fresha\.com/i],
  },
  { name: "SimplyBook.me", category: "booking", html: [/simplybook\.(me|it|net|asia)/i] },
  { name: "Planyo", category: "booking", html: [/planyo\.com/i] },
  { name: "Setmore", category: "booking", html: [/setmore\.com/i] },
  { name: "Acuity Scheduling", category: "booking", html: [/acuityscheduling\.com|as\.me\//i] },
  { name: "Cal.com", category: "booking", html: [/app\.cal\.com|cal\.com\/embed/i] },
  {
    name: "Amelia",
    category: "booking",
    html: [/ameliabooking|wpamelia/i],
    implies: ["WordPress"],
  },
  {
    name: "Bookly",
    category: "booking",
    html: [/bookly-(form|js)|\/plugins\/bookly/i],
    implies: ["WordPress"],
  },
  { name: "LatePoint", category: "booking", html: [/latepoint/i], implies: ["WordPress"] },
  {
    name: "OpenTable",
    category: "booking",
    html: [/opentable\.(com|co\.uk|de)\/(widget|restref|r\/)/i],
  },
  { name: "TheFork", category: "booking", html: [/thefork\.(com|ro|fr|it)|lafourchette\.com/i] },
  { name: "Treatwell", category: "booking", html: [/treatwell\.(ro|com|co\.uk|de)/i] },
  {
    name: "Docplanner",
    category: "booking",
    html: [/docplanner\.com|widget\.docplanner|znanylekarz/i],
  },
  {
    name: "Google Calendar booking",
    category: "booking",
    html: [/calendar\.app\.google\/|calendar\.google\.com\/calendar\/appointments/i],
  },
  {
    name: "Microsoft Bookings",
    category: "booking",
    html: [/outlook\.office365\.com\/(owa|book)\/[^"']*bookings/i],
  },
  /* ---------------------------------------------------------- payments */
  {
    name: "Netopia Payments",
    category: "payments",
    html: [/netopia-payments\.com|netopia\.ro|secure\.netopia/i],
  },
  { name: "mobilPay", category: "payments", html: [/mobilpay\.ro/i] },
  { name: "EuPlătesc", category: "payments", html: [/euplatesc\.ro/i] },
  {
    name: "Stripe",
    category: "payments",
    scripts: [/js\.stripe\.com/i],
    html: [/js\.stripe\.com|checkout\.stripe\.com|buy\.stripe\.com/i],
  },
  { name: "PayU", category: "payments", html: [/secure\.payu\.(ro|com)|\bpayu\.ro\b/i] },
  { name: "PayPal", category: "payments", scripts: [/paypal\.com\/sdk\/js|paypalobjects\.com/i] },
  { name: "Twispay", category: "payments", html: [/twispay\.com/i] },
  { name: "LibraPay", category: "payments", html: [/librapay\.ro/i] },
  /* --------------------------------------------------- hosting & CDN */
  {
    name: "Cloudflare",
    category: "hosting",
    headers: [
      ["cf-ray", /./],
      ["server", /cloudflare/i],
    ],
  },
  {
    name: "Hostinger",
    category: "hosting",
    headers: [
      ["platform", /hostinger/i],
      ["x-hcdn-request-id", /./],
      ["panel", /hpanel/i],
    ],
  },
  {
    name: "RoHost",
    category: "hosting",
    headers: [
      ["server", /rohost/i],
      ["x-powered-by", /rohost/i],
      ["x-hosted-by", /rohost/i],
    ],
  },
  {
    name: "Vercel",
    category: "hosting",
    headers: [
      ["x-vercel-id", /./],
      ["server", /^Vercel/i],
    ],
  },
  {
    name: "Netlify",
    category: "hosting",
    headers: [
      ["x-nf-request-id", /./],
      ["server", /^Netlify/i],
    ],
  },
  { name: "GitHub Pages", category: "hosting", headers: [["server", /^GitHub\.com/i]] },
  { name: "Amazon CloudFront", category: "hosting", headers: [["x-amz-cf-id", /./]] },
  { name: "Kinsta", category: "hosting", headers: [["x-kinsta-cache", /./]] },
  {
    name: "WP Engine",
    category: "hosting",
    headers: [
      ["wpe-backend", /./],
      ["x-powered-by", /WP Engine/i],
    ],
  },
  {
    name: "SiteGround",
    category: "hosting",
    headers: [
      ["host-header", /^[a-f0-9]{32}$|siteground/i],
      ["x-sg-cache", /./],
    ],
  },
  {
    name: "LiteSpeed",
    category: "hosting",
    headers: [
      ["server", /LiteSpeed/i],
      ["x-litespeed-cache", /./],
    ],
  },
  { name: "Nginx", category: "hosting", headers: [["server", /^nginx/i]] },
  { name: "Apache", category: "hosting", headers: [["server", /^Apache/i]] },
  /* -------------------------------------------------------------- other */
  {
    name: "WPML",
    category: "other",
    html: [/\/plugins\/sitepress-multilingual-cms\/|wpml-ls/i],
    implies: ["WordPress"],
  },
  {
    name: "Polylang",
    category: "other",
    html: [/\/plugins\/polylang\/|pll-switcher|lang-item-/i],
    implies: ["WordPress"],
  },
  {
    name: "TranslatePress",
    category: "other",
    html: [/translatepress|trp-language-switcher/i],
    implies: ["WordPress"],
  },
  { name: "Weglot", category: "other", scripts: [/cdn\.weglot\.com/i] },
  {
    name: "GTranslate",
    category: "other",
    html: [/gtranslate|translate\.google\.com\/translate_a\/element/i],
  },
  {
    name: "Google reCAPTCHA",
    category: "other",
    scripts: [/google\.com\/recaptcha|recaptcha\/api\.js/i],
  },
  {
    name: "Google Maps",
    category: "other",
    html: [/maps\.googleapis\.com\/maps\/api|google\.com\/maps\/embed/i],
  },
  { name: "Trustindex", category: "other", html: [/cdn\.trustindex\.io|trustindex\.io\/loader/i] },
  { name: "Elfsight", category: "other", scripts: [/elfsightcdn\.com|apps\.elfsight\.com/i] },
  { name: "Trustpilot", category: "other", scripts: [/widget\.trustpilot\.com/i] },
];

function headerMatch(headers: Headers, [name, pattern]: [string, RegExp]): string | null {
  const value = headers.get(name);
  return value !== null && pattern.test(value) ? `${name}: ${value.slice(0, 60)}` : null;
}

function findVersion(rule: TechRule, input: TechInput): string | undefined {
  for (const pattern of rule.version ?? []) {
    for (const source of [
      ...input.generators,
      ...input.scriptSrcs.filter((src) => !/migrate|jquery-ui|jquery\.ui/i.test(src)),
      input.html,
    ]) {
      const match = pattern.exec(source);
      if (match?.[1]) return match[1];
    }
  }
  return undefined;
}

export function detectTechnologies(input: TechInput): TechMatch[] {
  const found = new Map<string, TechMatch>();

  for (const rule of RULES) {
    let strong: string | null = null;
    for (const pair of rule.headers ?? []) strong ??= headerMatch(input.headers, pair);
    if (!strong && rule.generator) {
      const generator = input.generators.find((value) => rule.generator!.test(value));
      if (generator) strong = `generator: ${generator}`;
    }
    if (!strong && rule.scripts) {
      const src = input.scriptSrcs.find((value) => rule.scripts!.some((p) => p.test(value)));
      if (src) strong = `script: ${src.replace(/^https?:\/\//, "").slice(0, 80)}`;
    }
    if (!strong && rule.cookies) {
      const cookie = input.cookies.find((value) => rule.cookies!.some((p) => p.test(value)));
      if (cookie) strong = `cookie: ${cookie}`;
    }
    const htmlHits = (rule.html ?? []).filter((pattern) => pattern.test(input.html));
    if (!strong && !htmlHits.length) continue;

    const confidence = strong ? 0.95 : Math.min(0.95, 0.75 + 0.1 * (htmlHits.length - 1));
    const evidence = strong ?? `html: ${htmlHits[0].source.replace(/\\/g, "").slice(0, 50)}`;
    found.set(rule.name, {
      name: rule.name,
      category: rule.category,
      confidence: Number(confidence.toFixed(2)),
      version: findVersion(rule, input),
      evidence,
    });
  }

  for (const rule of RULES) {
    if (!found.has(rule.name)) continue;
    for (const implied of rule.implies ?? []) {
      if (found.has(implied)) continue;
      const target = RULES.find((candidate) => candidate.name === implied);
      if (!target) continue;
      found.set(implied, {
        name: implied,
        category: target.category,
        confidence: 0.7,
        evidence: `implied by ${rule.name}`,
      });
    }
  }

  // Universal Analytics often lingers next to GA4 in the same gtag snippet; keep both.
  return [...found.values()].sort((a, b) => b.confidence - a.confidence);
}

/** Strips internal fields for the shared contract. */
export function toDetectedTechnologies(matches: TechMatch[]): DetectedTechnology[] {
  return matches.map(({ name, category, confidence }) => ({ name, category, confidence }));
}

/** Compares dotted versions: negative when a < b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const pb = b.split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
}
