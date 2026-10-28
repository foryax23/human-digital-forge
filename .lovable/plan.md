# Country flag on the homepage search bar

Yes, it makes sense. A small flag button sits at the left of the search bar: Romania or United Kingdom.

## What the visitor sees
- Flag button (RO / UK) inside the search bar, opens a two-item menu.
- Default follows the site's current market (UK visitors start on the UK flag); changing the flag also does not change the site language.
- Romania: works exactly as today (company name, CUI, website).
- United Kingdom: placeholder and hints change to "company name, company number or website"; examples become UK ones; suggestions come from Companies House; an 8-character company number (e.g. 00445790, SC123456) is recognised directly.
- The chosen country is passed to the results page, so the scan uses the right registry.

## Dependency
- UK company suggestions need the Companies House key, which is still rejected. Until it works, UK mode still accepts website addresses and company numbers, and shows a friendly "UK name search unavailable, type the website" note.

## Technical details
- `VortexSearch.tsx`: add `country` state (init from `useLanguage().market`), flag picker (accessible listbox), UK intent parser (company number regex), UK examples/hints in EN/RO.
- New server function for Companies House search (`/search/companies`), key read inside handler, results mapped to the same suggestion shape.
- `/scan` search params gain `country: "ro" | "uk"` and `companyNumber`; RO path unchanged.
- Tests for the company-number recogniser.
