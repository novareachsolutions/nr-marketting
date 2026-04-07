import axios from 'axios';

interface OpenAIJsonOptions {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  timeout?: number;
  temperature?: number;
}

/**
 * Call OpenAI gpt-4o-mini with JSON response format.
 * Returns the parsed JSON object.
 * Throws on failure (caller should handle).
 */
export async function callOpenAIJson<T = any>(
  options: OpenAIJsonOptions,
): Promise<T> {
  const {
    apiKey,
    systemPrompt,
    userPrompt,
    maxTokens = 3000,
    timeout = 120000,
    temperature = 0.3,
  } = options;

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout,
    },
  );

  const content = response.data.choices?.[0]?.message?.content;
  return JSON.parse(content) as T;
}
