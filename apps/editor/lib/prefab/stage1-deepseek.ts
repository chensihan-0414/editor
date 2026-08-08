import { MODULE_CATALOG } from './catalog'
import { SYSTEM_PROMPT, type Stage1Result } from './stage1'

const VALID_MODULE_IDS = Object.keys(MODULE_CATALOG)

// DeepSeek-backed variant of parseCustomerRequest() (stage1.ts), used only
// by app/api/parse-request/route.ts — the public "type your room needs, AI
// builds it" endpoint on the request marketing site. Kept as a separate
// function (rather than swapping stage1.ts's own parseCustomerRequest over
// to DeepSeek) because that original function is still used elsewhere —
// app/step1/page.tsx's ManualStep1Form calls it client-side against
// Anthropic with a user-supplied key, and that flow shouldn't silently
// start expecting a DeepSeek key instead.
//
// DeepSeek's Chat Completions API is OpenAI-format-compatible (base URL
// https://api.deepseek.com, path /chat/completions), confirmed against the
// current DeepSeek API docs (api-docs.deepseek.com) as of Aug 2026:
//   - Model: deepseek-v4-flash — the current fast/cheap model, sufficient
//     for this small structured-extraction task; deepseek-v4-pro (the
//     higher-cost "thinking" model) would be overkill here.
//   - Thinking mode is ON by default for this model family and adds
//     reasoning-token latency for no benefit on a task this small, so it's
//     explicitly disabled below via `thinking: { type: 'disabled' }`.
//   - `response_format: { type: 'json_object' }` (DeepSeek's JSON mode)
//     asks the model to return pure JSON — the system prompt already
//     mentions "JSON" repeatedly, which DeepSeek's docs say JSON mode
//     requires. The code-fence-stripping below is kept anyway as a
//     defensive fallback in case the model wraps the output regardless.
export async function parseCustomerRequestDeepSeek(customerMessage: string, apiKey: string): Promise<Stage1Result> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      max_tokens: 1000,
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: customerMessage },
      ],
    }),
  })
  if (!response.ok) {
    throw new Error(`DeepSeek API error ${response.status}: ${await response.text()}`)
  }
  const data = await response.json()
  const rawText: string = data.choices?.[0]?.message?.content ?? ''
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonText = fenced ? fenced[1].trim() : rawText.trim()

  let parsed: any
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error(`Model did not return valid JSON: ${rawText}`)
  }
  if (!Array.isArray(parsed.modules)) throw new Error('Model output missing "modules" array.')
  for (const m of parsed.modules) {
    if (!VALID_MODULE_IDS.includes(m.moduleId)) throw new Error(`Model invented an invalid moduleId: ${m.moduleId}`)
  }
  return parsed as Stage1Result
}
