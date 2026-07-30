import { MODULE_CATALOG } from './catalog'

const VALID_MODULE_IDS = Object.keys(MODULE_CATALOG)

const SYSTEM_PROMPT = `You convert a customer's plain-language house request into a structured list of prefab modules. Output ONLY a JSON object, nothing else — no prose, no markdown fences.

Format: { "modules": [{ "moduleId": "...", "quantity": N }, ...], "unmapped": ["..."] }

Valid moduleIds — never invent one that isn't here: ${VALID_MODULE_IDS.join(', ')}
- bedroom-std: "bedroom"
- bedroom-master: "master bedroom", "ensuite bedroom"
- bathroom-std: "bathroom"
- kitchen-open: "kitchen"
- living-room: "living room"
- hallway-connector: never requested directly, auto-added
- porch-covered: "porch", "covered porch"
- utility-mechanical: never requested directly, always auto-added once
- storage-loft: "loft" — only if a pitched roof is mentioned

Rules:
1. Map each explicitly mentioned room to the closest moduleId. Repeated rooms become quantity.
2. Always include exactly one utility-mechanical by default.
3. Add one extra utility-mechanical per additional bathroom/kitchen ONLY if the customer explicitly asks for independent water supply.
4. Add one hallway-connector whenever both a bathroom-type module and kitchen-open appear together.
5. Do not omit modules to stay under any size limit.
6. If part of the request doesn't map to any moduleId, leave it out of modules and list it in unmapped instead.`

export interface Stage1Result {
  modules: { moduleId: string; quantity: number }[]
  unmapped: string[]
}

export async function parseCustomerRequest(customerMessage: string, apiKey: string): Promise<Stage1Result> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: customerMessage }],
    }),
  })
  if (!response.ok) {
    throw new Error(`Claude API error ${response.status}: ${await response.text()}`)
  }
  const data = await response.json()
  const rawText: string = data.content?.[0]?.text ?? ''
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
