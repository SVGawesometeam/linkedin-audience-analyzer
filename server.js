const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '200kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// =============================================
// Helper: call Anthropic API
// =============================================
async function callAnthropic(systemPrompt, userMessage, maxTokens = 4000) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('API key not configured on server');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  return response.json();
}

// =============================================
// System prompt for audience analysis
// =============================================
const SYSTEM_PROMPT = `You are an expert LinkedIn strategist and audience researcher. Given a user's niche/expertise and their goal on LinkedIn, you produce a comprehensive target audience analysis.

You MUST return ONLY valid JSON (no markdown, no backticks, no explanation) with this exact structure:

{
  "header": {
    "niche": "Short niche label",
    "goal_label": "Short goal label (e.g. Clients, Career, Brand, Networking)",
    "summary": "One-line summary like: Goal: attract clients - B2B, USA"
  },
  "audience_segments": [
    {
      "title": "Segment name",
      "description": "1-sentence why they are your audience"
    }
  ],
  "linkedin_filters": {
    "job_titles": ["Title1", "Title2", "Title3", "Title4", "Title5", "Title6"],
    "industries": ["Industry1", "Industry2", "Industry3", "Industry4", "Industry5"],
    "company_size": ["Size range 1", "Size range 2"],
    "keywords": ["keyword1", "keyword2", "keyword3", "keyword4"]
  },
  "content_ideas": [
    {
      "title": "Content idea headline",
      "format": "Format description - why it works"
    }
  ],
  "pain_triggers": {
    "main_pain": "The #1 pain point in their words",
    "fear": "What they're afraid of",
    "trust_builder": "What makes them trust you",
    "scroll_stopper": "What makes them stop scrolling"
  }
}

Rules:
- audience_segments: exactly 4 segments, specific to the niche
- job_titles: 5-7 specific LinkedIn job titles to search for
- industries: 4-6 relevant LinkedIn industries
- company_size: 1-3 company size ranges (use LinkedIn format like "1-10 employees", "11-50 employees", etc.)
- keywords: 3-5 profile keywords the target audience would have
- content_ideas: exactly 5 ideas, each with a compelling headline and format+reasoning
- pain_triggers: write in first person for main_pain (as if the audience is speaking), be specific not generic
- All content must be specific to the niche, not generic marketing advice
- Tailor everything to the stated goal (clients vs career vs brand vs networking)
- If additional context is provided (country, language, sector), factor it into every section`;

// =============================================
// API: Analyze audience
// =============================================
app.post('/api/analyze', async (req, res) => {
  const { niche, goal, context } = req.body;
  if (!niche) return res.status(400).json({ error: 'Niche is required' });
  if (!goal) return res.status(400).json({ error: 'Goal is required' });

  const goalLabels = {
    clients: 'Attract Clients',
    career: 'Career Growth',
    brand: 'Personal Brand',
    networking: 'Networking',
  };

  const userMsg = `Niche / Expertise: ${niche}
Goal on LinkedIn: ${goalLabels[goal] || goal}
${context ? `Additional context: ${context}` : ''}

Generate a complete LinkedIn audience analysis.`;

  try {
    const data = await callAnthropic(SYSTEM_PROMPT, userMsg, 4000);
    const text = data.content[0].text;
    const cleaned = text.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    const analysis = JSON.parse(cleaned);
    res.json({ analysis });
  } catch (err) {
    console.error('Analysis error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`LinkedIn Audience Analyzer running on port ${PORT}`);
});
