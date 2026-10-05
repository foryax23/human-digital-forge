import { createFileRoute } from "@tanstack/react-router";

import {
  B,
  BulletList,
  ContactEmail,
  LegalPage,
  LegalSection,
} from "@/components/vortexpoint/LegalPage";
import { canonicalLink } from "@/i18n/seo";
import { pageMeta, useI18n } from "@/i18n";

export const Route = createFileRoute("/vortexpoint_/terms")({
  head: ({ matches }) => ({
    meta: [
      ...pageMeta(matches, "/vortexpoint/terms"),
      { property: "og:url", content: "https://vortexhub.dev/vortexpoint/terms" },
    ],
    links: [canonicalLink("/vortexpoint/terms")],
  }),
  component: VortexPointTermsPage,
});

/* The final Terms of Use from the app (App/Legal/TermsOfUse.md), word for word. */
function VortexPointTermsPage() {
  const { t } = useI18n();
  return (
    <LegalPage
      title={t("VortexPoint Terms of Use", "Termeni de utilizare VortexPoint")}
      updated="Last updated: 5 October 2026."
    >
      <LegalSection>
        <p>
          VortexPoint is made by <B>VORTEX HUB S.R.L.</B>, Timișoara, Romania ("we"). By installing
          or using VortexPoint ("the app"), you agree to these terms.
        </p>
      </LegalSection>

      <LegalSection heading="1. The app">
        <p>
          VortexPoint is free to download and use. Some optional extras, such as premium skins, are
          part of <B>VortexPoint Plus</B>, a one-time purchase.
        </p>
      </LegalSection>

      <LegalSection heading="2. Your licence to use it">
        <p>
          We give you a personal, non-exclusive, non-transferable licence to install and use
          VortexPoint on Macs you own or control. You may not:
        </p>
        <BulletList>
          <li>resell, rent or redistribute the app or Plus licence keys;</li>
          <li>reverse engineer the app to remove Plus checks;</li>
          <li>use the app to break the law or anyone's rights.</li>
        </BulletList>
      </LegalSection>

      <LegalSection heading="3. VortexPoint Plus">
        <BulletList>
          <li>
            Plus is a one-time purchase. It unlocks the premium skins that exist at the time you
            buy, and the ones we add later.
          </li>
          <li>Your licence key is for your own use, on your own Macs.</li>
          <li>
            If Plus doesn't work for you, contact us within <B>14 days</B> of purchase for a refund.
          </li>
        </BulletList>
      </LegalSection>

      <LegalSection heading="4. The AI agent (Beta)">
        <BulletList>
          <li>
            The AI agent uses <B>your own Anthropic (Claude) API key</B>. You are responsible for
            that key and for what it costs on your Anthropic account. The app shows a cost estimate
            and stops a task at your spending limit, but the amount you are billed is set by
            Anthropic.
          </li>
          <li>
            While the agent runs, screenshots of your screen and your request are sent to Anthropic
            under your key. Anthropic's own terms and privacy policy apply to that data.
          </li>
          <li>
            The agent can make mistakes. It asks you before sending messages, buying, deleting or
            changing settings, and you can stop it at any time with Esc. You remain responsible for
            what it does on your Mac and for checking its results.
          </li>
          <li>The agent is a beta feature and may change.</li>
        </BulletList>
      </LegalSection>

      <LegalSection heading="5. Updates">
        <p>The app can update itself. Updates may add, change or remove features.</p>
      </LegalSection>

      <LegalSection heading="6. No warranty">
        <p>
          VortexPoint is provided <B>"as is"</B>, without warranties of any kind, to the extent the
          law allows. Some features depend on macOS and on third-party services (Anthropic,
          Open-Meteo, GitHub), which can change or become unavailable.
        </p>
      </LegalSection>

      <LegalSection heading="7. Limitation of liability">
        <p>
          To the extent the law allows, we are not liable for indirect or consequential damages,
          data loss, or charges incurred on your Anthropic account through your use of the app. Our
          total liability for Plus is limited to the price you paid for it. Nothing here limits
          rights you have as a consumer under the law of your country.
        </p>
      </LegalSection>

      <LegalSection heading="8. Changes">
        <p>
          We may update these terms. The current version is always in the app (Settings → About) and
          on vortexhub.dev/vortexpoint.
        </p>
      </LegalSection>

      <LegalSection heading="9. Law and contact">
        <p>
          These terms are governed by Romanian law, without affecting mandatory consumer protections
          where you live.
        </p>
        <p>
          Questions: <ContactEmail />
        </p>
      </LegalSection>
    </LegalPage>
  );
}
