import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download } from "lucide-react";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { ItemList } from "@/components/shared/ItemList";
import { buttonClass, FOCUS_RING, SectionHeader } from "@/components/system";
import { languageFromMatches, PAGE_SEO, pageMeta, useI18n } from "@/i18n";
import { absoluteUrl, canonicalLink, jsonLdScript } from "@/i18n/seo";
import { cn } from "@/lib/utils";
import { ANTHROPIC_KEYS_URL, VORTEXPOINT_DMG_URL, VORTEXPOINT_ICON } from "@/lib/vortexpoint";

export const Route = createFileRoute("/vortexpoint")({
  head: ({ matches }) => {
    const lang = languageFromMatches(matches);
    return {
      meta: pageMeta(matches, "/vortexpoint"),
      links: [canonicalLink("/vortexpoint")],
      scripts: [
        // Only what the page states: free, macOS 26 or later, Apple Silicon. No ratings.
        jsonLdScript({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "VortexPoint",
          description: PAGE_SEO["/vortexpoint"].description[lang],
          url: absoluteUrl("/vortexpoint"),
          image: absoluteUrl(VORTEXPOINT_ICON.full),
          downloadUrl: VORTEXPOINT_DMG_URL,
          operatingSystem: "macOS 26 or later",
          processorRequirements: "Apple Silicon (arm64)",
          applicationCategory: "UtilitiesApplication",
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: 0, priceCurrency: "RON" },
          publisher: { "@type": "Organization", name: "Vortex Hub", url: absoluteUrl("/") },
        }),
      ],
    };
  },
  component: VortexPointPage,
});

/** Prose links: the site's underline (as on /digital-products). */
const TEXT_LINK = cn(
  "rounded-sm text-fg underline decoration-fg/30 decoration-1 underline-offset-4 transition-colors hover:decoration-fg",
  FOCUS_RING,
);

