import { createFileRoute } from "@tanstack/react-router";

import {
  B,
  BulletList,
  ContactEmail,
  LegalPage,
  LegalSection,
  LegalTable,
} from "@/components/vortexpoint/LegalPage";
import { canonicalLink } from "@/i18n/seo";
import { pageMeta, useI18n } from "@/i18n";

export const Route = createFileRoute("/vortexpoint_/privacy")({
  head: ({ matches }) => ({
    meta: [
      ...pageMeta(matches, "/vortexpoint/privacy"),
      { property: "og:url", content: "https://vortexhub.dev/vortexpoint/privacy" },
    ],
    links: [canonicalLink("/vortexpoint/privacy")],
  }),
  component: VortexPointPrivacyPage,
});

/* The final Privacy Policy from the app (App/Legal/PrivacyPolicy.md), word for word. */
function VortexPointPrivacyPage() {
  const { t } = useI18n();
  return (
    <LegalPage
      title={t("VortexPoint Privacy Policy", "Politica de confidențialitate VortexPoint")}
      updated="Last updated: 7 October 2026."
    >
      <LegalSection>
        <p>
          VortexPoint is made by <B>VORTEX HUB S.R.L.</B>, Timișoara, Romania. This policy explains
          what the app does with your data. In short:{" "}
          <B>
            VortexPoint has no accounts, no analytics and no tracking, and we don't receive your
            data.
          </B>
        </p>
      </LegalSection>

      <LegalSection heading="What stays on your Mac">
        <BulletList>
          <li>
            <B>The shelf, captures and settings.</B> Files you drop on the shelf, your screenshots
            and recordings, and your settings are stored only on your Mac.
          </li>
          <li>
            <B>Your Claude API key and Plus licence key</B> are stored in your Mac's Keychain.
          </li>
          <li>
            <B>The agent's activity log</B> is stored only on your Mac and deleted after 30 days. It
            records what the agent did, but never the text it typed.
          </li>
          <li>
            <B>Text grab (OCR)</B> runs entirely on your Mac.
          </li>
          <li>
            <B>Clipboard history</B> stays on your Mac, in memory only. It is never saved or sent,
            it is cleared when you quit, and it skips copies from password managers and any copy
            holding a Claude API key.
          </li>
          <li>
            <B>Notes.</B> VortexPoint writes to Apple Notes only when you ask, and reads nothing from
            Notes.
          </li>
          <li>
            <B>Your calendar and to-dos</B> are read from Apple Calendar and Reminders on your Mac,
            to show them in the Plan tab. They sync through your own iCloud account, as they already
            do.
          </li>
          <li>
            <B>Your voice</B> is turned into text on your Mac when on-device recognition is
            available for your language. The audio is never saved.
          </li>
        </BulletList>
      </LegalSection>

      <LegalSection heading="What is sent, and to whom">
        <LegalTable
          head={["When", "What", "To"]}
          rows={[
            [
              <>
                You run the <B>AI agent</B>
              </>,
              "Your request and screenshots of your screen, sent with your own API key",
              <>
                <B>Anthropic</B> (Claude). See anthropic.com/legal/privacy.
              </>,
            ],
            [
              <>
                You <B>type or say a request</B> your Mac can't match by itself
              </>,
              "The text of your request (and, after \"Ask a follow-up\", your previous request and its answer), with your time zone and language, sent with your own API key",
              <>
                <B>Anthropic</B> (Claude)
              </>,
            ],
            [
              <>
                VortexPoint <B>reads something to answer</B> that request
              </>,
              "Only what it asks for: Mac status figures (memory, CPU, disk, battery, the Wi-Fi network name, uptime, macOS version), the names of the apps using the most memory, the titles and times of your events for the days asked, and your to-do titles with their due dates, sent with your own API key",
              <>
                <B>Anthropic</B> (Claude)
              </>,
            ],
            [
              <>
                You <B>talk to VortexPoint</B>, with the mic in the prompt bar or by holding ⌃⌥Space
              </>,
              "Nothing extra: your Mac recognises the audio and turns it into text, which is then handled exactly like a typed request (the rows above)",
              "No one: the audio stays on your Mac, except in the case below",
            ],
            [
              "You talk to VortexPoint in a language your Mac can't recognise on-device",
              "The audio of what you say, for that request only (Settings → General says when this applies)",
              <>
                <B>Apple</B> (speech recognition)
              </>,
            ],
            [
              <>
                The <B>weather</B> is shown
              </>,
              "Your approximate location (rounded to about 1 km) or the city you chose",
              <>
                <B>Open-Meteo</B> (open-meteo.com)
              </>,
            ],
            [
              "The weather shows your city name",
              "Your approximate location",
              <>
                <B>Apple</B> (Maps), to look up the city name
              </>,
            ],
            [
              <>
                You choose a <B>city</B> for the weather
              </>,
              "The city name you type",
              <>
                <B>Apple</B> (Maps), to find its location
              </>,
            ],
            [
              <>
                The app <B>checks for updates</B>
              </>,
              "Your app version and macOS version (a standard request)",
              <>
                <B>GitHub</B>, where updates are hosted
              </>,
            ],
            [
              <>
                You <B>buy Plus</B>
              </>,
              "Your payment details and email",
              <>
                <B>Stripe</B> and <B>VORTEX HUB S.R.L.</B> (to issue and send your licence key)
              </>,
            ],
          ]}
        />
        <p>Nothing else is sent. The Plus licence is checked on your Mac, without contacting us.</p>
      </LegalSection>

      <LegalSection heading="Permissions VortexPoint asks for">
        <BulletList>
          <li>
            <B>Location:</B> only for the weather. You can say no and choose a city in Settings
            instead, or the weather stays hidden.
          </li>
          <li>
            <B>Screen Recording:</B> for the AI agent, screenshots, recordings and text grab.
          </li>
          <li>
            <B>Accessibility:</B> so the AI agent can click and type for you.
          </li>
          <li>
            <B>Automation:</B> to control Music and your browsers, to open Calendar on a day, and to
            add to Apple Notes, only when you ask.
          </li>
          <li>
            <B>Calendars and Reminders:</B> to show your events and to-dos in the Plan tab, and to
            add the ones you ask for. Asked the first time you open the Plan tab.
          </li>
          <li>
            <B>Microphone and Speech Recognition:</B> to hear you while you hold the shortcut or
            click the mic. Asked the first time you talk.
          </li>
          <li>
            <B>Desktop, or the folder you chose:</B> to save your screenshots and recordings there.
          </li>
        </BulletList>
        <p>You can change these at any time in System Settings → Privacy &amp; Security.</p>
      </LegalSection>

      <LegalSection heading="Your rights">
        <p>
          Since we don't receive your app data, there is nothing for us to export or delete. For
          Plus purchases, we keep the details we need for invoicing and your licence, as Romanian
          law requires. Contact us to access or correct them.
        </p>
        <p>
          Contact: <ContactEmail />
        </p>
      </LegalSection>
    </LegalPage>
  );
}
