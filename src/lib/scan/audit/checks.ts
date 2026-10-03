import type {
  AuditCategory,
  AuditFinding,
  Bilingual,
  Effort,
  Lang,
  Severity,
} from "@/lib/scan/types";

import type { AuditContext, PageFacts } from "./model";
import { compareVersions } from "./technologies";

/**
 * Deterministic website checks. Each one reads the AuditContext and returns
 * a finding only for something we actually observed (or an opportunity that
 * is genuinely missing, at low severity), never a guess dressed as a defect.
 */

type Draft = {
  severity: Severity;
  effort: Effort;
  title: Bilingual;
  detail: Bilingual;
  recommendation: Bilingual;
  evidence?: string;
};

type Check = {
  id: string;
  category: AuditCategory;
  /** "content": needs readable HTML; "rendered": also needs server-rendered text. */
  needs?: "content" | "rendered";
  run: (ctx: AuditContext) => Draft | null;
};

const bi = (en: string, ro: string): Bilingual => ({ en, ro });
const locale = (lang: Lang) => (lang === "ro" ? "ro-RO" : "en-GB");
const num = (value: number, lang: Lang, digits = 0) =>
  new Intl.NumberFormat(locale(lang), {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
const both = (format: (lang: Lang) => string): Bilingual => ({
  en: format("en"),
  ro: format("ro"),
});
const size = (bytes: number) =>
  both((lang) =>
    bytes >= 1024 * 1024
      ? `${num(bytes / (1024 * 1024), lang, 1)} MB`
      : `${num(Math.max(1, Math.round(bytes / 1024)), lang)} KB`,
  );
const seconds = (ms: number) => both((lang) => `${num(ms / 1000, lang, 1)} s`);
const basename = (url: string) => {
  try {
    const { pathname, hostname } = new URL(url);
    return pathname.split("/").filter(Boolean).pop() ?? hostname;
  } catch {
    return url.slice(0, 60);
  }
};
/** Romanian puts "de" between a number and its noun from 20 up (20 de, 101 fără, 120 de). */
const de = (n: number) => (n >= 20 && (n % 100 === 0 || n % 100 >= 20) ? "de " : "");
const clip = (text: string, max = 60) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const list = (items: string[], max = 3) => items.slice(0, max).join(", ");

const has = (ctx: AuditContext, name: string) => ctx.technologies.some((t) => t.name === name);
const okPages = (ctx: AuditContext) => ctx.pages.filter((page) => page.status < 400);

/** Trackers that set cookies or identifiers (cookieless analytics excluded). */
const TRACKERS = [
  "Google Analytics 4",
  "Universal Analytics",
  "Hotjar",
  "Microsoft Clarity",
  "Yandex Metrica",
  "Meta Pixel",
  "TikTok Pixel",
  "Google Ads",
  "LinkedIn Insight Tag",
  "Pinterest Tag",
  "Microsoft Advertising",
  "HubSpot",
  "Klaviyo",
  "Newsman",
];
const TRACKER_SCRIPT =
  /googletagmanager\.com\/gtag|google-analytics\.com|connect\.facebook\.net|analytics\.tiktok\.com|static\.hotjar\.com|clarity\.ms|snap\.licdn\.com|bat\.bing\.com|mc\.yandex\.ru/i;

function trackersOf(ctx: AuditContext) {
  return ctx.technologies.filter((t) => TRACKERS.includes(t.name)).map((t) => t.name);
}

/** Social icons whose link goes nowhere (href="#" or javascript:). */
function deadSocialLinks(ctx: AuditContext) {
  return ctx.home.links.filter(
    (link) =>
      /^(#|javascript:.*)?$/i.test(link.href.trim()) &&
      /^(facebook|instagram|linkedin|youtube|tiktok|twitter|x|pinterest|whatsapp)$/i.test(
        link.text.trim(),
      ),
  );
}

function contentImages(ctx: AuditContext) {
  const seen = new Map<string, PageFacts["images"][number]>();
  for (const page of okPages(ctx)) {
    for (const image of page.images) {
      if (!image.src || image.src.startsWith("data:")) continue;
      if (!seen.has(image.src)) seen.set(image.src, image);
    }
  }
  return [...seen.values()];
}

const CHECKS: Check[] = [
  /* ------------------------------------------------------- performance */
  {
    id: "performance.slow-server",
    category: "performance",
    run: (ctx) => {
      if (ctx.ttfbMs <= 1500) return null;
      const time = seconds(ctx.ttfbMs);
      return {
        severity: ctx.ttfbMs > 3000 ? "high" : "medium",
        effort: "medium",
        title: bi("Slow server response", "Serverul răspunde lent"),
        detail: bi(
          `The server took ${time.en} to start sending the homepage (good is under 0.8 s). Every visit waits for this before anything appears.`,
          `Serverul a avut nevoie de ${time.ro} ca să înceapă să trimită pagina principală (ideal sub 0,8 s). Fiecare vizită așteaptă acest timp înainte să apară ceva.`,
        ),
        recommendation: bi(
          "We turn on page caching (or a CDN such as Cloudflare) and check the hosting plan and slow plugins.",
          "Activăm memorarea paginilor (cache sau un CDN precum Cloudflare) și verificăm planul de găzduire și modulele lente.",
        ),
        evidence: `Time to first byte: ${ctx.ttfbMs} ms`,
      };
    },
  },
  {
    id: "performance.heavy-html",
    category: "performance",
    needs: "content",
    run: (ctx) => {
      const bytes = ctx.home.htmlBytes;
      if (bytes <= 400 * 1024) return null;
      const weight = size(bytes);
      return {
        severity: bytes > 1024 * 1024 ? "high" : "medium",
        effort: "medium",
        title: bi("Very large HTML page", "Pagină HTML foarte mare"),
        detail: bi(
          `The homepage HTML alone is ${weight.en}, before images, styles and scripts (a typical page is under 100 KB). Heavy inline code or page-builder markup slows the first render, especially on phones.`,
          `Doar codul HTML al paginii principale are ${weight.ro}, fără imagini, stiluri și scripturi (o pagină obișnuită are sub 100 KB). Codul inline voluminos sau marcajul generat de page buildere încetinește prima afișare, mai ales pe telefon.`,
        ),
        recommendation: bi(
          "We move the code inside the page into separate files, remove unused sections and simplify the page editor's layout.",
          "Mutăm codul din pagină în fișiere separate, scoatem secțiunile nefolosite și simplificăm structura din editorul de pagini.",
        ),
        evidence: `HTML ${Math.round(bytes / 1024)} KB (uncompressed)`,
      };
    },
  },
  {
    id: "performance.no-compression",
    category: "performance",
    needs: "content",
    run: (ctx) => {
      if (ctx.htmlEncoded || ctx.home.htmlBytes < 20 * 1024) return null;
      const weight = size(ctx.home.htmlBytes);
      return {
        severity: "medium",
        effort: "quick",
        title: bi("Pages are sent uncompressed", "Paginile sunt trimise necomprimate"),
        detail: bi(
          `The server sends the ${weight.en} homepage without gzip or Brotli compression, so visitors download 3–5× more data than needed.`,
          `Serverul trimite pagina principală de ${weight.ro} fără compresie gzip sau Brotli, deci vizitatorii descarcă de 3–5 ori mai multe date decât e nevoie.`,
        ),
        recommendation: bi(
          "We turn on compression on the server (a single setting with most hosts).",
          "Activăm compresia pe server (o singură setare la majoritatea furnizorilor).",
        ),
        evidence: "No Content-Encoding header on the homepage",
      };
    },
  },
  {
    id: "performance.render-blocking-scripts",
    category: "performance",
    needs: "content",
    run: (ctx) => {
      const blocking = ctx.home.scripts.filter(
        (script) =>
          script.src &&
          script.inHead &&
          !script.async &&
          !script.defer &&
          !script.module &&
          (!script.type || /javascript/.test(script.type)),
      );
      if (blocking.length < 3) return null;
      return {
        severity: blocking.length >= 6 ? "high" : "medium",
        effort: "medium",
        title: bi("Scripts block the first render", "Scripturile blochează afișarea paginii"),
        detail: bi(
          `${blocking.length} scripts in the page head load before anything is shown (no async/defer). The browser must download and run them first.`,
          `${blocking.length} ${de(blocking.length)}scripturi din antetul paginii se încarcă înainte să se afișeze ceva (fără async/defer). Browserul trebuie să le descarce și să le ruleze mai întâi.`,
        ),
        recommendation: bi(
          "We load the non-essential scripts after the content, so the page shows first.",
          "Încărcăm scripturile neesențiale după conținut, ca pagina să apară întâi.",
        ),
        evidence: list(blocking.map((script) => basename(script.src!))),
      };
    },
  },
  {
    id: "performance.many-stylesheets",
    category: "performance",
    needs: "content",
    run: (ctx) => {
      const count = ctx.home.stylesheets.length;
      if (count <= 8) return null;
      return {
        severity: count > 15 ? "medium" : "low",
        effort: "medium",
        title: bi("Too many stylesheet files", "Prea multe fișiere CSS"),
        detail: bi(
          `The homepage loads ${count} separate CSS files; each one delays the first render.`,
          `Pagina principală încarcă ${count} ${de(count)}fișiere CSS separate; fiecare întârzie prima afișare.`,
        ),
        recommendation: bi(
          "We combine and shrink the style files and stop loading the styles of unused plugins.",
          "Combinăm și micșorăm fișierele de stil și nu mai încărcăm stilurile modulelor nefolosite.",
        ),
        evidence: `${count} stylesheets`,
      };
    },
  },
  {
    id: "performance.large-images",
    category: "performance",
    needs: "content",
    run: (ctx) => {
      const heavy = ctx.images
        .filter((image) => (image.bytes ?? 0) > 300 * 1024)
        .sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0));
      if (!heavy.length) return null;
      const largest = size(heavy[0].bytes!);
      return {
        severity: (heavy[0].bytes ?? 0) > 1024 * 1024 ? "high" : "medium",
        effort: "quick",
        title: bi("Oversized images", "Imagini prea mari"),
        detail: bi(
          `${heavy.length} of the ${ctx.images.length} images we measured ${heavy.length === 1 ? "weighs" : "weigh"} more than 300 KB (largest: ${largest.en}). Heavy images are the most common reason pages feel slow on phones.`,
          `${heavy.length === 1 ? "Una" : heavy.length} din cele ${ctx.images.length} ${de(ctx.images.length)}imagini verificate ${heavy.length === 1 ? "are" : "au"} peste 300 KB (cea mai mare: ${largest.ro}). Imaginile grele sunt cea mai des întâlnită cauză a încărcării lente pe telefon.`,
        ),
        recommendation: bi(
          "We resize the images to the size they're shown at and compress them.",
          "Micșorăm pozele la mărimea la care sunt afișate și le comprimăm.",
        ),
        evidence: `${basename(heavy[0].url)} (${Math.round(heavy[0].bytes! / 1024)} KB)`,
      };
    },
  },
  {
    id: "performance.legacy-image-formats",
    category: "performance",
    needs: "content",
    run: (ctx) => {
      if (["Shopify", "Wix", "Squarespace", "Webflow", "Framer"].some((name) => has(ctx, name))) {
        return null; // these platforms negotiate WebP/AVIF automatically
      }
      const modernInHtml = /\.(webp|avif)(\?|"|'|\s)|image\/(webp|avif)/i.test(ctx.home.html);
      const modernProbe = ctx.images.some((image) => /webp|avif/i.test(image.contentType ?? ""));
      if (modernInHtml || modernProbe) return null;
      const legacy = contentImages(ctx).filter((image) => /\.(jpe?g|png)(\?|$)/i.test(image.src));
      if (legacy.length < 4) return null;
      return {
        severity: "low",
        effort: "quick",
        title: bi("Images use older formats", "Imaginile folosesc formate vechi"),
        detail: bi(
          `${legacy.length} images use older formats (JPEG/PNG); modern formats are usually 25–50% smaller at the same quality.`,
          `${legacy.length} ${de(legacy.length)}imagini sunt în formate vechi (JPEG/PNG); formatele moderne sunt de obicei cu 25–50% mai mici, la aceeași calitate.`,
        ),
        recommendation: bi(
          "We switch the images to lighter, modern formats (most site platforms do it automatically).",
          "Trecem pozele în formate moderne, mai ușoare (majoritatea platformelor o fac automat).",
        ),
        evidence: basename(legacy[0].src),
      };
    },
  },
  {
    id: "performance.no-lazy-loading",
    category: "performance",
    needs: "rendered",
    run: (ctx) => {
      const images = ctx.home.images;
      if (images.length <= 8 || images.some((image) => image.lazy)) return null;
      return {
        severity: "low",
        effort: "quick",
        title: bi("Images are not lazy-loaded", "Imaginile nu se încarcă progresiv"),
        detail: bi(
          `All ${images.length} images on the homepage load immediately, even those far below the first screen.`,
          `Toate cele ${images.length} ${de(images.length)}imagini de pe pagina principală se încarcă imediat, chiar și cele aflate mult sub primul ecran.`,
        ),
        recommendation: bi(
          "We load the images below the first screen only when the visitor scrolls to them.",
          "Încărcăm pozele de sub primul ecran doar când vizitatorul ajunge la ele.",
        ),
        evidence: `${images.length} <img> without loading="lazy"`,
      };
    },
  },
  {
    id: "performance.images-without-dimensions",
    category: "performance",
    needs: "rendered",
    run: (ctx) => {
      const missing = ctx.home.images.filter((image) => !image.hasDimensions);
      if (missing.length < 5) return null;
      return {
        severity: "low",
        effort: "quick",
        title: bi("Images without set dimensions", "Imagini fără dimensiuni setate"),
        detail: bi(
          `${missing.length} images have no width/height, so the layout jumps while they load (layout shift).`,
          `${missing.length} ${de(missing.length)}imagini nu au width/height, așa că pagina „sare” în timp ce se încarcă (layout shift).`,
        ),
        recommendation: bi(
          "We set each image's size in advance, so the page doesn't jump while it loads.",
          "Stabilim dinainte mărimea fiecărei poze, ca pagina să nu sară cât se încarcă.",
        ),
        evidence: basename(missing[0].src),
      };
    },
  },
  {
    id: "performance.weak-caching",
    category: "performance",
    run: (ctx) => {
      const probed = ctx.assets.filter((asset) => asset.status === 200);
      const weak = probed.filter((asset) => {
        const value = asset.cacheControl?.toLowerCase() ?? "";
        if (/immutable/.test(value)) return false;
        if (/no-store|no-cache/.test(value)) return true;
        const maxAge = /max-age=(\d+)/.exec(value)?.[1];
        if (maxAge !== undefined) return Number(maxAge) < 86_400;
        // Without max-age, browsers fall back to Expires.
        const expires = asset.expires ? Date.parse(asset.expires) : NaN;
        return !(Number.isFinite(expires) && expires - ctx.now.getTime() >= 86_400_000);
      });
      if (!weak.length) return null;
      const sample = weak[0];
      const header = sample.cacheControl;
      return {
        severity: weak.length === probed.length && probed.length > 1 ? "medium" : "low",
        effort: "quick",
        title: bi("Short browser caching", "Cache scurt în browser"),
        detail: bi(
          `Static files such as ${basename(sample.url)} are sent ${header ? `with "Cache-Control: ${header}"` : "without a Cache-Control header"}, so returning visitors download them again.`,
          `Fișierele statice, precum ${basename(sample.url)}, sunt trimise ${header ? `cu „Cache-Control: ${header}”` : "fără antetul Cache-Control"}, deci vizitatorii care revin le descarcă din nou.`,
        ),
        recommendation: bi(
          "We let browsers keep the site's files for at least 30 days, so return visits load faster.",
          "Lăsăm browserele să păstreze fișierele site-ului cel puțin 30 de zile, ca vizitele următoare să se încarce mai repede.",
        ),
        evidence: `${basename(sample.url)}: ${header ?? "no Cache-Control"}`,
      };
    },
  },
  {
    id: "performance.redirect-chain",
    category: "performance",
    run: (ctx) => {
      if (ctx.redirects.length < 2) return null;
      return {
        severity: "low",
        effort: "quick",
        title: bi("Redirect chain on the homepage", "Lanț de redirecționări"),
        detail: bi(
          `Opening ${ctx.requestedUrl} goes through ${ctx.redirects.length} redirects before the page loads, which adds a delay to every first visit.`,
          `Deschiderea ${ctx.requestedUrl} trece prin ${ctx.redirects.length} redirecționări până la încărcarea paginii, ceea ce adaugă o întârziere la fiecare primă vizită.`,
        ),
        recommendation: bi(
          "We send visitors straight to the final address, in one step.",
          "Trimitem vizitatorii direct la adresa finală, dintr-un singur pas.",
        ),
        evidence: [ctx.requestedUrl, ...ctx.redirects].join(" → "),
      };
    },
  },
  {
    id: "performance.many-third-parties",
    category: "performance",
    needs: "content",
    run: (ctx) => {
      const own = ctx.finalUrl.hostname.replace(/^www\./, "");
      const hosts = new Set(
        ctx.home.scripts
          .map((script) => script.host)
          .filter((host): host is string => Boolean(host) && !host!.endsWith(own)),
      );
      if (hosts.size <= 8) return null;
      return {
        severity: hosts.size > 14 ? "medium" : "low",
        effort: "medium",
        title: bi("Many third-party scripts", "Multe scripturi externe"),
        detail: bi(
          `The homepage loads scripts from ${hosts.size} external services. Each one adds download time and can slow down interaction.`,
          `Pagina principală încarcă scripturi de la ${hosts.size} ${de(hosts.size)}servicii externe. Fiecare adaugă timp de încărcare și poate încetini interacțiunea.`,
        ),
        recommendation: bi(
          "We remove the tracking scripts you no longer use and load the rest from one place, after consent.",
          "Scoatem scripturile de urmărire pe care nu le mai folosești și le încărcăm pe celelalte dintr-un singur loc, după acord.",
        ),
        evidence: list([...hosts], 4),
      };
    },
  },
  {
    id: "performance.heavy-inline-code",
    category: "performance",
    needs: "content",
    run: (ctx) => {
      const bytes = ctx.home.scripts.reduce((total, script) => total + script.inlineBytes, 0);
      if (bytes <= 150 * 1024) return null;
      const weight = size(bytes);
      return {
        severity: "low",
        effort: "medium",
        title: bi("Large inline code", "Cod inline voluminos"),
        detail: bi(
          `${weight.en} of JavaScript is embedded directly in the homepage HTML, so it can't be cached between pages.`,
          `${weight.ro} de JavaScript sunt incluși direct în HTML-ul paginii principale, deci nu pot fi păstrați în cache între pagini.`,
        ),
        recommendation: bi(
          "We move the large blocks of code inside the page into separate files, or load them only where they're needed.",
          "Mutăm blocurile mari de cod din pagină în fișiere separate sau le încărcăm doar unde e nevoie.",
        ),
        evidence: `${Math.round(bytes / 1024)} KB inline <script>`,
      };
    },
  },
  {
    id: "performance.heavy-javascript",
    category: "performance",
    needs: "content",
    run: (ctx) => {
      const bundle = ctx.appBundle;
      if (!bundle || bundle.bytes <= 500 * 1024) return null;
      const weight = size(bundle.bytes);
      const atLeast = bundle.truncated ? { en: "at least ", ro: "cel puțin " } : { en: "", ro: "" };
      return {
        severity: bundle.bytes > 1024 * 1024 ? "high" : "medium",
        effort: "project",
        title: bi(
          "Heavy JavaScript before anything shows",
          "JavaScript greu înainte să apară ceva",
        ),
        detail: bi(
          `The page is built by a JavaScript file of ${atLeast.en}${weight.en} (uncompressed) that phones must download and run before showing any content.`,
          `Pagina este construită de un fișier JavaScript de ${atLeast.ro}${weight.ro} (necomprimat), pe care telefoanele trebuie să-l descarce și să-l ruleze înainte să afișeze orice conținut.`,
        ),
        recommendation: bi(
          "We split the app's code by page, drop unused libraries and prepare the public pages in advance.",
          "Împărțim codul aplicației pe pagini, scoatem bibliotecile nefolosite și pregătim dinainte paginile publice.",
        ),
        evidence: `${basename(bundle.url)} (${Math.round(bundle.bytes / 1024)} KB${bundle.truncated ? "+" : ""})`,
      };
    },
  },
  {
    id: "performance.font-display",
    category: "performance",
    needs: "content",
    run: (ctx) => {
      const font = ctx.home.stylesheets.find(
        (href) =>
          /fonts\.googleapis\.com\/css/i.test(href) &&
          !/display=(swap|optional|fallback)/i.test(href),
      );
      if (!font) return null;
      return {
        severity: "low",
        effort: "quick",
        title: bi("Text waits for web fonts", "Textul așteaptă fonturile web"),
        detail: bi(
          "Google Fonts is loaded without display=swap, so text can stay invisible until the font arrives.",
          "Google Fonts este încărcat fără display=swap, așa că textul poate rămâne invizibil până se descarcă fontul.",
        ),
        recommendation: bi(
          "We make the text show at once, while the fonts load.",
          "Facem ca textul să apară imediat, cât se încarcă fonturile.",
        ),
        evidence: clip(font, 90),
      };
    },
  },

  /* --------------------------------------------------------------- SEO */
  {
    id: "seo.title-missing",
    category: "seo",
    needs: "content",
    run: (ctx) =>
      ctx.home.title
        ? null
        : {
            severity: "high",
            effort: "quick",
            title: bi("Homepage has no title", "Pagina principală nu are titlu"),
            detail: bi(
              "The <title> tag is missing, so Google results and browser tabs show the bare address instead of your name and offer.",
              "Eticheta <title> lipsește, deci rezultatele Google și filele browserului afișează doar adresa în locul numelui și ofertei tale.",
            ),
            recommendation: bi(
              "We write a unique title of 30–60 characters: what you do, the city and your name.",
              "Scriem un titlu unic de 30–60 de caractere: ce faci, orașul și numele firmei.",
            ),
          },
  },
  {
    id: "seo.title-length",
    category: "seo",
    needs: "content",
    run: (ctx) => {
      const title = ctx.home.title;
      if (!title) return null;
      const length = [...title].length;
      if (length >= 20 && length <= 65) return null;
      const short = length < 20;
      return {
        severity: "low",
        effort: "quick",
        title: short
          ? bi("Title is too short", "Titlul este prea scurt")
          : bi("Title is too long", "Titlul este prea lung"),
        detail: short
          ? bi(
              `The page title "${title}" has ${length} characters, which misses the chance to say what you do and where.`,
              `Titlul paginii „${title}” are ${length} ${de(length)}caractere și ratează ocazia de a spune ce faci și unde.`,
            )
          : bi(
              `The page title has ${length} characters; Google cuts it after about 60, so the end isn't shown in results.`,
              `Titlul paginii are ${length} ${de(length)}caractere; Google îl taie după aproximativ 60, deci finalul nu apare în rezultate.`,
            ),
        recommendation: bi(
          "We bring it to 30–60 characters: main service, city and your name.",
          "Îl aducem la 30–60 de caractere: serviciul principal, orașul și numele firmei.",
        ),
        evidence: clip(title, 90),
      };
    },
  },
  {
    id: "seo.meta-description-missing",
    category: "seo",
    needs: "content",
    run: (ctx) =>
      ctx.home.description
        ? null
        : {
            severity: "medium",
            effort: "quick",
            title: bi("No meta description", "Lipsește descrierea meta"),
            detail: bi(
              "Without a description, Google picks random text from the page for your search snippet.",
              "Fără descriere, Google alege un text oarecare din pagină pentru fragmentul din rezultatele căutării.",
            ),
            recommendation: bi(
              "We write a 120–155 character summary with your main service, location and a reason to click.",
              "Scriem o descriere de 120–155 de caractere, cu serviciul principal, locul și un motiv să dea clic.",
            ),
          },
  },
  {
    id: "seo.meta-description-length",
    category: "seo",
    needs: "content",
    run: (ctx) => {
      const description = ctx.home.description;
      if (!description) return null;
      const length = [...description].length;
      if (length >= 70 && length <= 170) return null;
      const short = length < 70;
      return {
        severity: "low",
        effort: "quick",
        title: short
          ? bi("Meta description is too short", "Descrierea meta este prea scurtă")
          : bi("Meta description is too long", "Descrierea meta este prea lungă"),
        detail: bi(
          `It has ${length} characters (aim for 120–155), so the search snippet ${short ? "says little about you" : "gets cut off"}.`,
          `Are ${length} ${de(length)}caractere (ideal 120–155), deci fragmentul din căutare ${short ? "spune prea puțin despre tine" : "este tăiat"}.`,
        ),
        recommendation: bi(
          "We rewrite it in 120–155 characters, with your main service, location and a reason to click.",
          "O rescriem în 120–155 de caractere, cu serviciul principal, locul și un motiv să dea clic.",
        ),
        evidence: clip(description, 90),
      };
    },
  },
  {
    id: "seo.h1-missing",
    category: "seo",
    needs: "rendered",
    run: (ctx) =>
      ctx.home.h1.some(Boolean)
        ? null
        : {
            severity: "medium",
            effort: "quick",
            title: bi("No main heading (H1)", "Lipsește titlul principal (H1)"),
            detail: bi(
              "The homepage has no H1, the heading search engines and screen readers use to understand what the page is about.",
              "Pagina principală nu are H1, titlul folosit de motoarele de căutare și de cititoarele de ecran pentru a înțelege subiectul paginii.",
            ),
            recommendation: bi(
              "We add one main heading with your service and city, e.g. “Dental clinic in Timișoara”.",
              "Adăugăm un singur titlu principal, cu serviciul și orașul, de exemplu „Clinică stomatologică în Timișoara”.",
            ),
          },
  },
  {
    id: "seo.multiple-h1",
    category: "seo",
    needs: "rendered",
    run: (ctx) => {
      const headings = ctx.home.h1.filter(Boolean);
      if (headings.length < 2) return null;
      return {
        severity: "low",
        effort: "quick",
        title: bi("Several main headings (H1)", "Mai multe titluri principale (H1)"),
        detail: bi(
          `The homepage has ${headings.length} H1 headings, which dilutes its main topic.`,
          `Pagina principală are ${headings.length} titluri H1, ceea ce îi diluează subiectul principal.`,
        ),
        recommendation: bi(
          "We keep one main heading and turn the others into subheadings.",
          "Păstrăm un singur titlu principal și le facem pe celelalte subtitluri.",
        ),
        evidence: list(headings.map((heading) => clip(heading, 40))),
      };
    },
  },
  {
    id: "seo.canonical-missing",
    category: "seo",
    needs: "content",
    run: (ctx) =>
      ctx.home.canonical
        ? null
        : {
            severity: "low",
            effort: "quick",
            title: bi("No preferred address for Google", "Lipsește adresa preferată pentru Google"),
            detail: bi(
              "Without a canonical tag, Google may index duplicates of your pages (with or without www, with tracking parameters).",
              "Fără eticheta canonical, Google poate indexa duplicate ale paginilor (cu sau fără www, cu parametri de tracking).",
            ),
            recommendation: bi(
              "We tell Google the preferred address of each page, so it doesn't count copies.",
              "Îi spunem lui Google adresa preferată a fiecărei pagini, ca să nu numere copiile.",
            ),
          },
  },
  {
    id: "seo.canonical-elsewhere",
    category: "seo",
    needs: "content",
    run: (ctx) => {
      if (!ctx.home.canonical) return null;
      const canonical = new URL(ctx.home.canonical);
      const sameHost =
        canonical.hostname.replace(/^www\./, "") === ctx.finalUrl.hostname.replace(/^www\./, "");
      const downgrade = ctx.https && canonical.protocol === "http:";
      if (sameHost && !downgrade) return null;
      return {
        severity: sameHost ? "medium" : "high",
        effort: "quick",
        title: sameHost
          ? bi(
              "Canonical points to the insecure version",
              "Eticheta canonical indică versiunea nesecurizată",
            )
          : bi("Canonical points to another site", "Eticheta canonical trimite către alt site"),
        detail: bi(
          `The homepage declares ${ctx.home.canonical} as its main version, so Google may index that address instead of ${ctx.finalUrl.href}.`,
          `Pagina principală declară ${ctx.home.canonical} drept versiune principală, deci Google poate indexa acea adresă în locul ${ctx.finalUrl.href}.`,
        ),
        recommendation: bi(
          "We point Google to this page's own secure address.",
          "Îi arătăm lui Google adresa securizată a acestei pagini.",
        ),
        evidence: `canonical: ${ctx.home.canonical}`,
      };
    },
  },
  {
    id: "seo.no-sitemap",
    category: "seo",
    run: (ctx) =>
      ctx.sitemap.found || ctx.sitemap.skipped
        ? null
        : {
            severity: "medium",
            effort: "quick",
            title: bi("No list of pages for Google", "Lipsește lista paginilor pentru Google"),
            detail: bi(
              "We found no sitemap.xml (and none listed in robots.txt), so search engines have to discover pages by following links.",
              "Nu am găsit sitemap.xml (nici declarat în robots.txt), deci motoarele de căutare trebuie să descopere paginile urmărind linkurile.",
            ),
            recommendation: bi(
              "We create the list of pages for Google (most platforms do it automatically) and send it to Google.",
              "Facem lista paginilor pentru Google (majoritatea platformelor o fac automat) și o trimitem la Google.",
            ),
          },
  },
  {
    id: "seo.no-robots",
    category: "seo",
    run: (ctx) =>
      ctx.robots.found || (ctx.robots.status ?? 404) >= 500
        ? null
        : {
            severity: "low",
            effort: "quick",
            title: bi("No robots.txt", "Lipsește robots.txt"),
            detail: bi(
              "The site has no robots.txt. It isn't mandatory, but it's where you point crawlers to your sitemap and keep admin pages out of search.",
              "Site-ul nu are robots.txt. Nu este obligatoriu, dar acolo indici sitemap-ul și ții paginile de administrare în afara căutărilor.",
            ),
            recommendation: bi(
              "We add the robots.txt file that points Google to the list of pages.",
              "Adăugăm fișierul robots.txt, care îi arată lui Google lista paginilor.",
            ),
            evidence: `robots.txt → HTTP ${ctx.robots.status ?? "no response"}`,
          },
  },
  {
    id: "seo.robots-blocks-google",
    category: "seo",
    run: (ctx) =>
      ctx.robots.blocksGoogle
        ? {
            severity: "critical",
            effort: "quick",
            title: bi("robots.txt blocks Google", "robots.txt blochează Google"),
            detail: bi(
              "The robots.txt file tells search engines not to crawl the homepage, so the site can disappear from Google.",
              "Fișierul robots.txt le cere motoarelor de căutare să nu acceseze pagina principală, deci site-ul poate dispărea din Google.",
            ),
            recommendation: bi(
              "We remove the rule that blocks search engines (it is often left over from development).",
              "Scoatem regula care blochează motoarele de căutare (de obicei a rămas din perioada de dezvoltare).",
            ),
            evidence: ctx.robots.blocksEveryone
              ? "User-agent: * / Disallow: /"
              : "Googlebot disallowed on /",
          }
        : null,
  },
  {
    id: "seo.noindex",
    category: "seo",
    needs: "content",
    run: (ctx) => {
      const header = ctx.headers.get("x-robots-tag") ?? "";
      const meta = ctx.home.robotsMeta ?? "";
      if (!/noindex/i.test(`${header} ${meta}`)) return null;
      return {
        severity: "critical",
        effort: "quick",
        title: bi("Homepage asks not to be indexed", "Pagina principală cere să nu fie indexată"),
        detail: bi(
          'The page carries a "noindex" directive, so it won\'t appear in search results.',
          "Pagina are directiva „noindex”, deci nu va apărea în rezultatele căutării.",
        ),
        recommendation: bi(
          "We remove the setting that hides the site from search engines.",
          "Scoatem setarea care ascunde site-ul de motoarele de căutare.",
        ),
        evidence: header ? `X-Robots-Tag: ${header}` : `meta robots: ${meta}`,
      };
    },
  },
  {
    id: "seo.no-structured-data",
    category: "seo",
    needs: "content",
    run: (ctx) =>
      ctx.signals.hasStructuredData
        ? null
        : {
            severity: "medium",
            effort: "quick",
            title: bi("No business details for Google", "Fără date structurate pentru Google"),
            detail: bi(
              "The site doesn't give Google its details in a form it reads directly, so Google can't show your address, hours, ratings or prices in the results.",
              "Site-ul nu îi dă lui Google datele firmei într-o formă pe care o citește direct, deci Google nu poate afișa în rezultate adresa, programul, evaluările sau prețurile.",
            ),
            recommendation: ctx.signals.hasEcommerce
              ? bi(
                  "We give Google your business details and, on product pages, the price, stock and reviews.",
                  "Îi dăm lui Google datele firmei și, pe paginile de produs, prețul, stocul și recenziile.",
                )
              : bi(
                  "We give Google your address, opening hours, phone and logo in a form it reads directly.",
                  "Îi dăm lui Google adresa, programul, telefonul și sigla, într-o formă pe care o citește direct.",
                ),
          },
  },
  {
    id: "seo.no-business-schema",
    category: "seo",
    needs: "content",
    run: (ctx) => {
      const types = [...new Set(ctx.pages.flatMap((page) => page.jsonLdTypes))];
      if (!types.length) return null;
      const business =
        /Organization|Business|Corporation|Dentist|Clinic|Restaurant|Store|Shop|Hotel|Physician|Service|Agency|Attorney|Salon|Spa|Gym|Center|Office|Cafe|Bakery|Bar|Pharmacy|Hospital|School|Person/i;
      if (types.some((type) => business.test(type))) return null;
      return {
        severity: "low",
        effort: "quick",
        title: bi("No organisation markup", "Lipsește marcajul pentru organizație"),
        detail: bi(
          `The site uses structured data (${list(types)}) but doesn't describe the business itself, so Google can't connect your name, logo and contact details.`,
          `Site-ul folosește date structurate (${list(types)}), dar nu descrie afacerea propriu-zisă, deci Google nu poate lega numele, logo-ul și datele de contact.`,
        ),
        recommendation: bi(
          "We give Google your name, logo, address, phone and social profiles in a form it reads directly.",
          "Îi dăm lui Google numele, sigla, adresa, telefonul și profilurile sociale, într-o formă pe care o citește direct.",
        ),
        evidence: list(types),
      };
    },
  },
  {
    id: "seo.no-open-graph",
    category: "seo",
    needs: "content",
    run: (ctx) => {
      const missing = [
        !ctx.home.og.title && "og:title",
        !ctx.home.og.image && "og:image",
        !ctx.home.og.description && "og:description",
      ].filter(Boolean) as string[];
      if (!missing.includes("og:image") && !missing.includes("og:title")) return null;
      return {
        severity: missing.length === 3 ? "medium" : "low",
        effort: "quick",
        title: bi("Poor link previews", "Linkurile distribuite arată slab"),
        detail: bi(
          "The homepage lacks Open Graph tags, so links shared on Facebook, WhatsApp or LinkedIn appear without a picture or with the wrong text.",
          "Pagina principală nu are etichete Open Graph complete, deci linkurile distribuite pe Facebook, WhatsApp sau LinkedIn apar fără imagine sau cu text greșit.",
        ),
        recommendation: bi(
          "We add a title, a description and a 1200×630 image for when the site is shared.",
          "Adăugăm un titlu, o descriere și o imagine de 1200×630 pentru când site-ul e distribuit.",
        ),
        evidence: `Missing: ${missing.join(", ")}`,
      };
    },
  },
  {
    id: "seo.duplicate-titles",
    category: "seo",
    needs: "content",
    run: (ctx) => {
      const counts = new Map<string, number>();
      for (const page of okPages(ctx)) {
        if (page.title) counts.set(page.title, (counts.get(page.title) ?? 0) + 1);
      }
      const [title, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
      if (!title || !count || count < 2) return null;
      return {
        severity: "low",
        effort: "quick",
        title: bi("Pages share the same title", "Pagini cu același titlu"),
        detail: bi(
          `${count} of the pages we analysed have the identical title "${clip(title)}", so Google can't tell them apart.`,
          `${count} dintre paginile analizate au același titlu „${clip(title)}”, deci Google nu le poate diferenția.`,
        ),
        recommendation: bi(
          "We give each page its own title that describes it.",
          "Dăm fiecărei pagini un titlu propriu, care o descrie.",
        ),
        evidence: clip(title, 80),
      };
    },
  },
  {
    id: "seo.thin-homepage",
    category: "seo",
    needs: "rendered",
    run: (ctx) => {
      const words = ctx.home.wordCount;
      if (words >= 150) return null;
      return {
        severity: "low",
        effort: "medium",
        title: bi("Very little text on the homepage", "Foarte puțin text pe pagina principală"),
        detail: bi(
          `The homepage has about ${words} words. Search engines need text to understand what you offer and where.`,
          `Pagina principală are aproximativ ${words} ${de(words)}cuvinte. Motoarele de căutare au nevoie de text ca să înțeleagă ce oferi și unde.`,
        ),
        recommendation: bi(
          "We add a short section about your services, the areas you serve and why clients choose you.",
          "Adăugăm o secțiune scurtă despre servicii, zonele în care lucrezi și de ce te aleg clienții.",
        ),
        evidence: `${words} words`,
      };
    },
  },
  {
    id: "seo.client-rendered",
    category: "seo",
    needs: "content",
    run: (ctx) =>
      ctx.home.clientRendered
        ? {
            severity: "medium",
            effort: "project",
            title: bi(
              "Content only appears with JavaScript",
              "Conținutul apare doar cu JavaScript",
            ),
            detail: bi(
              "The homepage HTML is almost empty and the content is built in the browser. Google renders it with a delay, but many crawlers, AI assistants and link previews see a blank page.",
              "HTML-ul paginii principale este aproape gol, iar conținutul se construiește în browser. Google îl procesează cu întârziere, dar mulți roboți, asistenți AI și previzualizări de linkuri văd o pagină goală.",
            ),
            recommendation: bi(
              "We make the public pages arrive with their text already in them, so Google and slow phones can read them.",
              "Facem ca paginile publice să ajungă deja cu textul în ele, ca Google și telefoanele lente să le poată citi.",
            ),
            evidence: `${ctx.home.wordCount} words in the HTML`,
          }
        : null,
  },
  {
    id: "seo.not-mobile-friendly",
    category: "seo",
    needs: "content",
    run: (ctx) =>
      ctx.home.viewport
        ? null
        : {
            severity: "high",
            effort: "medium",
            title: bi("Not set up for mobile screens", "Nu este adaptat pentru mobil"),
            detail: bi(
              "The page has no viewport meta tag, so phones render it as a shrunken desktop page. Google indexes the mobile version first.",
              "Pagina nu are eticheta meta viewport, deci telefoanele o afișează ca pe o pagină de desktop micșorată. Google indexează mai întâi versiunea pentru mobil.",
            ),
            recommendation: bi(
              "We make the site fit phone screens and check how it looks on a phone.",
              "Potrivim site-ul pe ecranul telefonului și verificăm cum arată pe telefon.",
            ),
          },
  },
  {
    id: "seo.no-favicon",
    category: "seo",
    needs: "content",
    run: (ctx) =>
      ctx.home.favicon || ctx.faviconFound
        ? null
        : {
            severity: "low",
            effort: "quick",
            title: bi("No site icon", "Lipsește pictograma site-ului"),
            detail: bi(
              "The site has no favicon, so browser tabs, bookmarks and Google's mobile results show a generic icon.",
              "Site-ul nu are favicon, deci filele browserului, marcajele și rezultatele Google pe mobil afișează o pictogramă generică.",
            ),
            recommendation: bi(
              "We add the small site icon shown in browser tabs and on Google.",
              "Adăugăm pictograma mică a site-ului, afișată în filele browserului și pe Google.",
            ),
          },
  },
  {
    id: "seo.missing-hreflang",
    category: "seo",
    needs: "content",
    run: (ctx) => {
      const languages = ctx.signals.languages;
      if (languages.length < 2 || ctx.pages.some((page) => page.hreflangs.length)) return null;
      const names = languages.map((code) => code.toUpperCase()).join(" + ");
      return {
        severity: "low",
        effort: "quick",
        title: bi(
          "Language versions not linked for Google",
          "Versiunile de limbă nu sunt legate pentru Google",
        ),
        detail: bi(
          `The site is available in ${names} but has no hreflang tags, so Google may show searchers the wrong language.`,
          `Site-ul este disponibil în ${names}, dar nu are etichete hreflang, deci Google poate afișa versiunea în limba greșită.`,
        ),
        recommendation: bi(
          "We link each page to its translations, so Google shows the right language.",
          "Legăm fiecare pagină de traducerile ei, ca Google să arate limba potrivită.",
        ),
        evidence: `Languages: ${languages.join(", ")}`,
      };
    },
  },

  /* ----------------------------------------------------- accessibility */
  {
    id: "accessibility.images-missing-alt",
    category: "accessibility",
    needs: "rendered",
    run: (ctx) => {
      const images = contentImages(ctx);
      const missing = images.filter((image) => image.alt === null);
      if (!missing.length) return null;
      const share = missing.length / images.length;
      return {
        severity:
          missing.length >= 5 && share >= 0.5 ? "high" : missing.length >= 3 ? "medium" : "low",
        effort: "quick",
        title: bi("Images without alt text", "Imagini fără text alternativ"),
        detail:
          missing.length === 1
            ? bi(
                `1 of ${images.length} images has no alt attribute, so screen readers skip it and Google can't understand it.`,
                `O imagine din ${images.length} ${de(images.length)}nu are atributul alt, deci cititoarele de ecran o ignoră, iar Google nu o poate înțelege.`,
              )
            : bi(
                `${missing.length} of ${images.length} images have no alt attribute, so screen readers skip them and Google can't understand them.`,
                `${missing.length} din ${images.length} ${de(images.length)}imagini nu au atributul alt, deci cititoarele de ecran le ignoră, iar Google nu le poate înțelege.`,
              ),
        recommendation: bi(
          "We describe the important images for screen readers and Google.",
          "Descriem imaginile importante pentru cititoarele de ecran și pentru Google.",
        ),
        evidence: basename(missing[0].src),
      };
    },
  },
  {
    id: "accessibility.unlabeled-fields",
    category: "accessibility",
    needs: "rendered",
    run: (ctx) => {
      const unlabeled = okPages(ctx)
        .flatMap((page) => page.forms)
        .filter((form) => form.kind !== "search")
        .reduce((total, form) => total + form.unlabeled, 0);
      if (!unlabeled) return null;
      return {
        severity: unlabeled >= 3 ? "medium" : "low",
        effort: "quick",
        title: bi("Form fields without labels", "Câmpuri de formular fără etichete"),
        detail: bi(
          `${unlabeled === 1 ? "A form field has" : `${unlabeled} form fields have`} no label, so screen-reader users don't know what to type.`,
          unlabeled === 1
            ? "Un câmp din formular nu are etichetă, deci utilizatorii de cititoare de ecran nu știu ce să completeze."
            : `${unlabeled} ${de(unlabeled)}câmpuri din formulare nu au etichetă, deci utilizatorii de cititoare de ecran nu știu ce să completeze.`,
        ),
        recommendation: bi(
          "We give every form field a visible label.",
          "Punem o etichetă vizibilă la fiecare câmp din formulare.",
        ),
      };
    },
  },
  {
    id: "accessibility.lang-missing",
    category: "accessibility",
    needs: "content",
    run: (ctx) =>
      ctx.home.lang
        ? null
        : {
            severity: "medium",
            effort: "quick",
            title: bi("Page language not declared", "Limba paginii nu este declarată"),
            detail: bi(
              "The <html> tag has no lang attribute, so screen readers may read Romanian text with an English voice (and vice versa).",
              "Eticheta <html> nu are atributul lang, deci cititoarele de ecran pot citi textul românesc cu voce în engleză (și invers).",
            ),
            recommendation: bi(
              "We mark the page's language, so browsers and screen readers read it correctly.",
              "Marcăm limba paginii, ca browserele și cititoarele de ecran să o citească corect.",
            ),
          },
  },
  {
    id: "accessibility.zoom-disabled",
    category: "accessibility",
    needs: "content",
    run: (ctx) => {
      const viewport = ctx.home.viewport ?? "";
      const maxScale = Number(/maximum-scale\s*=\s*([\d.]+)/i.exec(viewport)?.[1] ?? 10);
      if (!/user-scalable\s*=\s*(no|0)/i.test(viewport) && maxScale >= 2) return null;
      return {
        severity: "medium",
        effort: "quick",
        title: bi("Zoom is disabled on mobile", "Mărirea paginii este blocată pe mobil"),
        detail: bi(
          "The viewport setting stops visitors from pinch-zooming, which people with low vision rely on.",
          "Setarea viewport îi împiedică pe vizitatori să mărească pagina, lucru de care depind persoanele cu vedere slabă.",
        ),
        recommendation: bi(
          "We let visitors zoom in on phones again.",
          "Lăsăm din nou vizitatorii să mărească pagina pe telefon.",
        ),
        evidence: clip(viewport, 90),
      };
    },
  },
  {
    id: "accessibility.no-main-landmark",
    category: "accessibility",
    needs: "rendered",
    run: (ctx) =>
      ctx.home.landmarks.main
        ? null
        : {
            severity: "low",
            effort: "quick",
            title: bi("No main landmark", "Lipsește zona de conținut principal"),
            detail: bi(
              "The page doesn't mark its main content with <main>, so keyboard and screen-reader users can't jump straight to it.",
              "Pagina nu marchează conținutul principal cu <main>, deci utilizatorii de tastatură și cititoare de ecran nu pot sări direct la el.",
            ),
            recommendation: bi(
              "We mark the page's main parts (header, menu, content, footer) for screen readers.",
              "Marcăm părțile paginii (antet, meniu, conținut, subsol) pentru cititoarele de ecran.",
            ),
          },
  },
  {
    id: "accessibility.empty-links",
    category: "accessibility",
    needs: "rendered",
    run: (ctx) => {
      const count = ctx.home.emptyLinks;
      if (count < 2) return null;
      return {
        severity: count >= 5 ? "medium" : "low",
        effort: "quick",
        title: bi("Links without a name", "Linkuri fără nume"),
        detail: bi(
          `${count} links (often icon-only social or menu links) have no text or label, so screen readers announce just "link".`,
          `${count} ${de(count)}linkuri (de obicei pictograme sociale sau de meniu) nu au text sau etichetă, deci cititoarele de ecran anunță doar „link”.`,
        ),
        recommendation: bi(
          "We give the icon links a name screen readers can read out, e.g. “Facebook”.",
          "Dăm linkurilor cu pictograme un nume pe care cititoarele de ecran îl pot citi, de exemplu „Facebook”.",
        ),
      };
    },
  },
  {
    id: "accessibility.empty-buttons",
    category: "accessibility",
    needs: "rendered",
    run: (ctx) => {
      const total = ctx.home.emptyButtons;
      if (!total) return null;
      return {
        severity: total >= 3 ? "medium" : "low",
        effort: "quick",
        title: bi("Buttons without a name", "Butoane fără nume"),
        detail:
          total === 1
            ? bi(
                "A button (e.g. a menu toggle or slider arrow) has no text or label.",
                "Un buton (de ex. meniul sau o săgeată de slider) nu are text sau etichetă.",
              )
            : bi(
                `${total} buttons (e.g. menu toggles or slider arrows) have no text or label.`,
                `${total} ${de(total)}butoane (de ex. meniul sau săgețile de slider) nu au text sau etichetă.`,
              ),
        recommendation: bi(
          "We give the icon buttons a name, e.g. “Open menu”.",
          "Dăm butoanelor cu pictograme un nume, de exemplu „Deschide meniul”.",
        ),
      };
    },
  },
  {
    id: "accessibility.iframe-titles",
    category: "accessibility",
    needs: "content",
    run: (ctx) => {
      const untitled = okPages(ctx)
        .flatMap((page) => page.iframes)
        .filter(
          (frame) =>
            !frame.title &&
            frame.src &&
            !/googletagmanager|facebook\.com\/tr|doubleclick/i.test(frame.src),
        );
      if (!untitled.length) return null;
      return {
        severity: "low",
        effort: "quick",
        title: bi("Embedded frames without titles", "Cadre încorporate fără titlu"),
        detail:
          untitled.length === 1
            ? bi(
                "An embedded frame (map, video or form) has no title, so assistive technology can't say what it contains.",
                "Un cadru încorporat (hartă, video sau formular) nu are titlu, deci tehnologiile asistive nu pot spune ce conține.",
              )
            : bi(
                `${untitled.length} embedded frames (maps, videos, forms) have no title, so assistive technology can't say what they contain.`,
                `${untitled.length} ${de(untitled.length)}cadre încorporate (hărți, video, formulare) nu au titlu, deci tehnologiile asistive nu pot spune ce conțin.`,
              ),
        recommendation: bi(
          "We give each embedded map or video a short title, e.g. “Map to our office”.",
          "Dăm fiecărei hărți sau fiecărui video încorporat un titlu scurt, de exemplu „Harta către sediu”.",
        ),
        evidence: clip(untitled[0].src ?? "", 80),
      };
    },
  },
  {
    id: "accessibility.heading-skips",
    category: "accessibility",
    needs: "rendered",
    run: (ctx) => {
      const levels = ctx.home.headingLevels;
      const skips: Array<[number, number]> = [];
      for (let i = 1; i < levels.length; i++) {
        if (levels[i] > levels[i - 1] + 1) skips.push([levels[i - 1], levels[i]]);
      }
      if (skips.length < 2) return null;
      const [from, to] = skips[0];
      return {
        severity: "low",
        effort: "quick",
        title: bi("Heading levels are skipped", "Niveluri de titluri sărite"),
        detail: bi(
          `The headings jump levels ${skips.length} times (e.g. H${from} → H${to}), which makes the structure harder to follow with a screen reader.`,
          `Titlurile sar peste niveluri de ${skips.length} ${de(skips.length)}ori (de ex. H${from} → H${to}), ceea ce face structura greu de urmărit cu un cititor de ecran.`,
        ),
        recommendation: bi(
          "We put the headings in order and set their size in the design, not by level.",
          "Punem titlurile în ordine și le stabilim mărimea din design, nu după nivel.",
        ),
      };
    },
  },
  {
    id: "accessibility.positive-tabindex",
    category: "accessibility",
    needs: "rendered",
    run: (ctx) =>
      ctx.home.positiveTabindex
        ? {
            severity: "low",
            effort: "quick",
            title: bi("Forced keyboard order", "Ordine de tabulare forțată"),
            detail: bi(
              `${ctx.home.positiveTabindex === 1 ? "An element uses" : `${ctx.home.positiveTabindex} elements use`} a positive tabindex, which breaks the natural keyboard order.`,
              ctx.home.positiveTabindex === 1
                ? "Un element folosește tabindex pozitiv, ceea ce strică ordinea naturală la navigarea cu tastatura."
                : `${ctx.home.positiveTabindex} ${de(ctx.home.positiveTabindex)}elemente folosesc tabindex pozitiv, ceea ce strică ordinea naturală la navigarea cu tastatura.`,
            ),
            recommendation: bi(
              "We fix the order in which the keyboard moves through the page.",
              "Corectăm ordinea în care tastatura trece prin pagină.",
            ),
          }
        : null,
  },
  {
    id: "accessibility.autoplay-media",
    category: "accessibility",
    needs: "rendered",
    run: (ctx) =>
      ctx.home.autoplayMedia
        ? {
            severity: "low",
            effort: "quick",
            title: bi(
              "Media plays with sound automatically",
              "Conținut media pornit automat cu sunet",
            ),
            detail: bi(
              "Audio or video starts playing on its own without being muted, which disrupts screen readers and surprises visitors.",
              "Un fișier audio sau video pornește singur, fără să fie pe mut, ceea ce deranjează cititoarele de ecran și surprinde vizitatorii.",
            ),
            recommendation: bi(
              "We mute the videos that start on their own, or let visitors start them.",
              "Punem pe mut videoclipurile care pornesc singure sau îi lăsăm pe vizitatori să le pornească.",
            ),
          }
        : null,
  },

  /* ---------------------------------------------------- security & privacy */
  {
    id: "security.no-https",
    category: "security",
    run: (ctx) =>
      ctx.https
        ? null
        : {
            severity: "critical",
            effort: "quick",
            title: bi("No HTTPS", "Fără HTTPS"),
            detail: bi(
              "The site loads over plain HTTP. Browsers mark it “Not secure”, form data travels unencrypted and Google ranks it lower.",
              "Site-ul se încarcă prin HTTP simplu. Browserele îl marchează „Nesigur”, datele din formulare circulă necriptat, iar Google îl clasează mai jos.",
            ),
            recommendation: bi(
              "We install a free security certificate and send every page to its secure https:// address.",
              "Instalăm un certificat de securitate gratuit și trimitem toate paginile la adresa securizată https://.",
            ),
            evidence: ctx.finalUrl.href,
          },
  },
  {
    id: "security.no-https-redirect",
    category: "security",
    run: (ctx) =>
      ctx.https && ctx.httpRedirectsToHttps === false
        ? {
            severity: "medium",
            effort: "quick",
            title: bi(
              "HTTP version doesn't redirect to HTTPS",
              "Versiunea HTTP nu redirecționează către HTTPS",
            ),
            detail: bi(
              `http://${ctx.finalUrl.host} still serves the site without redirecting to the secure version, so some visitors and old links use the unencrypted site.`,
              `http://${ctx.finalUrl.host} încă servește site-ul fără să redirecționeze către versiunea securizată, deci unii vizitatori și linkurile vechi folosesc site-ul necriptat.`,
            ),
            recommendation: bi(
              "We send every http:// page permanently to its https:// address.",
              "Trimitem permanent fiecare pagină http:// la adresa ei https://.",
            ),
          }
        : null,
  },
  {
    id: "security.no-hsts",
    category: "security",
    run: (ctx) =>
      ctx.https && !ctx.headers.get("strict-transport-security")
        ? {
            severity: "low",
            effort: "quick",
            title: bi(
              "Browsers aren't told to stay on HTTPS",
              "Browserelor nu li se cere să rămână pe HTTPS",
            ),
            detail: bi(
              "Browsers aren't told to always use HTTPS, so a first visit can be downgraded to HTTP on public Wi-Fi.",
              "Browserelor nu li se cere să folosească mereu HTTPS, deci o primă vizită poate fi forțată pe HTTP într-o rețea Wi-Fi publică.",
            ),
            recommendation: bi(
              "We tell browsers to always use the secure connection (the HSTS setting on the server).",
              "Le cerem browserelor să folosească mereu conexiunea securizată (setarea HSTS de pe server).",
            ),
            evidence: "Strict-Transport-Security header missing",
          }
        : null,
  },
  {
    id: "security.no-csp",
    category: "security",
    run: (ctx) =>
      ctx.headers.get("content-security-policy") ||
      ctx.headers.get("content-security-policy-report-only") ||
      /http-equiv=["']?content-security-policy/i.test(ctx.home.html)
        ? null
        : {
            severity: "low",
            effort: "medium",
            title: bi("No Content Security Policy", "Fără Content Security Policy"),
            detail: bi(
              "No CSP header limits which scripts may run, so an injected script (for example through a vulnerable plugin) runs unchecked.",
              "Niciun antet CSP nu limitează ce scripturi pot rula, deci un script injectat (de exemplu printr-un plugin vulnerabil) rulează fără nicio restricție.",
            ),
            recommendation: bi(
              "We add a rule that limits which scripts the site may load: first in test mode, then for real.",
              "Adăugăm o regulă care limitează ce scripturi poate încărca site-ul: întâi în mod de test, apoi definitiv.",
            ),
            evidence: "Content-Security-Policy header missing",
          },
  },
  {
    id: "security.no-nosniff",
    category: "security",
    run: (ctx) =>
      /nosniff/i.test(ctx.headers.get("x-content-type-options") ?? "")
        ? null
        : {
            severity: "low",
            effort: "quick",
            title: bi("Missing X-Content-Type-Options", "Lipsește X-Content-Type-Options"),
            detail: bi(
              "Without nosniff, browsers may guess file types, which attackers can abuse to run uploaded files as scripts.",
              "Fără nosniff, browserele pot ghici tipul fișierelor, iar atacatorii pot folosi asta pentru a rula fișiere încărcate ca scripturi.",
            ),
            recommendation: bi(
              "We add the standard setting that stops browsers from guessing file types.",
              "Adăugăm setarea standard care oprește browserele să ghicească tipul fișierelor.",
            ),
          },
  },
  {
    id: "security.no-clickjacking-protection",
    category: "security",
    run: (ctx) => {
      const csp = ctx.headers.get("content-security-policy") ?? "";
      if (ctx.headers.get("x-frame-options") || /frame-ancestors/i.test(csp)) return null;
      return {
        severity: "low",
        effort: "quick",
        title: bi(
          "Site can be framed by others",
          "Site-ul poate fi afișat în interiorul altor site-uri",
        ),
        detail: bi(
          "There's no X-Frame-Options or frame-ancestors rule, so another site could load yours in a hidden frame (clickjacking).",
          "Nu există X-Frame-Options sau frame-ancestors, deci alt site poate încărca site-ul tău într-un cadru ascuns (clickjacking).",
        ),
        recommendation: bi(
          "We stop other sites from showing yours inside a frame.",
          "Oprim alte site-uri să afișeze site-ul tău într-un cadru.",
        ),
      };
    },
  },
  {
    id: "security.mixed-content",
    category: "security",
    needs: "content",
    run: (ctx) => {
      const insecure = [...new Set(okPages(ctx).flatMap((page) => page.mixedContent))];
      if (!insecure.length) return null;
      return {
        severity: "high",
        effort: "quick",
        title: bi("Insecure files on secure pages", "Fișiere nesigure pe pagini securizate"),
        detail: bi(
          `${insecure.length === 1 ? "A file (image, script or style) loads" : `${insecure.length} files (images, scripts or styles) load`} over http:// on HTTPS pages. Browsers block or flag ${insecure.length === 1 ? "it" : "them"}, which can break the layout or show a warning.`,
          `${insecure.length === 1 ? "Un fișier (imagine, script sau stil) se încarcă" : `${insecure.length} ${de(insecure.length)}fișiere (imagini, scripturi sau stiluri) se încarcă`} prin http:// pe pagini HTTPS. Browserele ${insecure.length === 1 ? "îl blochează sau îl semnalează" : "le blochează sau le semnalează"}, ceea ce poate strica aspectul ori afișa un avertisment.`,
        ),
        recommendation: bi(
          "We change those addresses to https:// (usually one search-and-replace).",
          "Schimbăm acele adrese în https:// (de obicei, o singură căutare și înlocuire).",
        ),
        evidence: clip(insecure[0], 90),
      };
    },
  },
  {
    id: "security.insecure-form",
    category: "security",
    needs: "content",
    run: (ctx) => {
      const actions = okPages(ctx).flatMap((page) => page.insecureFormActions);
      if (!actions.length) return null;
      return {
        severity: "high",
        effort: "quick",
        title: bi("Form sends data unencrypted", "Un formular trimite datele necriptat"),
        detail: bi(
          "A form on the site submits to an http:// address, so what visitors type travels unencrypted.",
          "Un formular de pe site trimite datele către o adresă http://, deci ce scriu vizitatorii circulă necriptat.",
        ),
        recommendation: bi(
          "We send the form's data to a secure https:// address.",
          "Trimitem datele din formular la o adresă securizată https://.",
        ),
        evidence: clip(actions[0], 90),
      };
    },
  },
  {
    id: "security.no-cookie-consent",
    category: "security",
    needs: "content",
    run: (ctx) => {
      const trackers = trackersOf(ctx);
      if (!trackers.length || ctx.signals.hasCookieConsent) return null;
      const names = list(trackers, 4);
      return {
        severity: "high",
        effort: "quick",
        title: bi(
          "Tracking without cookie consent",
          "Urmărirea vizitatorilor fără acord pentru cookie-uri",
        ),
        detail: bi(
          `${names} load${trackers.length === 1 ? "s" : ""} and we found no consent banner, which goes against GDPR and the cookie law (Law 506/2004 in Romania).`,
          `${names} se încarcă și nu am găsit un banner de acord pentru cookie-uri, ceea ce contravine GDPR și legii cookie-urilor (Legea 506/2004).`,
        ),
        recommendation: bi(
          "We add a consent banner and start the visitor statistics and ad tracking only after the visitor agrees.",
          "Adăugăm un banner de acord și pornim statisticile de trafic și urmărirea pentru reclame doar după ce vizitatorul acceptă.",
        ),
        evidence: names,
      };
    },
  },
  {
    id: "security.trackers-before-consent",
    category: "security",
    needs: "content",
    run: (ctx) => {
      if (!ctx.signals.hasCookieConsent || ctx.extra.hasConsentMode) return null;
      if (has(ctx, "Google Tag Manager") || /data-blockingmode=["']auto/i.test(ctx.home.html)) {
        return null; // consent may be enforced inside GTM or by auto-blocking we can't see
      }
      const direct = ctx.home.scripts.filter(
        (script) => script.src && TRACKER_SCRIPT.test(script.src) && script.type !== "text/plain",
      );
      if (!direct.length) return null;
      return {
        severity: "low",
        effort: "medium",
        title: bi(
          "Trackers may load before consent",
          "Scripturile de urmărire pot porni înainte de acord",
        ),
        detail: bi(
          "Tracking scripts are included directly in the page and nothing holds them back, so they may run before the visitor answers the cookie banner.",
          "Scripturile de urmărire sunt incluse direct în pagină și nimic nu le oprește, deci pot rula înainte ca vizitatorul să răspundă la bannerul de cookie-uri.",
        ),
        recommendation: bi(
          "We check that no tracking cookies are set before consent and turn on the banner's automatic blocking.",
          "Verificăm că nu se pun cookie-uri de urmărire înainte de acord și activăm blocarea automată din banner.",
        ),
        evidence: basename(direct[0].src!),
      };
    },
  },
  {
    id: "security.no-privacy-policy",
    category: "security",
    needs: "rendered",
    run: (ctx) => {
      const collects =
        ctx.signals.hasContactForm ||
        ctx.signals.hasNewsletter ||
        ctx.signals.hasEcommerce ||
        trackersOf(ctx).length > 0;
      if (ctx.extra.hasPrivacyPolicy || !collects) return null;
      return {
        severity: ctx.signals.hasEcommerce || ctx.signals.hasContactForm ? "high" : "medium",
        effort: "quick",
        title: bi("No privacy policy", "Lipsește politica de confidențialitate"),
        detail: bi(
          "We couldn't find a privacy policy link, although the site collects personal data (forms or tracking). GDPR requires telling visitors what you collect and why.",
          "Nu am găsit un link către politica de confidențialitate, deși site-ul colectează date personale (formulare sau scripturi de urmărire). GDPR cere să le spui vizitatorilor ce date colectezi și de ce.",
        ),
        recommendation: bi(
          "We publish a privacy policy (who you are, what data, why, for how long, visitors' rights) and link it in the footer and by every form.",
          "Publicăm o politică de confidențialitate (cine ești, ce date, de ce, cât timp, drepturile vizitatorilor) și punem linkul în subsol și lângă fiecare formular.",
        ),
      };
    },
  },
  {
    id: "security.no-anpc-link",
    category: "security",
    needs: "rendered",
    run: (ctx) =>
      ctx.signals.hasEcommerce && !ctx.extra.hasAnpcLink && isRomanianSite(ctx)
        ? {
            severity: "high",
            effort: "quick",
            title: bi(
              "No ANPC consumer information",
              "Lipsesc informațiile ANPC pentru consumatori",
            ),
            detail: bi(
              "Romanian online shops must show the ANPC alternative dispute resolution (SAL) information with a link to anpc.ro; we found no such link.",
              "Magazinele online din România trebuie să afișeze informațiile ANPC despre soluționarea alternativă a litigiilor (SAL), cu link către anpc.ro; nu am găsit un astfel de link.",
            ),
            recommendation: bi(
              "We add the ANPC SAL badge, with its link, to the footer.",
              "Adăugăm în subsol pictograma ANPC SAL, cu linkul ei.",
            ),
          }
        : null,
  },
  {
    id: "security.outdated-odr-link",
    category: "security",
    needs: "content",
    run: (ctx) =>
      ctx.extra.hasOdrLink
        ? {
            severity: "low",
            effort: "quick",
            title: bi("Outdated EU ODR (SOL) link", "Link SOL (ODR) învechit"),
            detail: bi(
              "The site links to the EU online dispute resolution platform, which the EU closed on 20 July 2025, so the link now leads to a closure notice.",
              "Site-ul are link către platforma europeană de soluționare online a litigiilor (SOL), închisă de UE pe 20 iulie 2025, deci linkul duce acum la un anunț de închidere.",
            ),
            recommendation: bi(
              "We remove or update the SOL badge and keep the ANPC SAL information.",
              "Scoatem sau actualizăm pictograma SOL și păstrăm informațiile ANPC SAL.",
            ),
            evidence: "ec.europa.eu/consumers/odr",
          }
        : null,
  },
  {
    id: "security.no-terms",
    category: "security",
    needs: "rendered",
    run: (ctx) =>
      ctx.signals.hasEcommerce && !ctx.extra.hasTerms
        ? {
            severity: "medium",
            effort: "quick",
            title: bi("No terms and conditions", "Lipsesc termenii și condițiile"),
            detail: bi(
              "The shop has no visible terms and conditions link (ordering, delivery, returns), which consumer law expects before a purchase.",
              "Magazinul nu are un link vizibil către termeni și condiții (comandă, livrare, retur), lucru cerut de legislația de protecție a consumatorilor înainte de cumpărare.",
            ),
            recommendation: bi(
              "We publish terms for ordering, prices, delivery, the 14-day withdrawal right and returns, linked in the footer and at checkout.",
              "Publicăm termeni pentru comandă, prețuri, livrare, dreptul de retragere de 14 zile și retur, cu link în subsol și la finalizarea comenzii.",
            ),
          }
        : null,
  },
  {
    id: "security.no-company-details",
    category: "security",
    needs: "rendered",
    run: (ctx) =>
      ctx.signals.cuiOnSite || !isRomanianSite(ctx)
        ? null
        : {
            severity: ctx.signals.hasEcommerce ? "medium" : "low",
            effort: "quick",
            title: bi("Company details not shown", "Datele firmei nu sunt afișate"),
            detail: bi(
              `We couldn't find the company's fiscal code (CUI) on ${ctx.pages.length === 1 ? "the page" : `the ${ctx.pages.length} pages`} we analysed. Romanian law (Law 365/2002) asks websites to show the company name, address, registration number and CUI, and customers use them to check who they're dealing with.`,
              `Nu am găsit codul fiscal (CUI) al firmei ${ctx.pages.length === 1 ? "pe pagina analizată" : `în cele ${ctx.pages.length} pagini analizate`}. Legea 365/2002 cere site-urilor să afișeze denumirea, adresa, numărul de înregistrare și CUI-ul firmei, iar clienții le folosesc ca să verifice cu cine au de-a face.`,
            ),
            recommendation: bi(
              "We add the company name, CUI, Trade Register number and address to the footer or the contact page.",
              "Adăugăm în subsol sau pe pagina de contact denumirea firmei, CUI-ul, numărul de la Registrul Comerțului și adresa.",
            ),
          },
  },
  {
    id: "security.server-version-exposed",
    category: "security",
    run: (ctx) => {
      const values = [ctx.headers.get("server"), ctx.headers.get("x-powered-by")].filter(
        (value): value is string => Boolean(value && /\/\s?\d/.test(value)),
      );
      if (!values.length) return null;
      return {
        severity: "low",
        effort: "quick",
        title: bi(
          "Server software version is public",
          "Versiunea software a serverului este publică",
        ),
        detail: bi(
          `Response headers reveal "${clip(values.join(", "), 60)}", which helps attackers look up known vulnerabilities.`,
          `Anteturile răspunsului dezvăluie „${clip(values.join(", "), 60)}”, ceea ce îi ajută pe atacatori să caute vulnerabilități cunoscute.`,
        ),
        recommendation: bi(
          "We hide the software version numbers the server shows.",
          "Ascundem numerele de versiune pe care le arată serverul.",
        ),
        evidence: values.join(", "),
      };
    },
  },
  {
    id: "security.insecure-cookies",
    category: "security",
    run: (ctx) => {
      if (!ctx.https) return null;
      const insecure = ctx.setCookies
        .filter((cookie) => !/;\s*secure/i.test(cookie))
        .map((cookie) => cookie.split("=")[0].trim());
      if (!insecure.length) return null;
      return {
        severity: "low",
        effort: "quick",
        title: bi("Cookies not marked as secure", "Cookie-uri nemarcate ca securizate"),
        detail: bi(
          `The site sets ${insecure.length} cookie${insecure.length === 1 ? "" : "s"} without the Secure flag (${list(insecure)}), so ${insecure.length === 1 ? "it" : "they"} can be sent over unencrypted connections.`,
          `Site-ul setează ${insecure.length === 1 ? "un cookie" : `${insecure.length} cookie-uri`} fără atributul Secure (${list(insecure)}), care pot fi trimise prin conexiuni necriptate.`,
        ),
        recommendation: bi(
          "We mark the site's cookies as secure, in the server or platform settings.",
          "Marcăm cookie-urile site-ului ca securizate, din setările serverului sau ale platformei.",
        ),
        evidence: list(insecure),
      };
    },
  },

  /* ------------------------------------------------- conversion & trust */
  {
    id: "conversion.no-cta-near-top",
    category: "conversion",
    needs: "rendered",
    run: (ctx) =>
      ctx.home.ctaNearTop
        ? null
        : {
            severity: "medium",
            effort: "quick",
            title: bi(
              "No clear call to action at the top",
              "Fără un îndemn clar la acțiune în partea de sus",
            ),
            detail: bi(
              "The top of the homepage has no obvious button or link telling visitors what to do next (call, book, request a quote).",
              "Partea de sus a paginii principale nu are un buton sau link evident care să le spună vizitatorilor ce să facă mai departe (să sune, să se programeze, să ceară o ofertă).",
            ),
            recommendation: bi(
              "We add one clear button next to the headline, e.g. “Book a visit” or “Get a quote”, plus tap-to-call on phones.",
              "Adăugăm un buton vizibil lângă titlu, de exemplu „Programează-te” sau „Cere ofertă”, plus apel direct de pe telefon.",
            ),
          },
  },
  {
    id: "conversion.no-contact-form",
    category: "conversion",
    needs: "rendered",
    run: (ctx) => {
      const { hasContactForm, hasPhone, hasEmail, hasEcommerce } = ctx.signals;
      if (hasContactForm) return null;
      // A sign-up / quote / apply flow already captures leads, so the gap is smaller.
      const leadFlow = ctx.home.links.some((link) =>
        /sign-?up|register|onboarding|apply|get-started|quote|cere-oferta|solicita|inscrie|inregistr/i.test(
          link.href,
        ),
      );
      return {
        severity: !hasPhone && !hasEmail ? "high" : hasEcommerce || leadFlow ? "low" : "medium",
        effort: "quick",
        title: bi("No contact form", "Fără formular de contact"),
        detail: bi(
          "Visitors can't send you a message from the site; people who don't want to call or write an email at that moment simply leave.",
          "Vizitatorii nu îți pot trimite un mesaj de pe site; cei care nu vor să sune sau să scrie un e-mail în acel moment pur și simplu pleacă.",
        ),
        recommendation: bi(
          "We add a short form (name, phone or email, message) that also sends an automatic confirmation.",
          "Adăugăm un formular scurt (nume, telefon sau e-mail, mesaj), care trimite și o confirmare automată.",
        ),
        evidence: `${ctx.pages.length} page${ctx.pages.length === 1 ? "" : "s"} analysed`,
      };
    },
  },
  {
    id: "conversion.no-phone",
    category: "conversion",
    needs: "rendered",
    run: (ctx) =>
      ctx.signals.hasPhone
        ? null
        : {
            severity: ctx.signals.hasEcommerce ? "low" : "medium",
            effort: "quick",
            title: bi("No phone number", "Fără număr de telefon"),
            detail: bi(
              "We couldn't find a phone number on the pages we analysed, although many customers still prefer a call for the first contact.",
              "Nu am găsit un număr de telefon în paginile analizate, deși mulți clienți preferă încă un apel pentru primul contact.",
            ),
            recommendation: bi(
              "We show the phone number in the header and footer, tappable to call.",
              "Afișăm numărul de telefon în antet și în subsol, cu apel direct la atingere.",
            ),
          },
  },
  {
    id: "conversion.phone-not-clickable",
    category: "conversion",
    needs: "rendered",
    run: (ctx) =>
      ctx.extra.phoneInTextOnly
        ? {
            severity: "medium",
            effort: "quick",
            title: bi(
              "Phone number isn't tappable",
              "Numărul de telefon nu poate fi apelat direct",
            ),
            detail: bi(
              "The phone number appears as plain text, so mobile visitors must copy it by hand instead of tapping to call.",
              "Numărul de telefon apare ca text simplu, deci vizitatorii de pe mobil trebuie să-l copieze manual în loc să atingă pentru apel.",
            ),
            recommendation: bi(
              "We make the number tappable, so a tap starts the call.",
              "Facem numărul apelabil: o atingere pornește apelul.",
            ),
          }
        : null,
  },
  {
    id: "conversion.no-email",
    category: "conversion",
    needs: "rendered",
    run: (ctx) =>
      ctx.signals.hasEmail
        ? null
        : {
            severity: "low",
            effort: "quick",
            title: bi("No email address", "Fără adresă de e-mail"),
            detail: bi(
              "There's no visible email address; some customers (and most companies) prefer writing to calling.",
              "Nu există o adresă de e-mail vizibilă; unii clienți (și majoritatea companiilor) preferă să scrie decât să sune.",
            ),
            recommendation: bi(
              "We show an address on your own domain (e.g. contact@yourbusiness.ro) that opens an email.",
              "Afișăm o adresă pe domeniul tău (de exemplu contact@afacereata.ro), care deschide direct un e-mail.",
            ),
          },
  },
  {
    id: "conversion.no-whatsapp",
    category: "conversion",
    needs: "rendered",
    run: (ctx) =>
      ctx.signals.hasWhatsApp
        ? null
        : {
            severity: "low",
            effort: "quick",
            title: bi("No WhatsApp contact", "Fără contact pe WhatsApp"),
            detail: bi(
              "There's no click-to-chat WhatsApp option. Many customers prefer a quick message to a phone call, especially outside office hours.",
              "Nu există opțiunea de chat rapid pe WhatsApp. Mulți clienți preferă un mesaj scurt în locul unui apel, mai ales în afara programului.",
            ),
            recommendation: bi(
              "We add a WhatsApp Business button with quick replies for prices and availability.",
              "Adăugăm un buton WhatsApp Business, cu răspunsuri rapide pentru prețuri și disponibilitate.",
            ),
          },
  },
  {
    id: "conversion.no-online-booking",
    category: "conversion",
    needs: "rendered",
    run: (ctx) => {
      if (ctx.signals.hasOnlineBooking || ctx.signals.hasEcommerce) return null;
      const intent = ctx.extra.bookingIntent;
      return {
        severity: intent ? "medium" : "low",
        effort: "medium",
        title: bi("No online booking", "Fără programare online"),
        detail: intent
          ? bi(
              "The site invites visitors to book, but only by phone or form, so bookings stop when nobody is free to answer.",
              "Site-ul îi invită pe vizitatori să se programeze, dar doar telefonic sau prin formular, deci programările se opresc când nu are cine să răspundă.",
            )
          : bi(
              "Customers can't book or reserve online. If you work by appointment, a booking page lets people book at any hour.",
              "Clienții nu pot face programări sau rezervări online. Dacă lucrezi pe bază de programare, o pagină de rezervări le permite să se programeze la orice oră.",
            ),
        recommendation: bi(
          "We add a booking calendar with real free slots, automatic confirmations and reminders.",
          "Adăugăm un calendar de programări cu locuri libere reale, confirmări și reamintiri automate.",
        ),
      };
    },
  },
  {
    id: "conversion.no-live-chat",
    category: "conversion",
    needs: "rendered",
    run: (ctx) =>
      ctx.signals.hasLiveChat
        ? null
        : {
            severity: "low",
            effort: "medium",
            title: bi("No live chat or instant answers", "Fără chat live sau răspunsuri imediate"),
            detail: bi(
              "Visitors with a quick question (price, availability, location) have no way to get an instant answer on the site.",
              "Vizitatorii cu o întrebare rapidă (preț, disponibilitate, locație) nu pot primi un răspuns imediat pe site.",
            ),
            recommendation: bi(
              "We add a chat or an AI assistant that knows your services and hands over to a colleague when needed.",
              "Adăugăm un chat sau un asistent AI care îți cunoaște serviciile și transferă conversația unui coleg când e nevoie.",
            ),
          },
  },
  {
    id: "conversion.no-reviews",
    category: "conversion",
    needs: "rendered",
    run: (ctx) =>
      ctx.extra.hasReviews
        ? null
        : {
            severity: "low",
            effort: "medium",
            title: bi("No reviews or testimonials", "Fără recenzii sau testimoniale"),
            detail: bi(
              "We found no reviews, testimonials or rating widget. Social proof is one of the strongest reasons first-time visitors trust a business.",
              "Nu am găsit recenzii, testimoniale sau un widget de evaluări. Părerile altor clienți sunt unul dintre cele mai puternice motive pentru care vizitatorii noi au încredere într-o afacere.",
            ),
            recommendation: bi(
              "We show your real Google reviews on the site and automatically ask happy customers for a review after each visit or order.",
              "Afișăm pe site recenziile tale reale din Google și le cerem automat clienților mulțumiți o recenzie după fiecare vizită sau comandă.",
            ),
          },
  },
  {
    id: "conversion.no-prices",
    category: "conversion",
    needs: "rendered",
    run: (ctx) =>
      ctx.extra.hasPrices || ctx.signals.hasEcommerce
        ? null
        : {
            severity: "low",
            effort: "quick",
            title: bi("No prices or price ranges", "Fără prețuri sau intervale de preț"),
            detail: bi(
              "We found no prices on the pages we analysed. Visitors who can't estimate the cost often leave to compare elsewhere, or call just to ask.",
              "Nu am găsit prețuri în paginile analizate. Vizitatorii care nu pot estima costul pleacă adesea să compare în altă parte sau sună doar ca să întrebe.",
            ),
            recommendation: bi(
              "We publish indicative or “from” prices for your main services.",
              "Publicăm prețuri orientative sau „de la” pentru serviciile principale.",
            ),
          },
  },
  {
    id: "conversion.no-trust-signals",
    category: "conversion",
    needs: "rendered",
    run: (ctx) =>
      ctx.signals.hasEcommerce && !ctx.extra.hasTrustBadges
        ? {
            severity: "low",
            effort: "quick",
            title: bi(
              "Few trust signals for shoppers",
              "Puține elemente de încredere pentru cumpărători",
            ),
            detail: bi(
              "The shop doesn't show payment security, delivery or return guarantees where buyers look for them.",
              "Magazinul nu afișează securitatea plății, garanțiile de livrare sau de retur acolo unde le caută cumpărătorii.",
            ),
            recommendation: bi(
              "We show the payment methods, secure payment and the return policy near the cart and in the footer.",
              "Afișăm metodele de plată, plata securizată și politica de retur lângă coș și în subsol.",
            ),
          }
        : null,
  },
  {
    id: "conversion.no-social-links",
    category: "conversion",
    needs: "rendered",
    run: (ctx) => {
      const social = ctx.signals.socialLinks.filter((url) => !/google|g\.page|goo\.gl/i.test(url));
      if (social.length || deadSocialLinks(ctx).length) return null;
      return {
        severity: "low",
        effort: "quick",
        title: bi("No links to social profiles", "Fără linkuri către profilurile sociale"),
        detail: bi(
          "The site doesn't link to any social profile, so visitors can't check your recent activity and reviews there.",
          "Site-ul nu are linkuri către profiluri sociale, deci vizitatorii nu pot verifica acolo activitatea și recenziile tale recente.",
        ),
        recommendation: bi(
          "We link your active profiles (Facebook, Instagram, LinkedIn…) in the footer and tell Google about them.",
          "Punem în subsol linkuri către profilurile active (Facebook, Instagram, LinkedIn…) și îi spunem lui Google de ele.",
        ),
      };
    },
  },
  {
    id: "conversion.dead-social-links",
    category: "conversion",
    needs: "rendered",
    run: (ctx) => {
      const dead = deadSocialLinks(ctx);
      if (!dead.length) return null;
      const names = [...new Set(dead.map((link) => link.text.trim()))];
      return {
        severity: "medium",
        effort: "quick",
        title: bi("Social icons link nowhere", "Pictogramele sociale nu duc nicăieri"),
        detail: bi(
          `The ${list(names, 4)} icon${names.length === 1 ? "" : "s"} on the homepage point to "#", so visitors who click expecting your profile stay on the same page.`,
          `Pictogramele ${list(names, 4)} de pe pagina principală trimit către „#”, deci vizitatorii care se așteaptă să vadă profilul tău rămân pe aceeași pagină.`,
        ),
        recommendation: bi(
          "We link each icon to the real profile, or remove the icons of networks you don't use.",
          "Legăm fiecare pictogramă de profilul real sau scoatem pictogramele rețelelor pe care nu le folosești.",
        ),
        evidence: dead
          .slice(0, 3)
          .map((link) => `${link.text.trim()} → "${link.href}"`)
          .join(", "),
      };
    },
  },
  {
    id: "conversion.no-map",
    category: "conversion",
    needs: "rendered",
    run: (ctx) =>
      ctx.extra.hasAddress && !ctx.extra.hasMap
        ? {
            severity: "low",
            effort: "quick",
            title: bi("Address without a map link", "Adresă fără link către hartă"),
            detail: bi(
              "The site shows an address but no map or Google Maps link, so visitors have to copy it to find you.",
              "Site-ul afișează o adresă, dar nu și o hartă sau un link Google Maps, deci vizitatorii trebuie să o copieze ca să te găsească.",
            ),
            recommendation: bi(
              "We link the address to your Google Business profile or put a map on the contact page.",
              "Legăm adresa de profilul Google Business sau punem o hartă pe pagina de contact.",
            ),
          }
        : null,
  },
  {
    id: "conversion.no-newsletter",
    category: "conversion",
    needs: "rendered",
    run: (ctx) =>
      ctx.signals.hasEcommerce && !ctx.signals.hasNewsletter
        ? {
            severity: "low",
            effort: "quick",
            title: bi("No newsletter sign-up", "Fără abonare la newsletter"),
            detail: bi(
              "The shop has no email sign-up, so visitors who aren't ready to buy today leave without a reason to come back.",
              "Magazinul nu are formular de abonare, deci vizitatorii care nu cumpără azi pleacă fără un motiv să revină.",
            ),
            recommendation: bi(
              "We add a sign-up with a small incentive and an automatic series of welcome emails.",
              "Adăugăm un formular de abonare cu un mic beneficiu și o serie automată de e-mailuri de bun venit.",
            ),
          }
        : null,
  },

  /* ------------------------------------------------ content & localisation */
  {
    id: "content.no-english",
    category: "content",
    needs: "rendered",
    run: (ctx) => {
      const languages = ctx.signals.languages;
      if (!languages.includes("ro") || languages.includes("en")) return null;
      if (ctx.pages.some((page) => page.languageSwitcher)) return null; // other languages load via JS
      return {
        severity: "low",
        effort: "project",
        title: bi("No English version", "Fără versiune în engleză"),
        detail: bi(
          "The site is only in Romanian. Tourists, expats and foreign partners searching in English can't use it.",
          "Site-ul este doar în limba română. Turiștii, expații și partenerii străini care caută în engleză nu îl pot folosi.",
        ),
        recommendation: bi(
          "We add an English version of the key pages (services, prices, contact), linked to the Romanian ones for Google.",
          "Adăugăm o versiune în engleză a paginilor importante (servicii, prețuri, contact), legată de cea în română pentru Google.",
        ),
        evidence: `Languages found: ${languages.join(", ")}`,
      };
    },
  },
  {
    id: "content.no-romanian",
    category: "content",
    needs: "rendered",
    run: (ctx) => {
      const languages = ctx.signals.languages;
      if (!languages.length || languages.includes("ro") || !isRomanianSite(ctx)) return null;
      if (ctx.pages.some((page) => page.languageSwitcher)) return null; // other languages load via JS
      return {
        severity: "medium",
        effort: "project",
        title: bi("No Romanian version", "Fără versiune în română"),
        detail: bi(
          "The site has no Romanian version although the business is Romanian, so local customers searching in Romanian find and trust it less easily.",
          "Site-ul nu are versiune în română, deși afacerea este românească, deci clienții locali care caută în română îl găsesc și au încredere în el mai greu.",
        ),
        recommendation: bi(
          "We publish Romanian versions of the main pages, linked to the others for Google.",
          "Publicăm versiuni în română ale paginilor principale, legate de celelalte pentru Google.",
        ),
        evidence: `Languages found: ${languages.join(", ")}`,
      };
    },
  },
  {
    id: "content.no-blog",
    category: "content",
    needs: "rendered",
    run: (ctx) =>
      ctx.signals.hasBlog
        ? null
        : {
            severity: "low",
            effort: "project",
            title: bi("No blog or articles", "Fără blog sau articole"),
            detail: bi(
              "There's no blog, news or guides section. Helpful articles are how small businesses get found for the questions customers search.",
              "Nu există o secțiune de blog, noutăți sau ghiduri. Prin articole utile, afacerile mici apar în Google la întrebările pe care le caută clienții.",
            ),
            recommendation: bi(
              "We publish one practical article a month that answers a real customer question (prices, how it works, before and after).",
              "Publicăm lunar un articol practic care răspunde la o întrebare reală a clienților (prețuri, cum funcționează, înainte și după).",
            ),
          },
  },
  {
    id: "content.blog-inactive",
    category: "content",
    needs: "rendered",
    run: (ctx) => {
      const latest = ctx.extra.latestContentDate;
      if (!ctx.signals.hasBlog || !latest) return null;
      const age = ctx.now.getTime() - Date.parse(latest);
      if (age < 365 * 86_400_000) return null;
      const when = both((lang) =>
        new Intl.DateTimeFormat(locale(lang), { month: "long", year: "numeric" }).format(
          new Date(latest),
        ),
      );
      return {
        severity: "low",
        effort: "medium",
        title: bi(
          "Content hasn't been updated recently",
          "Conținutul nu a mai fost actualizat de mult",
        ),
        detail: bi(
          `The newest dated content we found is from ${when.en}. An inactive blog can make the business itself look inactive.`,
          `Cel mai recent conținut datat pe care l-am găsit este din ${when.ro}. Un blog inactiv poate face ca afacerea însăși să pară inactivă.`,
        ),
        recommendation: bi(
          "We plan regular posts, or hide the dates and the blog link until there are some.",
          "Planificăm articole regulate sau ascundem datele și linkul către blog până apar.",
        ),
        evidence: latest.slice(0, 10),
      };
    },
  },
  {
    id: "content.stale-copyright",
    category: "content",
    needs: "rendered",
    run: (ctx) => {
      const year = ctx.home.copyrightYear;
      if (!year || year >= ctx.now.getFullYear() - 1) return null;
      return {
        severity: "low",
        effort: "quick",
        title: bi("Outdated copyright year", "Anul din copyright este vechi"),
        detail: bi(
          `The footer says © ${year}, which makes the site look unmaintained.`,
          `Subsolul afișează © ${year}, ceea ce face site-ul să pară neîntreținut.`,
        ),
        recommendation: bi(
          "We update the year (or make it update itself) and check the content for other outdated details.",
          "Actualizăm anul (sau îl facem să se actualizeze singur) și verificăm dacă mai sunt informații învechite.",
        ),
        evidence: `© ${year}`,
      };
    },
  },
  {
    id: "content.placeholder-text",
    category: "content",
    needs: "rendered",
    run: (ctx) => {
      const pattern =
        /lorem ipsum|dolor sit amet|just another wordpress site|un alt site wordpress|hello world!|salut,? lume!|sample page|pagină exemplu/i;
      for (const page of okPages(ctx)) {
        const match = pattern.exec(page.text);
        if (!match) continue;
        const where = page.url === ctx.home.url ? "the homepage" : new URL(page.url).pathname;
        const whereRo =
          page.url === ctx.home.url ? "pagina principală" : new URL(page.url).pathname;
        return {
          severity: "high",
          effort: "quick",
          title: bi("Placeholder text is still online", "Text de umplutură încă publicat"),
          detail: bi(
            `We found template text ("${match[0]}") on ${where}, which tells visitors the site isn't finished.`,
            `Am găsit text din șablon („${match[0]}”) pe ${whereRo}, ceea ce le arată vizitatorilor că site-ul nu este terminat.`,
          ),
          recommendation: bi(
            "We replace the template text with real content or remove the section.",
            "Înlocuim textul din șablon cu conținut real sau scoatem secțiunea.",
          ),
          evidence: `${match[0]} · ${page.url}`,
        };
      }
      return null;
    },
  },
  {
    id: "content.broken-pages",
    category: "content",
    run: (ctx) => {
      const broken = ctx.brokenPages;
      if (!broken.length) return null;
      const evidence = broken
        .slice(0, 3)
        .map((page) => `${new URL(page.url).pathname} → ${page.status}`)
        .join(", ");
      return {
        severity: "medium",
        effort: "quick",
        title: bi("Broken pages in the navigation", "Pagini din meniu care dau eroare"),
        detail: bi(
          `${broken.length} of the pages linked from the homepage ${broken.length === 1 ? "returns" : "return"} an error (${evidence}).`,
          `${broken.length === 1 ? "Una" : broken.length} dintre paginile cu link de pe pagina principală returnează o eroare (${evidence}).`,
        ),
        recommendation: bi(
          "We fix or redirect these links; broken pages lose visitors and Google's attention.",
          "Reparăm sau redirecționăm aceste linkuri; paginile care nu merg pierd vizitatori și atenția lui Google.",
        ),
        evidence,
      };
    },
  },
  {
    id: "content.default-share-image",
    category: "content",
    needs: "content",
    run: (ctx) => {
      const image = ctx.home.og.image ?? "";
      if (
        !/lovable\.dev\/opengraph-image|woocommerce-placeholder|placeholder\.(png|jpg)|default-og/i.test(
          image,
        )
      ) {
        return null;
      }
      return {
        severity: "medium",
        effort: "quick",
        title: bi("Default template share image", "Imagine implicită de distribuire"),
        detail: bi(
          "Links to the site show the website builder's default preview image instead of your brand.",
          "Linkurile către site afișează imaginea implicită a platformei în locul brandului tău.",
        ),
        recommendation: bi(
          "We add your own 1200×630 image for when the site is shared.",
          "Punem o imagine proprie de 1200×630 pentru când site-ul e distribuit.",
        ),
        evidence: clip(image, 90),
      };
    },
  },

  /* -------------------------------------------------------- technology */
  {
    id: "technology.outdated-jquery",
    category: "technology",
    needs: "content",
    run: (ctx) => {
      const version = ctx.technologies.find((t) => t.name === "jQuery")?.version;
      if (!version || compareVersions(version, "3.5.0") >= 0) return null;
      return {
        severity: "medium",
        effort: "medium",
        title: bi("Outdated jQuery", "jQuery învechit"),
        detail: bi(
          `The site loads jQuery ${version}; versions before 3.5 have known security vulnerabilities (XSS).`,
          `Site-ul încarcă jQuery ${version}; versiunile mai vechi de 3.5 au vulnerabilități de securitate cunoscute (XSS).`,
        ),
        recommendation: bi(
          "We update the old jQuery library and the plugins that use it, or remove it if it's no longer needed.",
          "Actualizăm biblioteca jQuery veche și modulele care o folosesc sau o scoatem dacă nu mai e necesară.",
        ),
        evidence: `jQuery ${version}`,
      };
    },
  },
  {
    id: "technology.outdated-wordpress",
    category: "technology",
    needs: "content",
    run: (ctx) => {
      const version = ctx.technologies.find((t) => t.name === "WordPress")?.version;
      if (!version || compareVersions(version, "6.5") >= 0) return null;
      return {
        severity: compareVersions(version, "6.0") < 0 ? "high" : "medium",
        effort: "medium",
        title: bi("Outdated WordPress", "WordPress învechit"),
        detail: bi(
          `The site reports WordPress ${version}, a release that is more than two years old. Outdated installs are the most common way small-business sites get hacked.`,
          `Site-ul raportează WordPress ${version}, o versiune mai veche de doi ani. Instalările neactualizate sunt cea mai des întâlnită cale prin care site-urile firmelor mici sunt sparte.`,
        ),
        recommendation: bi(
          "We back up the site, then update WordPress, the theme and all plugins, and turn on automatic minor updates.",
          "Facem o copie de siguranță, apoi actualizăm WordPress, tema și toate modulele și pornim actualizările automate minore.",
        ),
        evidence: `WordPress ${version}`,
      };
    },
  },
  {
    id: "technology.outdated-php",
    category: "technology",
    run: (ctx) => {
      const version = /PHP\/(\d+\.\d+(?:\.\d+)?)/i.exec(ctx.headers.get("x-powered-by") ?? "")?.[1];
      if (!version || compareVersions(version, "8.2") >= 0) return null;
      return {
        severity: "high",
        effort: "medium",
        title: bi("Unsupported PHP version", "Versiune PHP fără suport"),
        detail: bi(
          `The server reports PHP ${version}, which no longer receives security updates.`,
          `Serverul raportează PHP ${version}, care nu mai primește actualizări de securitate.`,
        ),
        recommendation: bi(
          "We move the site to PHP 8.3 or newer with your host, after testing it on a copy.",
          "Mutăm site-ul pe PHP 8.3 sau mai nou, împreună cu furnizorul de găzduire, după ce îl testăm pe o copie.",
        ),
        evidence: `X-Powered-By: PHP/${version}`,
      };
    },
  },
  {
    id: "technology.no-analytics",
    category: "technology",
    needs: "content",
    run: (ctx) =>
      ctx.signals.hasAnalytics
        ? null
        : {
            severity: "medium",
            effort: "quick",
            title: bi("No visitor analytics", "Fără statistici despre vizitatori"),
            detail: bi(
              "We found no analytics tool, so you can't see how many people visit, where they come from or which pages bring customers.",
              "Nu am găsit niciun instrument de analiză, deci nu poți vedea câți oameni vizitează site-ul, de unde vin sau ce pagini aduc clienți.",
            ),
            recommendation: bi(
              "We set up visitor statistics (Google Analytics 4, started only after consent, or a privacy-friendly tool such as Plausible) and count calls and form messages.",
              "Punem statistici de trafic (Google Analytics 4, pornit doar după acord, sau un instrument care respectă confidențialitatea, precum Plausible) și numărăm apelurile și mesajele din formulare.",
            ),
          },
  },
  {
    id: "technology.universal-analytics-only",
    category: "technology",
    needs: "content",
    run: (ctx) =>
      has(ctx, "Universal Analytics") &&
      !has(ctx, "Google Analytics 4") &&
      !has(ctx, "Google Tag Manager")
        ? {
            severity: "high",
            effort: "quick",
            title: bi(
              "Old Google Analytics stopped working",
              "Vechiul Google Analytics nu mai funcționează",
            ),
            detail: bi(
              "The site still uses Universal Analytics (UA-), which Google shut down in July 2023, so visits are no longer recorded.",
              "Site-ul folosește încă Universal Analytics (UA-), oprit de Google în iulie 2023, deci vizitele nu mai sunt înregistrate.",
            ),
            recommendation: bi(
              "We set up Google Analytics 4 and remove the old code.",
              "Configurăm Google Analytics 4 și scoatem codul vechi.",
            ),
            evidence: ctx.technologies.find((t) => t.name === "Universal Analytics")?.evidence,
          }
        : null,
  },
  {
    id: "technology.no-marketing-pixel",
    category: "technology",
    needs: "content",
    run: (ctx) =>
      ctx.signals.hasEcommerce && !ctx.signals.hasMarketingPixel && !has(ctx, "Google Tag Manager")
        ? {
            severity: "low",
            effort: "quick",
            title: bi("No ad conversion tracking", "Fără măsurarea conversiilor din reclame"),
            detail: bi(
              "The shop has no Meta, Google Ads or TikTok pixel, so you can't measure sales from ads or re-engage visitors who didn't buy.",
              "Magazinul nu are pixel Meta, Google Ads sau TikTok, deci nu poți măsura vânzările din reclame și nici nu poți readuce vizitatorii care nu au cumpărat.",
            ),
            recommendation: bi(
              "We add the tracking of the ad platforms you use (after consent) and record purchases.",
              "Adăugăm urmărirea platformelor de reclamă pe care le folosești (după acord) și înregistrăm cumpărăturile.",
            ),
          }
        : null,
  },
];

function isRomanianSite(ctx: AuditContext) {
  return (
    Boolean(ctx.cui) ||
    ctx.finalUrl.hostname.endsWith(".ro") ||
    ctx.signals.languages.includes("ro") ||
    Boolean(ctx.signals.cuiOnSite)
  );
}

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const CATEGORY_ORDER: AuditCategory[] = [
  "security",
  "conversion",
  "seo",
  "performance",
  "accessibility",
  "content",
  "technology",
];

export function sortFindings(findings: AuditFinding[]): AuditFinding[] {
  return [...findings].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
  );
}

/** Number of deterministic checks (for the "we ran N checks" line in the UI). */
export const CHECK_COUNT = CHECKS.length;

export function runChecks(ctx: AuditContext): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const rendered = ctx.contentAvailable && !ctx.home.clientRendered;
  for (const check of CHECKS) {
    if (check.needs === "content" && !ctx.contentAvailable) continue;
    if (check.needs === "rendered" && !rendered) continue;
    try {
      const draft = check.run(ctx);
      if (draft) findings.push({ id: check.id, category: check.category, ...draft });
    } catch (error) {
      console.warn(`[scan] check ${check.id} failed`, error);
    }
  }
  return sortFindings(findings);
}

/* ------------------------------------------- findings outside the checks */

export type ReachFailure = "dns" | "timeout" | "tls" | "refused" | "network" | "too-many-redirects";

export function unreachableFinding(host: string, reason: ReachFailure): AuditFinding {
  const recommendation = bi(
    "Check the hosting account, the domain renewal and the DNS records; a site that doesn't load loses every visitor and its Google rankings.",
    "Verifică contul de hosting, reînnoirea domeniului și înregistrările DNS; un site care nu se încarcă pierde toți vizitatorii și pozițiile din Google.",
  );
  const base = {
    id: "technology.site-unreachable",
    category: "technology" as const,
    severity: "critical" as const,
    effort: "medium" as const,
  };
  switch (reason) {
    case "dns":
      return {
        ...base,
        title: bi("Website address doesn't resolve", "Adresa site-ului nu funcționează"),
        detail: bi(
          `${host} has no DNS records, so nobody can open it. The domain may have expired or its DNS settings are missing.`,
          `${host} nu are înregistrări DNS, deci nimeni nu îl poate deschide. Domeniul poate fi expirat sau setările DNS lipsesc.`,
        ),
        recommendation: bi(
          "We check the domain renewal and its settings with your registrar (ROTLD for .ro domains).",
          "Verificăm reînnoirea domeniului și setările lui la registrar (ROTLD pentru domeniile .ro).",
        ),
        evidence: `DNS lookup failed for ${host}`,
      };
    case "timeout":
      return {
        ...base,
        title: bi("Website doesn't respond", "Site-ul nu răspunde"),
        detail: bi(
          `${host} didn't answer within the time limit, so visitors see an endless loading screen.`,
          `${host} nu a răspuns în limita de timp, deci vizitatorii văd o pagină care se încarcă la nesfârșit.`,
        ),
        recommendation,
        evidence: "Request timed out",
      };
    case "tls":
      return {
        ...base,
        id: "security.invalid-certificate",
        category: "security",
        title: bi("Invalid HTTPS certificate", "Certificat HTTPS invalid"),
        detail: bi(
          `The HTTPS certificate of ${host} is invalid or expired, so browsers show a full-page security warning instead of the site.`,
          `Certificatul HTTPS al ${host} este invalid sau expirat, deci browserele afișează un avertisment de securitate pe tot ecranul în locul site-ului.`,
        ),
        recommendation: bi(
          "We renew the security certificate (free with Let's Encrypt) and turn on automatic renewal.",
          "Reînnoim certificatul de securitate (gratuit cu Let's Encrypt) și pornim reînnoirea automată.",
        ),
        evidence: "TLS handshake failed",
      };
    case "too-many-redirects":
      return {
        ...base,
        title: bi("Endless redirect loop", "Buclă infinită de redirecționări"),
        detail: bi(
          `${host} keeps redirecting without ever showing a page, so browsers give up with an error.`,
          `${host} redirecționează la nesfârșit fără să afișeze vreo pagină, deci browserele se opresc cu o eroare.`,
        ),
        recommendation: bi(
          "We check the address rules on the server, the CDN and the site platform: usually two of them contradict each other.",
          "Verificăm regulile de redirecționare din server, CDN și platforma site-ului: de obicei, două dintre ele se contrazic.",
        ),
        evidence: "More than 5 redirects",
      };
    default:
      return {
        ...base,
        title: bi("Website is down", "Site-ul nu funcționează"),
        detail: bi(
          `We couldn't connect to ${host}, so visitors can't open the site right now.`,
          `Nu ne-am putut conecta la ${host}, deci vizitatorii nu pot deschide site-ul în acest moment.`,
        ),
        recommendation,
        evidence: reason === "refused" ? "Connection refused" : "Network error",
      };
  }
}

export function blockedAddressFinding(reason: string): AuditFinding {
  return {
    id: "technology.address-not-public",
    category: "technology",
    severity: "medium",
    effort: "quick",
    title: bi("This address can't be scanned", "Această adresă nu poate fi scanată"),
    detail: bi(
      "It points to a private, local or reserved network address, which Vortex Scan never visits.",
      "Indică o adresă de rețea privată, locală sau rezervată, pe care Vortex Scan nu o accesează niciodată.",
    ),
    recommendation: bi(
      "Enter the public address of the website, e.g. https://yourbusiness.ro.",
      "Introdu adresa publică a site-ului, de ex. https://afacereata.ro.",
    ),
    evidence: reason,
  };
}

export function homepageErrorFinding(status: number): AuditFinding {
  return {
    id: "technology.homepage-error",
    category: "technology",
    severity: "critical",
    effort: "medium",
    title: bi("Homepage returns an error", "Pagina principală returnează o eroare"),
    detail: bi(
      `The homepage answered with HTTP ${status}, so visitors see an error page instead of your site.`,
      `Pagina principală a răspuns cu HTTP ${status}, deci vizitatorii văd o pagină de eroare în locul site-ului.`,
    ),
    recommendation: bi(
      "We check the server logs, the hosting status and the homepage setting of the site platform.",
      "Verificăm jurnalele serverului, starea găzduirii și setarea paginii principale din platforma site-ului.",
    ),
    evidence: `HTTP ${status}`,
  };
}

/** The site's robots.txt names VortexScan and disallows "/": nothing was fetched. */
export function scanOptOutFinding(host: string): AuditFinding {
  return {
    id: "technology.scan-opt-out",
    category: "technology",
    severity: "low",
    effort: "quick",
    title: bi("The site asks not to be scanned", "Site-ul cere să nu fie scanat"),
    detail: bi(
      `The robots.txt file of ${host} tells VortexScan not to visit, so we didn't open any page. That is the site owner's choice and we respect it.`,
      `Fișierul robots.txt al ${host} îi cere robotului VortexScan să nu viziteze site-ul, așa că nu am deschis nicio pagină. Este alegerea proprietarului și o respectăm.`,
    ),
    recommendation: bi(
      "If this is your site and you want the analysis, remove the VortexScan rule from robots.txt and scan again.",
      "Dacă site-ul este al tău și vrei analiza, scoate regula pentru VortexScan din robots.txt și scanează din nou.",
    ),
    evidence: "robots.txt: User-agent: VortexScan, Disallow: /",
  };
}

export function scanBlockedFinding(status: number, challenge: boolean): AuditFinding {
  return {
    id: "technology.scan-blocked",
    category: "technology",
    severity: "low",
    effort: "quick",
    title: bi("We couldn't read the page content", "Nu am putut citi conținutul paginii"),
    detail: bi(
      `The server answered our scanner with HTTP ${status}${challenge ? " and a bot check" : ""}, so content checks were skipped. Real visitors may see the site normally, but some search engines, AI assistants and link previews may be blocked too.`,
      `Serverul a răspuns scanerului nostru cu HTTP ${status}${challenge ? " și o verificare anti-bot" : ""}, așa că verificările de conținut au fost omise. Vizitatorii reali pot vedea site-ul normal, dar unele motoare de căutare, asistenți AI și previzualizări de linkuri pot fi blocați la fel.`,
    ),
    recommendation: bi(
      "We make sure the firewall or bot protection lets Google, Bing and link previews through.",
      "Ne asigurăm că protecția anti-bot lasă să treacă Google, Bing și previzualizările de linkuri.",
    ),
    evidence: `HTTP ${status}${challenge ? " (challenge)" : ""}`,
  };
}
