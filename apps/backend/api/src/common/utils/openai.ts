import axios from 'axios';

interface OpenAIJsonOptions {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  timeout?: number;
  temperature?: number;
  /** Override the default model. Defaults to gpt-4o-mini. */
  model?: string;
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
    model = 'gpt-4o-mini',
  } = options;

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model,
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

interface OpenAIJsonWithSearchOptions extends OpenAIJsonOptions {
  /** ISO 3166-1 alpha-2 country code, e.g. "US", "IN". Used to localize web search. */
  country?: string;
  /** Override the default model (gpt-4o-mini). Use "gpt-4o" for higher-quality search reasoning. */
  model?: string;
}

const WEB_SEARCH_FLAG = 'OPENAI_ENABLE_WEB_SEARCH';
const WEB_SEARCH_MODULES_FLAG = 'OPENAI_WEBSEARCH_MODULES';

/**
 * True if the given module name is enabled for web search via env flags.
 *
 * Logic:
 *   - If OPENAI_ENABLE_WEB_SEARCH is not "true", return false.
 *   - If OPENAI_WEBSEARCH_MODULES is set, only the listed modules return true.
 *   - Otherwise, all modules return true when the flag is on.
 */
export function isWebSearchEnabled(moduleName: string): boolean {
  if (process.env[WEB_SEARCH_FLAG] !== 'true') return false;
  const list = process.env[WEB_SEARCH_MODULES_FLAG];
  if (!list) return true;
  return list
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .includes(moduleName.toLowerCase());
}

/**
 * Call OpenAI via the Responses API with the web_search_preview tool enabled.
 * The model performs live web searches and returns a JSON object parsed from the final message.
 *
 * Notes:
 *   - The Responses API does NOT support response_format: json_object alongside
 *     the web_search_preview tool. We instead instruct the model to return raw JSON
 *     and then extract the first JSON object from the final assistant text.
 *   - country (ISO-2) is passed as user_location for localized SERP results.
 */
export async function callOpenAIJsonWithSearch<T = any>(
  options: OpenAIJsonWithSearchOptions,
): Promise<T> {
  const {
    apiKey,
    systemPrompt,
    userPrompt,
    maxTokens = 4000,
    timeout = 180000,
    temperature = 0.3,
    country,
    model = 'gpt-4o-mini',
  } = options;

  const jsonGuard =
    '\n\nRespond with ONLY a single valid JSON object. No prose, no markdown fences, no commentary before or after the JSON.';

  const tool: any = { type: 'web_search_preview' };
  if (country) {
    tool.user_location = { type: 'approximate', country: country.toUpperCase() };
  }

  const response = await axios.post(
    'https://api.openai.com/v1/responses',
    {
      model,
      temperature,
      max_output_tokens: maxTokens,
      tools: [tool],
      input: [
        {
          role: 'system',
          content: systemPrompt + jsonGuard,
        },
        {
          role: 'user',
          content: userPrompt,
        },
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

  const text = extractResponsesApiText(response.data);
  const json = extractFirstJsonObject(text);
  return JSON.parse(json) as T;
}

function extractResponsesApiText(data: any): string {
  if (typeof data?.output_text === 'string' && data.output_text.length > 0) {
    return data.output_text;
  }
  const output = data?.output;
  if (Array.isArray(output)) {
    const parts: string[] = [];
    for (const item of output) {
      if (item?.type === 'message' && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (typeof c?.text === 'string') parts.push(c.text);
          else if (typeof c?.text?.value === 'string') parts.push(c.text.value);
        }
      }
    }
    if (parts.length) return parts.join('\n');
  }
  throw new Error('OpenAI Responses API returned no text output');
}

function extractFirstJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in model output');
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  throw new Error('Unterminated JSON object in model output');
}
