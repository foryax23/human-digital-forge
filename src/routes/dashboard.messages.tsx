import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/components/auth/AuthProvider";
import { SIGNATORY } from "@/components/deep/contact";
import { LoadError, Loading, PageHeader } from "@/components/dashboard/PageHeader";
import { formatShort } from "@/components/dashboard/format";
import { Panel, PanelBody, PanelDivider, PanelHeader, buttonClass } from "@/components/system";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { COMPANY } from "@/lib/scan/legal/company";
import type { MessageRow } from "@/hooks/use-dashboard-data";

/*
 * Messages: the chat is retired. A client's message never reached the team (the admin panel
 * lists messages only under a project, and nothing alerted anyone), so clients write by
 * e-mail. Replies the team already sent from the admin panel stay readable here.
 */

export const Route = createFileRoute("/dashboard/messages")({
  component: MessagesPage,
});

function mailtoHref(email: string | null | undefined, lang: "ro" | "en") {
  const subject =
    lang === "ro" ? "Mesaj din contul Vortex Hub" : "Message from my Vortex Hub account";
  const body = email
    ? lang === "ro"
      ? `\n\n\nContul meu: ${email}`
      : `\n\n\nMy account: ${email}`
    : "";
  return `mailto:${COMPANY.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function EmailPanel() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const phone = SIGNATORY.phone;
  const whatsapp = SIGNATORY.whatsapp;
  return (
    <Panel as="section" aria-labelledby="messages-email">
      <PanelHeader
        titleAs="h2"
        titleId="messages-email"
        title={t("Write to us by e-mail", "Scrie-ne pe e-mail")}
        sub={t("We reply within one working day.", "Îți răspundem într-o zi lucrătoare.")}
      />
      <PanelBody className="grid gap-4">
        <p className="type-body-sm max-w-[60ch] text-fg-2">
          {t(
            "For a question about a project, a change or an invoice, send us an e-mail from the address of this account, so we know who is writing.",
            "Pentru o întrebare despre un proiect, o modificare sau o factură, trimite-ne un e-mail de pe adresa acestui cont, ca să știm cine ne scrie.",
          )}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a href={mailtoHref(user?.email, lang)} className={buttonClass("primary", "md")}>
            {t("Write an e-mail", "Scrie un e-mail")}
          </a>
          <a
            href={`mailto:${COMPANY.email}`}
            className="type-body-sm text-fg-2 underline decoration-fg/30 underline-offset-4 hover:decoration-fg"
          >
            {COMPANY.email}
          </a>
        </div>
        {phone || whatsapp ? (
          <p className="type-body-sm text-fg-3">
            {whatsapp ? (
              <a
                href={`https://wa.me/${whatsapp}`}
                className="text-fg-2 underline decoration-fg/30 underline-offset-4 hover:decoration-fg"
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
            ) : null}
            {phone && whatsapp ? " · " : null}
            {phone ? (
              <a
                href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                className="text-fg-2 underline decoration-fg/30 underline-offset-4 hover:decoration-fg"
              >
                {phone}
              </a>
            ) : null}
          </p>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

function MessagesPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user) return;
    let live = true;
    void (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, body, sender, read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!live) return;
      if (error) console.error("[messages] load failed", error);
      setFailed(Boolean(error));
      setMessages((data as MessageRow[] | null) ?? []);
      setLoading(false);
    })();
    return () => {
      live = false;
    };
  }, [user]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t("Messages", "Mesaje")}
        lead={t(
          "Write to us by e-mail. Replies the team posts on your projects also show here.",
          "Ne scrii pe e-mail. Răspunsurile echipei la proiectele tale apar și aici.",
        )}
      />

      <EmailPanel />

      {loading ? <Loading label={t("Loading messages", "Se încarcă mesajele")} /> : null}

      {!loading && failed ? (
        <LoadError>
          {t(
            "We couldn't load earlier messages. Refresh the page to try again.",
            "Nu am putut încărca mesajele anterioare. Reîncarcă pagina ca să încerci din nou.",
          )}
        </LoadError>
      ) : null}

      {!loading && !failed && messages.length > 0 ? (
        <Panel as="section" aria-labelledby="messages-history">
          <PanelHeader
            titleAs="h2"
            titleId="messages-history"
            title={t("Earlier messages", "Mesaje anterioare")}
            sub={t("Newest first.", "Cele mai noi primele.")}
          />
          <ul>
            {messages.map((message) => {
              const mine = message.sender === "client";
              return (
                <li key={message.id}>
                  <PanelDivider />
                  <div className="px-4 py-3 sm:px-5">
                    <p className="type-label flex flex-wrap items-baseline gap-x-2 text-fg">
                      {mine ? t("You", "Tu") : "Vortex Hub"}
                      <span className="type-micro font-normal text-fg-3">
                        {formatShort(message.created_at, lang)}
                      </span>
                    </p>
                    <p className="type-body-sm mt-1 whitespace-pre-wrap break-words text-fg-2">
                      {message.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
