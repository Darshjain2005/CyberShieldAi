import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import os from 'os';
import path from 'path';
import axios from 'axios';

ffmpeg.setFfmpegPath(ffmpegPath);

// Keywords that indicate the LLM reasoned the content is AI-generated,
// even if it returned isPhishing: false (catches the "gorilla" case)
const AI_REASONING_KEYWORDS = [
  'generated', 'rendered', 'synthetic', 'cgi', 'computer-generated',
  'ai-generated', 'artificial', 'animation', 'animated', 'virtual',
  'not photorealistic', 'not a real', 'does not appear real',
  'appears to be created', 'digitally created', 'looks artificial',
  'looks generated', 'looks rendered', 'suggests it is generated',
  'suggesting it is generated', 'suggesting it was generated',
  'suggesting it is a generated', 'not captured', 'not photographed',
  'simulated', 'stylized', 'unrealistic lighting', 'unnatural'
];

// ─────────────────────────────────────────────────────────────────────────────
// PASS 1 — General AI-generation check (covers humans, animals, objects, scenes)
// ─────────────────────────────────────────────────────────────────────────────
const GENERAL_AI_DETECTION_PROMPT = `You are a forensic video analyst detecting AI-generated or synthetic content.

Your job is to determine whether this video frame was captured by a real camera, or whether it was AI-generated, CGI-rendered, or digitally synthesized in any way.

This applies to ALL content types — it does NOT matter whether the frame shows:
- Humans (face swaps, deepfakes)
- Animals (AI-generated creatures, CG animals)
- Scenes (AI-generated landscapes, synthetic environments)
- Any other subject matter

Examine the frame for these AUTHENTICITY MARKERS of real captured footage:
- Film grain, sensor noise, or natural motion blur (real cameras always produce these)
- Physically accurate, uneven, imperfect surface textures (real fur, skin, concrete, fabric)
- Natural, irregular specular highlights on surfaces
- Consistent, physically plausible depth-of-field and bokeh
- Realistic, slightly imperfect geometry (real objects aren't perfect)
- Natural lighting interactions — shadows, subsurface scattering, ambient occlusion

And these RED FLAGS of AI/CGI generation:
- Unnaturally smooth, "clean" or overly detailed textures without natural variation
- Lighting that looks artificially uniform or comes from no discernible source
- Geometry that looks too perfect or slightly "floaty"
- Fur, hair or cloth that looks computed rather than physically simulated
- Background elements that lack natural depth, grain or atmospheric haze
- An overall "painted" or "rendered" aesthetic quality
- Subjects or objects that violate physical plausibility (e.g. perfect symmetry)

IMPORTANT: You MUST give a verdict. If ANY element of the frame looks synthetic, generated, or rendered rather than filmed — even slightly — flag it as deepfake/AI-generated. Modern AI video is very convincing; err on the side of flagging.

RESPOND ONLY IN THIS EXACT JSON FORMAT (no markdown, no extra text):
{"isPhishing": true/false, "confidence": <integer 55-95>, "explanation": "<describe what you found for each category — textures, lighting, geometry, overall aesthetic. State explicitly whether this looks filmed or generated.>"}`;

// ─────────────────────────────────────────────────────────────────────────────
// PASS 2 — Targeted second opinion on the most suspicious frames
// ─────────────────────────────────────────────────────────────────────────────
const SECOND_OPINION_PROMPT = `You are reviewing a video frame that a first analysis system flagged as potentially AI-generated or synthetic. Give your independent assessment.

Examine the frame carefully and answer: Was this frame captured by a real camera, or was it AI-generated / CGI-rendered?

Focus on:
1. PHYSICS: Do lighting, shadows, reflections, and materials follow real-world physics? Or do they look computed?
2. TEXTURE QUALITY: Do surfaces (skin, fur, fabric, ground) have natural micro-detail and imperfections, or do they look generated?
3. OVERALL FEEL: Does the image have the "weight" of a real photograph, or does it feel like a render from a game engine, AI model, or CGI pipeline?
4. SUBJECT PLAUSIBILITY: Does the subject (human, animal, object, scene) look physically real, or does it look like an AI's idea of what something looks like?

Give your honest verdict. Do not defer to what the previous system said.

RESPOND ONLY IN THIS EXACT JSON FORMAT:
{"isPhishing": true/false, "confidence": <integer 55-95>, "explanation": "<your independent assessment on each point above>"}`;

/**
 * Checks whether the LLM's own explanation text contains AI-generation language,
 * even if it returned isPhishing: false. This catches the case where the model
 * correctly reasons the content is synthetic but votes wrong due to prompt framing.
 */
