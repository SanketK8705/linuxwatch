const OPENAI_COMPAT = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    label: 'OpenAI',
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.3-70b-versatile',
    label: 'Groq',
  },
};

function defaultModelFor(provider) {
  if (provider === 'anthropic') return 'claude-sonnet-4-20250514';
  return OPENAI_COMPAT[provider]?.defaultModel || OPENAI_COMPAT.openai.defaultModel;
}

async function callOpenAICompatible({ url, model, apiKey, systemPrompt, userPrompt, label }) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${label} API error: ${res.status} ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || 'No response';
}

async function callAnthropic({ model, apiKey, systemPrompt, userPrompt }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${res.status} ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || 'No response';
}

async function callLLM(systemPrompt, userPrompt) {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new Error('AI_API_KEY not configured');

  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();
  const model = process.env.AI_MODEL || defaultModelFor(provider);

  if (provider === 'anthropic') {
    return callAnthropic({ model, apiKey, systemPrompt, userPrompt });
  }

  const cfg = OPENAI_COMPAT[provider] || OPENAI_COMPAT.openai;
  return callOpenAICompatible({
    url: cfg.url,
    model,
    apiKey,
    systemPrompt,
    userPrompt,
    label: cfg.label,
  });
}

module.exports = { callLLM };
