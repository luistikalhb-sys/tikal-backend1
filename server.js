import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3001;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  : null;

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    name: 'Tikal Backend',
    message: 'Backend is running.',
    endpoints: ['/health', '/api/chat', '/api/voice']
  });
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    openai: Boolean(process.env.OPENAI_API_KEY),
    supabase: Boolean(supabase),
    elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY)
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    if (!openai) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is missing' });
    }

    const systemPrompt = `
You are Tikal Legend AI Ads OS assistant.
Help Luis build and operate an AI Facebook Ads Operating System.
Keep campaigns DRAFT or PAUSED only unless explicit human approval exists.
Be direct, practical, and step-by-step.
Project context:
- Frontend deployed on Vercel.
- Backend deployed on Railway.
- Supabase stores project data.
- Meta connection requires META_ACCESS_TOKEN and META_AD_ACCOUNT_ID.
- Safety contract: no live spend without human approval.
${context || ''}
`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
    });

    res.json({
      ok: true,
      reply: completion.choices?.[0]?.message?.content || ''
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'chat failed' });
  }
});

app.post('/api/voice', async (req, res) => {
  try {
    const { text, voiceId } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      return res.status(500).json({ error: 'ELEVENLABS_API_KEY is missing' });
    }

    const selectedVoice = voiceId || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(response.status).json({ error: 'ElevenLabs failed', detail });
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message || 'voice failed' });
  }
});

app.post('/api/businesses', async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase env vars missing' });

    const { name, niche, notes } = req.body;
    const { data, error } = await supabase.from('businesses').insert([{ name, niche, notes }]).select();

    if (error) throw error;
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message || 'business insert failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Tikal backend running on port ${PORT}`);
});