function explanationImpliesAI(explanation = '') {
  const lower = explanation.toLowerCase();
  return AI_REASONING_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Extracts N evenly-spaced frames from a video buffer using ffmpeg.
 * Returns an array of JPEG image Buffers.
 */
export async function extractVideoFrames(buffer, mimetype, numFrames = 6) {
  const ext = (mimetype.split('/')[1] || 'mp4').split(';')[0];
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shield-'));
  const inputPath = path.join(tmpDir, `input.${ext}`);
  const framePattern = path.join(tmpDir, 'frame-%03d.jpg');

  fs.writeFileSync(inputPath, buffer);

  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (probeErr, metadata) => {
      if (probeErr) console.warn('[Video] ffprobe warning:', probeErr.message);
      const duration = metadata?.format?.duration || 10;
      const fps = numFrames / Math.max(duration, 1);

      ffmpeg(inputPath)
        .outputOptions([
          `-vf fps=${fps.toFixed(6)}`,
          '-vframes', String(numFrames),
          '-q:v', '2'
        ])
        .output(framePattern)
        .on('end', () => {
          const frames = [];
          for (let i = 1; i <= numFrames; i++) {
            const framePath = path.join(tmpDir, `frame-${String(i).padStart(3, '0')}.jpg`);
            if (fs.existsSync(framePath)) frames.push(fs.readFileSync(framePath));
          }
          try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
          console.log(`[Video] Extracted ${frames.length}/${numFrames} frames from ${duration.toFixed(1)}s video`);
          resolve(frames);
        })
        .on('error', (err) => {
          try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
          reject(err);
        })
        .run();
    });
  });
}

/**
 * Runs a single LLM vision call on a frame buffer.
 */
async function runFrameAnalysis(frameBuffer, prompt, groqApiKey, label) {
  const base64 = frameBuffer.toString('base64');
  try {
    const res = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: 350,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
          ]
        }]
      },
      {
        headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    const content = res.data.choices[0].message.content;
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);

      // Key fix: if LLM voted false but its own explanation implies AI generation,
      // override the vote. The LLM can reason correctly but vote wrong due to prompt framing.
      if (!parsed.isPhishing && explanationImpliesAI(parsed.explanation)) {
        console.log(`[Video][${label}] ⚡ Explanation override: LLM said clean but explanation implies AI — flipping to deepfake`);
        parsed.isPhishing = true;
        parsed.confidence = Math.max(parsed.confidence || 65, 65);
        parsed.explanation = `[Auto-flagged from reasoning] ${parsed.explanation}`;
      }

      console.log(`[Video][${label}] deepfake=${parsed.isPhishing}, confidence=${parsed.confidence}`);
      return parsed;
    }
  } catch (e) {
    console.warn(`[Video][${label}] Failed:`, e.response?.data?.error?.message || e.message);
  }
  return null;
}

/**
 * Dual-pass video frame analysis.
 * Pass 1: General AI-generation check on a sample of frames (covers human AND non-human content)
 * Pass 2: Second opinion on the flagged (or first 2) frames
 */
