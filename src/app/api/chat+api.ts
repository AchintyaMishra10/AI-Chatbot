const headers = { 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });

type Message = { role: 'user' | 'assistant'; text: string };

export async function POST(request: Request) {
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 100_000) return json({ error: 'Conversation is too long. Start a new chat.' }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Invalid chat request.' }, 400);
  }
  const messages = (body as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(messages) || !messages.length || messages.length > 40 ||
    !messages.every((m): m is Message => m !== null && typeof m === 'object' &&
      (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' &&
      m.text.trim().length > 0 && m.text.length <= 8000) || messages.at(-1)?.role !== 'user') {
    return json({ error: 'Send 1–40 messages ending with a user message.' }, 400);
  }
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!key || !model) return json({ error: 'Live chat is not configured yet. Set OPENAI_API_KEY and OPENAI_MODEL on the server.' }, 503);
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, store: false, max_output_tokens: 1200,
        instructions: 'You are mishirji ka bot, a helpful, thoughtful assistant. Answer clearly and honestly. Match the user’s language. Ask for clarification when necessary.',
        input: messages.map(m => ({ role: m.role, content: m.text })),
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) {
      return json({ error: response.status === 429 ? 'The AI service is busy or its usage limit was reached. Try again later.' : 'The AI service could not complete this reply. Try again later.' }, response.status === 429 ? 429 : 502);
    }
    const data = await response.json();
    if (data.status !== 'completed') return json({ error: 'The AI reply was incomplete. Please try again.' }, 502);
    const text = (data.output ?? []).filter((item: { type: string }) => item.type === 'message')
      .flatMap((item: { content?: { type: string; text?: string; refusal?: string }[] }) => item.content ?? [])
      .map((item: { type: string; text?: string; refusal?: string }) => item.type === 'output_text' ? item.text ?? '' : item.type === 'refusal' ? item.refusal ?? '' : '')
      .join('\n').trim();
    return text ? json({ text }) : json({ error: 'The AI service returned an empty reply. Please try again.' }, 502);
  } catch {
    return json({ error: 'The AI service could not be reached or timed out. Please try again.' }, 502);
  }
}
