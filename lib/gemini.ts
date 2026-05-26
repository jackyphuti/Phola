export type GeminiAssistantMode = 'safety' | 'reporting' | 'planning' | 'resources'

export type GeminiAssistantRequest = {
  message: string
  language?: string
  mode?: GeminiAssistantMode
}

export type GeminiAssistantResponse = {
  reply: string
  emergency: boolean
  actions: Array<{
    label: string
    href?: string
  }>
}

const SAFETY_SYSTEM_PROMPT = `You are Sisi/Buti Bot, a private safety assistant for a gender-based violence support app in South Africa.
Rules:
- Be supportive, calm, direct, and culturally aware.
- Respond in the user's language when possible.
- Do not mention policies, disclaimers, or being an AI.
- Never ask for or store personal identity details unless required for the task.
- If the user appears in immediate danger, prioritize immediate safety steps, emergency services, SOS screen, trusted circle, and nearby safe places.
- Keep responses short, actionable, and step-by-step.
- Never encourage violence, retaliation, or illegal activity.
- Do not retain conversation history. Treat each message independently.
- Prefer practical app actions users can do right now inside the app.`

export function buildGeminiPrompt(input: GeminiAssistantRequest) {
  const language = input.language?.trim() || 'English'
  const mode = input.mode || 'safety'

  return `${SAFETY_SYSTEM_PROMPT}

User language: ${language}
Assistant mode: ${mode}

User message:
${input.message}

Return a compact JSON object with this exact shape:
{
  "reply": string,
  "emergency": boolean,
  "actions": [{ "label": string, "href"?: string }]
}

Use href values only for in-app routes such as /sos, /report, /resources, /settings, /dashboard. If no action is useful, return an empty array.`
}