export async function analyzeVideoFrames(frameBuffers, groqApiKey) {
  // ── PASS 1: General AI detection on up to 4 evenly sampled frames ──
  const step = Math.max(1, Math.ceil(frameBuffers.length / 4));
  const pass1Frames = frameBuffers.filter((_, i) => i % step === 0).slice(0, 4);

  console.log(`[Video] Pass 1: General AI detection on ${pass1Frames.length} frames...`);
  const pass1Results = [];
  for (let i = 0; i < pass1Frames.length; i++) {
    const result = await runFrameAnalysis(pass1Frames[i], GENERAL_AI_DETECTION_PROMPT, groqApiKey, `P1-F${i + 1}`);
    if (result) pass1Results.push({ frame: pass1Frames[i], result, index: i });
  }

  if (pass1Results.length === 0) {
    return { isPhishing: false, confidence: 50, explanation: 'Frame analysis inconclusive — no frames could be processed' };
  }

  const p1Flagged = pass1Results.filter(r => r.result.isPhishing);
  const p1Total = pass1Results.length;
  const p1FlaggedCount = p1Flagged.length;

  // ── PASS 2: Second opinion on flagged frames (or first 2 if nothing flagged) ──
  const pass2Candidates = p1FlaggedCount > 0
    ? p1Flagged.slice(0, 2)
    : pass1Results.slice(0, 2);

  console.log(`[Video] Pass 2: Second opinion on ${pass2Candidates.length} frames...`);
  const pass2Results = [];
  for (const candidate of pass2Candidates) {
    const result = await runFrameAnalysis(candidate.frame, SECOND_OPINION_PROMPT, groqApiKey, `P2-F${candidate.index + 1}`);
    if (result) pass2Results.push(result);
  }

  // ── VERDICT ──
  const p2FlaggedCount = pass2Results.filter(r => r.isPhishing).length;
  const isTemporallyInconsistent = p1FlaggedCount > 0 && p1FlaggedCount < p1Total;

  const allConfidences = [
    ...pass1Results.map(r => r.result.confidence || 70),
    ...pass2Results.map(r => r.confidence || 70)
  ];
  const avgConfidence = Math.round(allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length);

  let isDeepfake = false;
  let finalConfidence = avgConfidence;
  let verdictReason = '';

  if (p1FlaggedCount > 0 && p2FlaggedCount > 0) {
    isDeepfake = true;
    finalConfidence = Math.min(avgConfidence + 10, 95);
    verdictReason = `Both analysis passes confirmed AI-generated content. `;
  } else if (p1FlaggedCount > 0) {
    const maxConf = Math.max(...p1Flagged.map(r => r.result.confidence || 70));
    isDeepfake = maxConf >= 65;
    finalConfidence = avgConfidence;
    verdictReason = isDeepfake
      ? `AI-generation detected (confidence ${maxConf}%). `
      : `Weak AI-generation signal detected (confidence ${maxConf}%). `;
  } else if (p2FlaggedCount > 0) {
    isDeepfake = true;
    finalConfidence = Math.min(avgConfidence + 5, 90);
    verdictReason = `Second-pass analysis detected AI-generation artifacts. `;
  } else {
    verdictReason = `Both passes found no AI-generation artifacts. `;
  }

  if (isTemporallyInconsistent) {
    verdictReason += '⚠️ Temporal inconsistency across frames detected. ';
    if (!isDeepfake) { isDeepfake = true; finalConfidence = Math.max(finalConfidence, 67); }
    else { finalConfidence = Math.min(finalConfidence + 8, 95); }
  }

  const artifactDetails = [
    ...pass1Results.filter(r => r.result.isPhishing).map(r => `[Frame ${r.index + 1}]: ${r.result.explanation}`),
    ...pass2Results.filter(r => r.isPhishing).map((r, i) => `[Pass 2 frame ${i + 1}]: ${r.explanation}`)
  ].join(' | ');

  // If clean, still surface what the LLM saw
  const cleanDetail = !isDeepfake && pass1Results[0]?.result?.explanation
    ? pass1Results[0].result.explanation
    : '';

  return {
    isPhishing: isDeepfake,
    confidence: finalConfidence,
    explanation: verdictReason + (artifactDetails || cleanDetail),
    frameVotes: {
      pass1: { deepfake: p1FlaggedCount, clean: p1Total - p1FlaggedCount, total: p1Total },
      pass2: { deepfake: p2FlaggedCount, clean: pass2Results.length - p2FlaggedCount, total: pass2Results.length }
    }
  };
}

/**
 * Fallback when frame extraction fails — metadata heuristics + LLM.
 */
export async function analyzeVideoMetadataFallback(buffer, originalname, groqApiKey) {
  let strings = '';
  if (buffer.length <= 500000) {
    strings = buffer.toString('ascii').match(/[ -~]{4,}/g)?.join(' ') || '';
  } else {
    const startStr = buffer.subarray(0, 250000).toString('ascii').match(/[ -~]{4,}/g)?.join(' ') || '';
    const endStr = buffer.subarray(buffer.length - 250000).toString('ascii').match(/[ -~]{4,}/g)?.join(' ') || '';
    strings = startStr + ' ' + endStr;
  }

  const AI_SIGNATURES = [
    'stable-diffusion', 'stablediffusion', 'midjourney', 'deepfacelab', 'faceswap',
    'neural-render', 'diffusion-model', 'gan-generated', 'runwayml', 'runway ml',
    'pika labs', 'sora', 'kling', 'hailuo', 'reface', 'avatarify', 'deepfakes'
  ];
  const lowerStrings = strings.toLowerCase();
  const foundSig = AI_SIGNATURES.find(sig => lowerStrings.includes(sig));
  if (foundSig) {
    return { isPhishing: true, confidence: 92, explanation: `[Metadata] Explicit AI signature found: "${foundSig}"` };
  }

  const groqRes = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a video forensics analyst. Examine these metadata strings. Common encoders (FFmpeg, Lavf, WhatsApp, iOS, Android) are normal. Only flag if you find explicit AI/GAN/deepfake tool signatures. Respond ONLY in valid JSON: {"isPhishing": true/false, "confidence": 50-85, "explanation": "<findings>"}'
        },
        { role: 'user', content: `Filename: ${originalname}\nMetadata: ${strings.substring(0, 2500)}` }
      ]
    },
    { headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' } }
  );

  const content = groqRes.data.choices[0].message.content;
  const match = content.match(/\{[\s\S]*\}/);
  const result = match ? JSON.parse(match[0]) : JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim());
  result.explanation = '[⚠️ Frame extraction unavailable — metadata only] ' + result.explanation;
  result.confidence = Math.min(result.confidence || 60, 78);
  return result;
}
