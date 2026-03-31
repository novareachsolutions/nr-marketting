# Phase 1 - AI Assistant & Content Tools

> **AI Provider:** Anthropic Claude API (Haiku for simple tasks, Sonnet for complex)
> **Modules:** AI Copilot/Assistant, Topic Research
> **Cost:** ~$20-50/month at MVP scale

---

## Table of Contents

- [AI Copilot / Assistant](#ai-copilot--assistant)
- [Topic Research](#topic-research)
- [AI Service Architecture](#ai-service-architecture)
- [Prompt Engineering](#prompt-engineering)
- [Cost Management](#cost-management)
- [API Endpoints](#api-endpoints)

---

## AI Copilot / Assistant

### What It Does

An AI-powered SEO consultant that analyzes the user's project data and provides actionable recommendations. Like Semrush Copilot (#23).

### Features

- Chat interface scoped to a project
- AI has access to project data (rankings, crawl issues, traffic)
- Proactive suggestions on dashboard ("Your traffic dropped because...")
- Conversation history saved per project
- Token usage tracked against plan limits

### How It Works

```
1. User types: "Why did my traffic drop this week?"

2. Backend:
   a. Load project context:
      - Latest ranking changes (keywords that dropped)
      - Latest crawl issues (new errors)
      - Traffic trend (from GA)
      - Recent backlink changes (Phase 2)
   b. Build system prompt with project data
   c. Include conversation history (last 10 messages)
   d. Send to Claude API
   e. Stream response back to frontend
   f. Save messages + token count to DB

3. Claude responds with data-driven analysis:
   "Your organic traffic dropped 12% this week. Here's why:
    1. Your top keyword 'best shoes' dropped from #4 to #9
    2. 3 new broken links were found on high-traffic pages
    3. Page /blog/shoes has a new noindex tag (accidental?)

    Recommended actions:
    1. Check /blog/shoes for accidental noindex meta tag
    2. Fix broken links on /products and /about pages
    3. Review content freshness for 'best shoes' keyword"
```

### System Prompt Template

```
You are an expert SEO consultant. You analyze website data and provide specific,
actionable recommendations. Be direct, no fluff. Use data from the context below.

## Project Context
Website: {domain}
Plan: {plan}

## Current Rankings (top 10 tracked keywords)
{rankingData as markdown table}

## Ranking Changes (last 7 days)
{keywords with significant position changes}

## Site Audit Summary
Health Score: {score}/100
Errors: {errorCount}
Warnings: {warningCount}
Top issues: {top 5 issues}

## Traffic Overview (last 30 days)
Sessions: {sessions} ({changePercent}% vs previous period)
Top pages: {top 5 pages by traffic}

## User's Question
{userMessage}

Respond concisely. Use bullet points. Reference specific pages and keywords from the data.
If the data doesn't contain enough information to answer, say so clearly.
```

### Dashboard Insight Cards (Proactive)

On the project dashboard, show 1-3 AI-generated insight cards:

```
Card 1 (if ranking dropped):
  "Your keyword 'best shoes' dropped 5 positions this week.
   Top-ranking competitors have longer, more detailed content on this topic."

Card 2 (if crawl found new errors):
  "3 new broken links detected on your highest-traffic pages.
   Fixing these could recover ~200 lost clicks per month."

Card 3 (general suggestion):
  "Your top page /blog/shoes has no internal links to related content.
   Adding 3-5 internal links could improve its ranking."
```

**Generated:** Once per day as a background job. Cached in Redis (24h TTL).
**Model used:** Claude Haiku (cheap, these are short summaries).

---

## Topic Research

### What It Does

User enters a broad topic -> system suggests blog post ideas, questions to answer, and related subtopics. Combines Claude AI with DataForSEO keyword data.

### Features

- Enter a topic (e.g., "real estate investing")
- Get 10-20 blog post title ideas
- Each idea includes: title, target keyword, estimated search volume
- "Questions people ask" section (FAQ content ideas)
- Related subtopics for content pillars

### How It Works

```
Step 1: User enters "real estate investing"

Step 2: Backend calls DataForSEO for keyword suggestions:
        - Get related keywords with search volume
        - Get "People Also Ask" questions (PAA)

Step 3: Backend sends to Claude with keyword data:
        Prompt: "Given these keywords and their search volumes,
                 suggest 15 blog post ideas. For each, specify:
                 - Blog title (click-worthy, under 60 chars)
                 - Target keyword
                 - Content type (how-to, listicle, guide, comparison)
                 - Estimated word count
                 - 3 key points to cover"

Step 4: Claude responds with structured suggestions

Step 5: Backend parses response, attaches search volumes from DataForSEO

Step 6: Return to frontend as structured JSON
```

### Topic Research Prompt

```
You are an SEO content strategist. Based on the seed topic and keyword data below,
suggest blog post ideas that have search demand and are achievable to rank for.

## Seed Topic
{topic}

## Keyword Data (from search engine)
{keyword list with search volumes and difficulty scores}

## Questions People Ask
{PAA questions from DataForSEO}

Generate exactly 15 blog post ideas. For each:
- title: Click-worthy blog title (under 60 characters)
- targetKeyword: Primary keyword to optimize for
- contentType: one of [how-to, listicle, guide, comparison, review, news]
- estimatedWordCount: recommended length based on competition
- keyPoints: 3 bullet points of what to cover
- difficulty: easy / medium / hard (based on keyword difficulty)

Respond ONLY in valid JSON array format. No markdown, no explanation.
```

### API Endpoints

```
POST /api/projects/:id/topics/research     Generate topic ideas
```

### Response Example

```json
{
  "success": true,
  "data": {
    "seed": "real estate investing",
    "ideas": [
      {
        "title": "How to Start Real Estate Investing with $5,000",
        "targetKeyword": "real estate investing for beginners",
        "searchVolume": 8100,
        "difficulty": 45,
        "contentType": "how-to",
        "estimatedWordCount": 2500,
        "keyPoints": [
          "REITs and crowdfunding platforms for small budgets",
          "House hacking strategy explained",
          "Tax advantages of real estate investing"
        ]
      },
      {
        "title": "15 Best Cities for Rental Property Investment in 2026",
        "targetKeyword": "best cities for rental property",
        "searchVolume": 4400,
        "difficulty": 52,
        "contentType": "listicle",
        "estimatedWordCount": 3000,
        "keyPoints": [
          "Market data: rent-to-price ratios by city",
          "Population growth trends",
          "Local landlord-friendly laws"
        ]
      }
    ],
    "questions": [
      "Is real estate a good investment right now?",
      "How much money do you need to start investing in real estate?",
      "What is the best type of real estate investment for beginners?",
      "How to invest in real estate with no money?"
    ],
    "subtopics": [
      "Rental property investing",
      "Real estate crowdfunding",
      "House flipping",
      "Commercial real estate",
      "REITs"
    ]
  }
}
```

---

## AI Service Architecture

### Service Structure

```
ai-assistant/
  |-- ai-assistant.module.ts       # NestJS module
  |-- ai-assistant.controller.ts   # REST endpoints
  |-- ai-assistant.service.ts      # Business logic (context building, response parsing)
  |-- claude.service.ts            # Claude API client wrapper
  |-- dto/
      |-- ask-assistant.dto.ts     # Chat message input
      |-- topic-research.dto.ts    # Topic research input
```

### Claude Service (Wrapper)

The `claude.service.ts` wraps the Anthropic SDK and provides:

- Model selection (Haiku vs Sonnet) based on task type
- Token counting
- Retry with exponential backoff (for 429/5xx errors)
- Response streaming support
- Error mapping to application errors

### Model Selection Per Task

| Task | Model | Reason |
|------|-------|--------|
| Dashboard insight cards | Claude Haiku | Short, simple summaries |
| Chat responses (simple questions) | Claude Haiku | Fast, cheap |
| Chat responses (deep analysis) | Claude Sonnet | Complex reasoning needed |
| Topic research | Claude Sonnet | Creative + analytical |
| Report summaries | Claude Haiku | Short text generation |

**Selection logic:** Default to Haiku. Use Sonnet only when:
- User's message is longer than 200 characters (indicates complex question)
- System prompt contains more than 2,000 tokens of context data
- Task explicitly requires Sonnet (topic research, article generation)

### Streaming Responses

For the chat interface, stream Claude's response token-by-token:

```
Frontend: SSE (Server-Sent Events) connection
Backend:  Claude API with stream: true
Pipeline: Claude stream -> NestJS SSE endpoint -> Browser EventSource

Benefits:
  - User sees response appearing word-by-word (ChatGPT-like UX)
  - Time to first token: ~500ms (feels instant)
  - No timeout issues for long responses
```

### Conversation History Management

```
Each conversation stores messages in ai_messages table.

When sending to Claude:
  1. Load system prompt (with current project data)
  2. Load last 10 messages from conversation (for context)
  3. Append user's new message
  4. Send to Claude
  5. Save assistant's response to DB
  6. Track tokens used

Context window management:
  - If conversation gets long (>20 messages), summarize older messages
  - Keep last 10 messages verbatim, summarize older ones
  - This prevents hitting Claude's context limit while preserving conversation flow
```

---

## Prompt Engineering

### Guidelines for All Prompts

1. **Be specific:** Tell Claude exactly what format to respond in (JSON, markdown, bullet points)
2. **Provide data:** Always include relevant project data in the prompt
3. **Set constraints:** Word limits, response format, what NOT to include
4. **Persona:** "You are an expert SEO consultant" — gives consistently good results
5. **Examples:** For structured outputs, include one example in the prompt

### Prompt Security

- Never include user passwords, tokens, or API keys in prompts
- Sanitize user input before including in prompts (prevent prompt injection)
- Don't expose internal system details in prompts
- Rate limit AI endpoints per user

### Response Parsing

For structured responses (JSON):
```
1. Ask Claude to respond "ONLY in valid JSON, no markdown"
2. Try JSON.parse(response)
3. If parse fails: retry once with "Your previous response was not valid JSON. Please respond ONLY with the JSON array, no other text."
4. If still fails: return error to user
```

---

## Cost Management

### Pricing (Anthropic Claude API as of 2026)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|----------------------|
| Claude Haiku 4.5 | $0.80 | $4.00 |
| Claude Sonnet 4.6 | $3.00 | $15.00 |

### Estimated Monthly Cost at MVP Scale

| Usage Scenario | Model | Tokens/request | Requests/month | Cost |
|---------------|-------|---------------|----------------|------|
| Dashboard insights | Haiku | ~1,500 | 1,000 | ~$2 |
| Chat messages | Haiku | ~2,000 | 2,000 | ~$5 |
| Complex chat | Sonnet | ~3,000 | 500 | ~$8 |
| Topic research | Sonnet | ~4,000 | 200 | ~$5 |
| **Total** | | | | **~$20/month** |

### Cost Controls

1. **Plan limits:** Free=10, Pro=200, Agency=unlimited AI messages per month
2. **Token tracking:** Every request logs tokens used in `ai_messages.tokensUsed`
3. **Model routing:** Use Haiku by default, Sonnet only when needed
4. **Response caching:** Cache dashboard insights for 24 hours
5. **Max tokens per response:** Cap at 2,000 tokens output (prevents runaway generation)
6. **Rate limiting:** 20 AI requests per hour per user

---

## API Endpoints

### POST /api/projects/:id/ai/chat

Send a message to the AI assistant.

**Request:**
```json
{
  "conversationId": "conv123",
  "message": "Why did my traffic drop this week?"
}
```

If `conversationId` is null, creates a new conversation.

**Response (SSE stream):**
```
event: token
data: {"content": "Your"}

event: token
data: {"content": " organic"}

event: token
data: {"content": " traffic"}

...

event: done
data: {"conversationId": "conv123", "messageId": "msg456", "tokensUsed": 1250}
```

### GET /api/projects/:id/ai/conversations

List all conversations for a project.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "conv123",
      "title": "Traffic drop analysis",
      "lastMessage": "Your organic traffic dropped 12%...",
      "messageCount": 8,
      "updatedAt": "2026-03-31T10:30:00.000Z"
    }
  ]
}
```

### GET /api/projects/:id/ai/conversations/:convId

Get full conversation with all messages.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "conv123",
    "title": "Traffic drop analysis",
    "messages": [
      {
        "id": "msg1",
        "role": "USER",
        "content": "Why did my traffic drop this week?",
        "createdAt": "2026-03-31T10:00:00.000Z"
      },
      {
        "id": "msg2",
        "role": "ASSISTANT",
        "content": "Your organic traffic dropped 12% this week...",
        "tokensUsed": 1250,
        "createdAt": "2026-03-31T10:00:05.000Z"
      }
    ]
  }
}
```

### GET /api/projects/:id/ai/insights

Get AI-generated dashboard insight cards (cached, generated daily).

**Response:**
```json
{
  "success": true,
  "data": {
    "insights": [
      {
        "type": "ranking_drop",
        "priority": "high",
        "title": "Top keyword dropped 5 positions",
        "message": "Your keyword 'best shoes' dropped from #4 to #9...",
        "action": "Review content freshness and update with latest information"
      },
      {
        "type": "crawl_issues",
        "priority": "medium",
        "title": "3 new broken links detected",
        "message": "Pages /products and /about have broken internal links...",
        "action": "Fix broken links to recover estimated 200 clicks/month"
      }
    ],
    "generatedAt": "2026-03-31T02:00:00.000Z"
  }
}
```

### POST /api/projects/:id/topics/research

Generate topic and content ideas.

**Request:**
```json
{
  "topic": "real estate investing",
  "country": "US",
  "count": 15
}
```

**Response:** (See Topic Research section above for full response format)

### DELETE /api/projects/:id/ai/conversations/:convId

Delete a conversation and all its messages.
