/*
 * robots.txt for the deep crawl (RFC 9309 plus Crawl-delay), client-safe and
 * pure. Same matching rules as src/lib/scan/net.server.ts (groups by
 * user-agent, longest match wins, allow wins ties), with the Crawl-delay of
 * the group that applies to VortexScan, else "*".
 */

export const ROBOTS_AGENT = "vortexscan";

type Rule = { allow: boolean; pattern: string; regex: RegExp };
type Group = { agents: string[]; rules: Rule[]; crawlDelay?: number };

export type RobotsPolicy = {
  /** robots.txt answered 200 with a real file. */
  found: boolean;
  status?: number;
  sitemaps: string[];
  /** Seconds, from the VortexScan group, else "*" (capped at 30). */
  crawlDelay?: number;
  /** Our own rules (VortexScan group, else "*"). */
  isAllowed: (pathWithQuery: string) => boolean;
  /** The site names VortexScan and disallows "/": nothing is fetched, not even the homepage. */
  optsOut: boolean;
  /** Fetching failed (5xx or network): crawl nothing. */
  unavailable?: boolean;
};

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

export function parseRobots(text: string, status = 200): RobotsPolicy {
  const groups: Group[] = [];
  const sitemaps: string[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const match = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (key === "sitemap") {
      if (value) sitemaps.push(value);
    } else if (key === "crawl-delay" && current) {
      const seconds = Number(value.replace(",", "."));
      if (Number.isFinite(seconds) && seconds >= 0) current.crawlDelay = seconds;
    } else if ((key === "allow" || key === "disallow") && current) {
      if (!value) continue;
      const pattern = value.startsWith("/") || value.startsWith("*") ? value : `/${value}`;
      current.rules.push({ allow: key === "allow", pattern, regex: patternToRegex(pattern) });
    }
  }
  const specific = groups.filter((g) =>
    g.agents.some((ua) => ua && ua !== "*" && ROBOTS_AGENT.startsWith(ua)),
  );
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  const rules = chosen.flatMap((g) => g.rules);
  const delays = chosen.map((g) => g.crawlDelay).filter((d): d is number => d !== undefined);
  const check = (path: string) => {
    let best: Rule | null = null;
    for (const rule of rules) {
      if (!rule.regex.test(path)) continue;
      if (
        !best ||
        rule.pattern.length > best.pattern.length ||
        (rule.pattern.length === best.pattern.length && rule.allow)
      ) {
        best = rule;
      }
    }
    return best ? best.allow : true;
  };
  return {
    found: true,
    status,
    sitemaps,
    // The real delay (seconds), never capped: callers skip pages they cannot fetch that slowly.
    crawlDelay: delays.length ? Math.max(...delays) : undefined,
    isAllowed: check,
    optsOut: specific.length > 0 && !check("/"),
  };
}

/** A robots.txt that does not exist (4xx): everything allowed. */
export function robotsAllowAll(status?: number): RobotsPolicy {
  return { found: false, status, sitemaps: [], isAllowed: () => true, optsOut: false };
}

/** robots.txt answered 5xx or could not be fetched: crawl nothing. */
export function robotsUnavailable(status?: number): RobotsPolicy {
  return {
    found: false,
    status,
    sitemaps: [],
    isAllowed: () => false,
    optsOut: false,
    unavailable: true,
  };
}

/** Builds the policy from a fetched robots.txt response (status, body). */
export function robotsFromResponse(status: number, body: string): RobotsPolicy {
  if (status >= 400 && status < 500) return robotsAllowAll(status);
  if (status >= 500) return robotsUnavailable(status);
  // Some hosts answer 200 with their HTML page; treat that as "no robots.txt".
  if (/^\s*</.test(body) && /<html|<!doctype/i.test(body.slice(0, 2000))) {
    return robotsAllowAll(status);
  }
  return parseRobots(body, status);
}
