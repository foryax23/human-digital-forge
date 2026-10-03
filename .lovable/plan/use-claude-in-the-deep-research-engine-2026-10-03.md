# Use Claude in the deep research engine

The engine is already set up to call Claude: it turns the AI analysis on when a key named `ANTHROPIC_API_KEY` is present. So the main step is saving your key securely, then running one research to check it.

## Steps

1. **Save the key securely.** Open the secure secrets form for `ANTHROPIC_API_KEY`. The key you pasted in chat is now in the chat history, so create a new one at console.anthropic.com, enter it in the form, and delete the old one. The key will not go into the code.
2. **Check the key type.** The pasted key starts with `sk-ant-usr-`. That is not a normal Anthropic API key, which starts with `sk-ant-api03-` and is created under Console → API Keys. A key of the wrong type is refused, and the engine falls back to rule-based reports.
3. **Check the model names.** Make sure the models the engine uses for writing and for extracting facts are current Claude models: Opus 5.5 for the report text and Haiku 4.5 for extraction.
4. **Test one run.** Run a research on a known company and confirm three things:
   - the run shows "AI text";
   - the cost appears in the admin panel;
   - the daily spending cap still stops runs.
5. **Spending.** Keep the existing per-run budget and daily cap. Also set a monthly spend limit in the Anthropic console as a second safety net.

## Technical details
- The engine reads the key with `source.ANTHROPIC_API_KEY` in `src/lib/deep/env.server.ts`.
- The Claude connection is `createAnthropicTransport`, which loads the SDK on demand with no automatic retries. The Vortex Scan blueprint review uses the same key in `src/lib/scan/blueprint/ai.server.ts`, so the AI review in the scan turns on too.
- No database changes.