/** "–" rows, as in the service pages' "Ce primești". */
function DashList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((item, index) => (
        <li key={index} className="type-body-sm flex gap-2.5 text-pretty text-fg-2">
          <span aria-hidden className="text-fg-3">
            –
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Paths and shortcuts: mono, never tracked (type-code); paths may wrap anywhere. */
function Code({ children }: { children: ReactNode }) {
  return <code className="type-code break-all text-fg">{children}</code>;
}

function VortexPointPage() {
  const { t } = useI18n();

  const features = [
    {
      title: t("Now playing", "Muzica în notch"),
      description: t(
        "The song playing in any app, browsers included, with previous, play/pause and next. The weather sits under the clock.",
        "Piesa care se aude în orice aplicație, inclusiv în browser, cu înapoi, pauză și înainte. Vremea apare sub ceas.",
      ),
    },
    {
      title: t("Plan", "Plan"),
      description: t(
        "Your Apple Calendar on the left, your Reminders to-dos on the right. The Now tab shows what is next up.",
        "Calendarul tău Apple în stânga, sarcinile din Reminders în dreapta. Fila Now îți arată ce urmează.",
      ),
    },
    {
      title: t("Voice to-dos", "Sarcini cu vocea"),
      description: t(
        "Hold ⌃⌥Space and talk, in Romanian or English. Claude turns it into events and to-dos with your own key. You see them first, with Save, Edit and Undo.",
        "Ții apăsat ⌃⌥Space și vorbești, în română sau engleză. Claude transformă ce spui în evenimente și sarcini, cu cheia ta. Le vezi întâi, cu butoanele Save, Edit și Undo.",
      ),
    },
    {
      title: t("Quick tools", "Unelte rapide"),
      description: t(
        "Four buttons under the clock: screenshot, record an area, grab text from the screen and pick a colour. Use ⌃⌥4 to ⌃⌥7 from any app.",
        "Patru butoane sub ceas: captură de ecran, înregistrarea unei zone, text luat de pe ecran și selector de culoare. Scurtăturile ⌃⌥4 până la ⌃⌥7 merg din orice aplicație.",
      ),
    },
    {
      title: t("Shelf", "Raftul pentru fișiere"),
      description: t(
        "Drop files on the notch to keep them handy, then drag them out wherever you need them. The originals stay where they are.",
        "Lași fișierele pe notch ca să le ai la îndemână, apoi le tragi de acolo unde ai nevoie de ele. Originalele rămân la locul lor.",
      ),
    },
    {
      title: "Mac Health",
      description: t(
        "Memory and CPU at a glance. Quit the heaviest apps, let Focus slow down background apps while you work, and clean caches.",
        "Memoria și procesorul, dintr-o privire. Închizi aplicațiile care consumă cel mai mult, lași Focus să încetinească aplicațiile din fundal cât lucrezi și cureți cache-ul.",
      ),
    },
    {
      title: t("AI agent (Beta)", "Agent AI (Beta)"),
      description: t(
        "Click the field and type what you need. It does the work on your Mac with your own Claude key, then shows its full answer.",
        "Faci clic pe câmp și scrii de ce ai nevoie. Se ocupă el, direct pe Mac, cu cheia ta Claude, apoi îți arată răspunsul complet.",
      ),
    },
    {
      title: t("Skins", "Teme"),
      description: t(
        "Pixel Grid, a fine dot grid that ripples, is free for everyone. Pick it in Settings → Appearance. To open Settings, right-click the notch.",
        "Pixel Grid, o grilă fină de puncte care se unduiește, e gratuită pentru toți. O alegi din Settings → Appearance. Ca să deschizi Settings, dă clic dreapta pe notch.",
      ),
    },
  ];

  const steps: { title: string; detail: ReactNode }[] = [
    {
      title: t("Download", "Descarcă"),
      detail: (
        <>
          {t("Get ", "Ia fișierul ")}
          <a href={VORTEXPOINT_DMG_URL} className={TEXT_LINK}>
            VortexPoint.dmg
          </a>
          {t(" and open it.", " și deschide-l.")}
        </>
      ),
    },
    {
      title: t("Drag it to Applications", "Mută-l în Aplicații"),
      detail: t(
        "In the window that opens, drag VortexPoint onto the Applications folder.",
        "În fereastra care apare, trage VortexPoint peste folderul Aplicații.",
      ),
    },
    {
      title: t("Open it", "Deschide-l"),
      detail: t(
        "Open VortexPoint from Applications. The first time, macOS stops it: close the message with Done, not Move to Trash.",
        "Deschide VortexPoint din Aplicații. Prima dată, macOS îl blochează: închide mesajul, dar nu muta aplicația la coș.",
      ),
    },
    {
      title: t("Open Anyway", "Deschide oricum"),
      detail: t(
        "Open System Settings → Privacy & Security, scroll down to Security and click Open Anyway for VortexPoint. Enter your password to confirm.",
        "Deschide Configurări sistem → Confidențialitate și securitate, derulează până la Securitate și apasă Deschide oricum pentru VortexPoint. Confirmă cu parola Mac-ului.",
      ),
    },
  ];

  const agentFacts: { label: string; value: ReactNode }[] = [
    {
      label: t("Your key", "Cheia ta"),
      value: (
        <>
          {t("Create a Claude API key at ", "Creezi o cheie Claude API pe ")}
          <a href={ANTHROPIC_KEYS_URL} target="_blank" rel="noreferrer" className={TEXT_LINK}>
            console.anthropic.com
            <span className="sr-only">
              {t(" (opens in a new tab)", " (se deschide într-o filă nouă)")}
            </span>
          </a>
          {t(
            " and paste it into the notch when asked. It stays in your Mac's Keychain.",
            " și o lipești în notch când ți-o cere. Cheia se păstrează în Keychain, pe Mac-ul tău.",
          )}
        </>
      ),
    },
    {
      label: t("Cost", "Costuri"),
      value: t(
        "Usage is billed to your Anthropic account. VortexPoint itself is free.",
        "Utilizarea se facturează în contul tău Anthropic. VortexPoint rămâne gratuit.",
      ),
    },
    {
      label: t("Privacy", "Confidențialitate"),
      value: t(
        "While the agent runs, screenshots of your screen and your request go to Anthropic with your key. A voice note sends only the text you said and the titles and times of your next 7 days of events. Audio is recognised on your Mac when it can be. We receive none of your data.",
        "Cât timp agentul lucrează, capturi ale ecranului și cererea ta ajung la Anthropic, cu cheia ta. O notă vocală trimite doar textul spus și titlurile și orele evenimentelor din următoarele 7 zile. Sunetul este recunoscut pe Mac, când se poate. Noi nu primim datele tale.",
      ),
    },
    {
      label: t("Control", "Control"),
      value: t(
        "Press Esc to stop it at any moment. It asks you first before it sends a message or does anything that matters.",
        "Apeși Esc și se oprește pe loc. Te întreabă înainte să trimită un mesaj sau să facă ceva important.",
      ),
    },
  ];

  const uninstall = [
    t(
      "Right-click the notch and choose Quit VortexPoint.",
      "Dă clic dreapta pe notch și alege Quit VortexPoint.",
    ),
    t(
      "Drag VortexPoint from Applications to the Trash.",
      "Trage VortexPoint din Aplicații în coș.",
    ),
  ];

  const leftovers = [
    <>
      {t(
        "The shelf's copies and the agent's activity log: delete the folder ",
        "Copiile din raft și jurnalul agentului: șterge folderul ",
      )}
      <Code>~/Library/Application Support/VortexPoint</Code>
    </>,
    t(
      "Your Claude key: open Keychain Access, search for VortexPoint and delete the item.",
      "Cheia Claude: deschide Keychain Access (Acces la portchei), caută VortexPoint și șterge elementul.",
    ),
    <>
      {t("The settings file: ", "Fișierul cu setări: ")}
      <Code>~/Library/Preferences/com.dandeamihai.VortexPoint.plist</Code>
    </>,
  ];

  return (
    <SiteLayout>
      {/* PageHero's frame and type roles, with the app icon beside the name. */}
      <section className="border-b border-line-1">
        <div className="container-vx pb-10 pt-10 md:pb-14 md:pt-16">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 md:gap-4">
              {/* The icon carries macOS's own transparent margin; the negative margin lines
                  the squircle up with the text below. */}
              <img
                src={VORTEXPOINT_ICON.web}
                alt=""
                width={256}
                height={256}
                decoding="async"
                className="-ml-1.5 size-16 shrink-0 md:-ml-2 md:size-[5.5rem]"
              />
              <div className="min-w-0">
                <h1 className="type-h2 text-fg">VortexPoint</h1>
                <p className="type-h3 mt-1 text-fg-2">
                  {t("Your notch, alive.", "Notch-ul tău, viu.")}
                </p>
              </div>
            </div>
            <p className="type-lead mt-5 max-w-[60ch] text-pretty text-fg-2">
              {t(
                "Hover the notch and it opens: your music, calendar and to-dos, a shelf for files, Mac Health and an AI agent. Talk to it to add events. Point, a small pixel pet, lives there too.",
                "Treci cu mouse-ul peste notch și se deschide: muzica, calendarul și sarcinile, un raft pentru fișiere, Mac Health și un agent AI. Îi vorbești ca să adaugi evenimente. Tot acolo stă și Point, un mic personaj din pixeli.",
              )}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
              <a href={VORTEXPOINT_DMG_URL} className={buttonClass("primary", "lg")}>
                <Download aria-hidden />
                {t("Download for Mac", "Descarcă pentru Mac")}
              </a>
              <span className="type-body-sm text-fg-3">
                {t(
                  "Free · macOS 26 or later · Apple Silicon",
                  "Gratuit · macOS 26 sau mai nou · Apple Silicon",
                )}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="vortexpoint-features" className="section-y">
        <div className="container-vx">
          <SectionHeader headingId="vortexpoint-features" title={t("What it does", "Ce face")} />
          <ItemList items={features} columns={2} />

          <SectionHeader
            className="mt-16 md:mt-20"
            headingId="vortexpoint-install"
            title={t("Install in four steps", "Instalare în patru pași")}
            lead={t(
              "VortexPoint is free and not sold through Apple, so macOS asks you to confirm it once.",
              "VortexPoint e gratuit și nu se vinde prin Apple, așa că macOS îți cere să-l confirmi o singură dată.",
            )}
          />
          <ol className="border-t border-line-1 lg:grid lg:grid-cols-4 lg:gap-6 lg:border-t-0">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="grid grid-cols-[2rem_minmax(0,1fr)] items-baseline gap-x-3 border-b border-line-1 py-4 lg:block lg:border-b-0 lg:border-t lg:border-rule lg:pb-0 lg:pt-4"
              >
                <span className="type-pnum text-[0.8125rem] text-fg-3">{index + 1}</span>
                <div className="min-w-0">
                  <h3 className="type-h4 text-fg lg:mt-1.5">{step.title}</h3>
                  <p className="type-body-sm mt-1 text-pretty text-fg-2">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="type-body-sm mt-6 max-w-[72ch] text-pretty text-fg-2 lg:mt-8">
            {t(
              "After that it opens like any other app, starts with your Mac and tells you in the notch when an update is ready. Hover the notch or press ",
              "De acum se deschide ca orice aplicație, pornește odată cu Mac-ul și te anunță în notch când apare o versiune nouă. Treci cu mouse-ul peste notch sau apasă ",
            )}
            <kbd className="type-code text-fg">⌃⌥Space</kbd>.
          </p>
        </div>
      </section>

      <section aria-labelledby="vortexpoint-agent vortexpoint-uninstall" className="section-y">
        <div className="container-vx">
          <SectionHeader
            layout="split"
            headingId="vortexpoint-agent"
            title={t("The AI agent (Beta)", "Agentul AI (Beta)")}
            lead={t(
              "Ask it for something and it works on your Mac for you, clicking and typing the way you would.",
              "Îi ceri ceva și se ocupă el, direct pe Mac: face clic și scrie, la fel ca tine.",
            )}
          >
            <dl className="border-t border-rule">
              {agentFacts.map((fact) => (
                <div
                  key={fact.label}
                  className="type-body-sm grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-4 border-b border-line-1 py-3 max-sm:grid-cols-1 max-sm:gap-1"
                >
                  <dt className="text-fg-3">{fact.label}</dt>
                  <dd className="min-w-0 text-pretty text-fg">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </SectionHeader>

          <SectionHeader
            className="mt-16 md:mt-20"
            layout="split"
            headingId="vortexpoint-uninstall"
            title={t("Uninstall", "Dezinstalare")}
            lead={t("Like any other Mac app.", "Ca orice aplicație de Mac.")}
          >
            <ol className="border-t border-rule">
              {uninstall.map((item, index) => (
                <li
                  key={item}
                  className="grid grid-cols-[2rem_minmax(0,1fr)] items-baseline gap-x-3 border-b border-line-1 py-3"
                >
                  <span aria-hidden className="type-pnum text-[0.8125rem] text-fg-3">
                    {index + 1}
                  </span>
                  <span className="type-body min-w-0 text-pretty text-fg">{item}</span>
                </li>
              ))}
            </ol>
            <div className="mt-8">
              <h3 className="type-h4 text-fg">
                {t("To leave nothing behind (optional)", "Ca să nu rămână nimic (opțional)")}
              </h3>
              <DashList items={leftovers} />
              <p className="type-body-sm mt-3 text-pretty text-fg-3">
                {t(
                  "To reach ~/Library, press ⇧⌘G in Finder and paste the path.",
                  "Ca să ajungi în ~/Library, apasă ⇧⌘G în Finder și lipește calea.",
                )}
              </p>
            </div>
          </SectionHeader>

          <p className="type-body-sm mt-12 flex flex-wrap gap-x-5 gap-y-1.5 text-fg-3 md:mt-16">
            <Link to="/vortexpoint/terms" className={TEXT_LINK}>
              {t("Terms of Use", "Termeni de utilizare")}
            </Link>
            <Link to="/vortexpoint/privacy" className={TEXT_LINK}>
              {t("Privacy Policy", "Politica de confidențialitate")}
            </Link>
            <span>
              {t("Contact: ", "Contact: ")}
              <a href="mailto:hello@vortexhub.dev" className={TEXT_LINK}>
                hello@vortexhub.dev
              </a>
            </span>
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}
