import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import os from 'os';
import path from 'path';
import axios from 'axios';

ffmpeg.setFfmpegPath(ffmpegPath);

// ─────────────────────────────────────────────────────────────────────────────
// Vision model cascade — try primary first, fall back on model-level errors.
// Fix V4: The code no longer hard-depends on a single model ID.
// ─────────────────────────────────────────────────────────────────────────────
const VISION_MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct', // primary — newest, highest capability
  'llama-3.2-11b-vision-preview',              // fallback 1 — stable Groq vision model
  'llava-v1.5-7b-4096-preview',                // fallback 2 — legacy but broadly available
];

// Keywords that indicate the LLM reasoned AI-generated even when it voted clean.
// Catches models that reason correctly but produce a wrong final vote.
const AI_REASONING_KEYWORDS = [
  'generated', 'rendered', 'synthetic', 'cgi', 'computer-generated',
  'ai-generated', 'artificial', 'animation', 'animated', 'virtual',
  'not photorealistic', 'not a real', 'does not appear real',
  'appears to be created', 'digitally created', 'looks artificial',
  'looks generated', 'looks rendered', 'suggests it is generated',
  'suggesting it is generated', 'suggesting it was generated',
  'suggesting it is a generated', 'not captured', 'not photographed',
  'simulated', 'stylized', 'unrealistic lighting', 'unnatural',
];

// ─────────────────────────────────────────────────────────────────────────────
// LLM Prompts
// ─────────────────────────────────────────────────────────────────────────────
const GENERAL_AI_DETECTION_PROMPT = `You are a forensic video analyst detecting AI-generated or synthetic content.

Your job is to determine whether this video frame was captured by a real camera, or whether it was AI-generated, CGI-rendered, or digitally synthesized in any way.

This applies to ALL content types — humans (deepfakes), animals (CGI creatures), scenes (synthetic environments), or any other subject.

Examine the frame for AUTHENTICITY MARKERS of real captured footage:
- Film grain, sensor noise, or natural motion blur (real cameras always produce these)
- Physically accurate, uneven, imperfect surface textures (real fur, skin, concrete, fabric)
- Natural, irregular specular highlights on surfaces
- Consistent, physically plausible depth-of-field and bokeh
- Realistic, slightly imperfect geometry (real objects aren't perfect)
- Natural lighting interactions — shadows, subsurface scattering, ambient occlusion

And RED FLAGS of AI/CGI generation:
- Unnaturally smooth, "clean" or overly detailed textures without natural variation
- Lighting that looks artificially uniform or comes from no discernible source
- Geometry that looks too perfect or slightly "floaty"
- Fur, hair or cloth that looks computed rather than physically simulated
- Background elements that lack natural depth, grain or atmospheric haze
- An overall "painted" or "rendered" aesthetic quality
- Subjects or objects that violate physical plausibility (e.g. perfect symmetry)

IMPORTANT: You MUST give a verdict. If ANY element of the frame looks synthetic, generated, or rendered rather than filmed — even slightly — flag it.

RESPOND ONLY IN THIS EXACT JSON FORMAT (no markdown, no extra text):
{"isPhishing": true/false, "confidence": <integer 55-95>, "explanation": "<describe textures, lighting, geometry, overall aesthetic — state explicitly whether this looks filmed or generated>"}`;

const SECOND_OPINION_PROMPT = `You are reviewing a video frame that a first analysis system flagged as potentially AI-generated or synthetic. Give your independent assessment.

Examine the frame carefully: Was this captured by a real camera, or was it AI-generated / CGI-rendered?

Focus on:
1. PHYSICS: Do lighting, shadows, reflections, and materials follow real-world physics? Or do they look computed?
2. TEXTURE QUALITY: Do surfaces (skin, fur, fabric, ground) have natural micro-detail and imperfections, or do they look generated?
3. OVERALL FEEL: Does the image have the "weight" of a real photograph, or does it feel like a render from a game engine or AI pipeline?
4. SUBJECT PLAUSIBILITY: Does the subject look physically real, or like an AI's interpretation of something?

Give your honest verdict. Do not defer to what the previous system said.

RESPOND ONLY IN THIS EXACT JSON FORMAT:
{"isPhishing": true/false, "confidence": <integer 55-95>, "explanation": "<your independent assessment on each point above>"}`;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function explanationImpliesAI(explanation = '') {
  const lower = explanation.toLowerCase();
  return AI_REASONING_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Returns N evenly-spaced indices from an array of length `total`.
 * Always includes the first and last element. Deduplicates edge cases.
 * Fix V3: replaces the previous step-based modulo that dropped frames.
 */
function evenlySpacedIndices(total, count) {
  if (total <= count) return Array.from({ length: total }, (_, i) => i);
  const indices = new Set();
  for (let i = 0; i < count; i++) {
    indices.add(Math.round((i / (count - 1)) * (total - 1)));
  }
  return [...indices].sort((a, b) => a - b);
}

// ─────────────────────────────────────────────────────────────────────────────
// Frame Extraction  (Fix V1 + V2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts N evenly-spaced frames from a video buffer using ffmpeg.
 *
 * Architecture note (scalability):
 *   Currently accepts a Buffer (Multer memory storage, ≤50 MB fine for demo).
 *   To support disk-buffered uploads in the future, add an optional `inputPath`
 *   parameter — if provided, skip writeFileSync and pass it directly to ffmpeg.
 *
 * @param {Buffer} buffer     - Raw video bytes from Multer
 * @param {string} mimetype   - MIME type e.g. 'video/mp4'
 * @param {number} numFrames  - Target number of frames to extract
 * @returns {Promise<Buffer[]>} Array of JPEG frame Buffers
 */
export async function extractVideoFrames(buffer, mimetype, numFrames = 6) {
  // Strip codec suffixes: 'video/mp4; codecs=avc1' → 'mp4'
  const ext = (mimetype.split('/')[1] || 'mp4').split(';')[0].split('+')[0];

  // Fix V1: Use mkdtempSync with a prefix that contains NO spaces or special chars.
  // Windows paths with spaces cause fluent-ffmpeg to misparse the command line.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shield'));
  const inputPath = path.join(tmpDir, `input.${ext}`);
  const framePattern = path.join(tmpDir, 'frame-%03d.jpg');

  fs.writeFileSync(inputPath, buffer);

  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (probeErr, metadata) => {
      if (probeErr) console.warn('[Video] ffprobe warning:', probeErr.message);

      const duration = Math.max(metadata?.format?.duration || 5, 0.5);

      // Fix V2: Use a timestamp-based select filter instead of combining
      // `-vf fps=X` with `-vframes N`. The old approach failed when the
      // computed fps exceeded the video's native fps, producing 0 frames.
      // select='isnan(prev_selected_t)+gte(t-prev_selected_t,INTERVAL)'
      // picks one frame every INTERVAL seconds, guaranteed regardless of fps.
      const interval = duration / numFrames;
      const selectFilter = `select='isnan(prev_selected_t)+gte(t-prev_selected_t,${interval.toFixed(4)})'`;

      console.log(
        `[Video] Extracting up to ${numFrames} frames from ${duration.toFixed(1)}s video` +
        ` (one every ${interval.toFixed(2)}s)`
      );

      ffmpeg(inputPath)
        .outputOptions([
          `-vf`, selectFilter,
          '-vsync', 'vfr',        // required with the select filter (variable-rate output)
          '-q:v', '2',            // near-lossless JPEG quality
          '-frames:v', String(numFrames), // hard cap in case select overshoots
        ])
        .output(framePattern)
        .on('end', () => {
          const frames = [];
          for (let i = 1; i <= numFrames; i++) {
            const fp = path.join(tmpDir, `frame-${String(i).padStart(3, '0')}.jpg`);
            if (fs.existsSync(fp)) frames.push(fs.readFileSync(fp));
          }
          try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}

          // Fix V1: Reject explicitly if ffmpeg ran but produced nothing.
          // Downstream callers then trigger the metadata fallback.
          if (frames.length === 0) {
            return reject(
              new Error(`ffmpeg completed but extracted 0 frames from ${duration.toFixed(1)}s video`)
            );
          }
          console.log(`[Video] Extracted ${frames.length}/${numFrames} frames`);
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

// ─────────────────────────────────────────────────────────────────────────────
// Single-frame LLM Analysis with model cascade  (Fix V4)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs one LLM vision call on a frame buffer.
 * Tries each model in VISION_MODELS in order; cascades on 400/404 errors.
 * Auth (401) and rate-limit (429) errors abort immediately — no model will fix those.
 *
 * @param {Buffer} frameBuffer - JPEG frame
 * @param {string} prompt      - System prompt
 * @param {string} groqApiKey
 * @param {string} label       - Log label e.g. 'P1-F2'
 * @returns {object|null}
 */
async function runFrameAnalysis(frameBuffer, prompt, groqApiKey, label) {
  const base64 = frameBuffer.toString('base64');

  for (const model of VISION_MODELS) {
    try {
      const res = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model,
          max_tokens: 350,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
            ],
          }],
        },
        {
          headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
          timeout: 30000,
        }
      );

      const content = res.data.choices[0].message.content;
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) {
        console.warn(`[Video][${label}] Model ${model}: non-JSON response, trying next model`);
        continue;
      }

      const parsed = JSON.parse(match[0]);

      // Explanation-based vote correction:
      // The LLM sometimes reasons correctly ("this looks generated") but votes false
      // due to prompt framing. Override the vote when explanation implies AI content.
      if (!parsed.isPhishing && explanationImpliesAI(parsed.explanation)) {
        console.log(`[Video][${label}] ⚡ Explanation override → flipping to deepfake (${model})`);
        parsed.isPhishing = true;
        parsed.confidence = Math.max(parsed.confidence || 65, 65);
        parsed.explanation = `[Auto-flagged from reasoning] ${parsed.explanation}`;
      }

      console.log(
        `[Video][${label}] deepfake=${parsed.isPhishing}, ` +
        `confidence=${parsed.confidence} (model: ${model})`
      );
      parsed._model = model; // attach for signals/debug
      return parsed;

    } catch (e) {
      const status = e.response?.status;
      const errMsg = e.response?.data?.error?.message || e.message;

      if (status === 401) {
        console.error(`[Video][${label}] Auth error — GROQ_API_KEY invalid`);
        return null; // no point trying other models
      }
      if (status === 429) {
        console.warn(`[Video][${label}] Rate-limited — aborting cascade`);
        return null;
      }

      // 400 (bad request / model doesn't support vision) or 404 (model not found)
      // → try next model in cascade
      console.warn(
        `[Video][${label}] Model ${model} failed (HTTP ${status ?? 'network'}): ${errMsg}` +
        ` — trying next model`
      );
    }
  }

  console.error(`[Video][${label}] All ${VISION_MODELS.length} vision models exhausted — frame skipped`);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dual-pass video frame analysis  (Fix V3 + V5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dual-pass video frame analysis with parallel LLM calls.
 *
 * Pass 1 — General AI-generation check, up to 4 evenly sampled frames, concurrent.
 * Pass 2 — Second opinion on the most suspicious frames, concurrent.
 *
 * Fix V3: Frame selection uses evenlySpacedIndices() — no more step-based modulo drops.
 * Fix V5: Both passes use Promise.allSettled() — serial 18 s → parallel ~6–8 s.
 *
 * @param {Buffer[]} frameBuffers
 * @param {string}   groqApiKey
 * @returns {object} Detection result with frameVotes + signals
 */
export async function analyzeVideoFrames(frameBuffers, groqApiKey) {
  // ── Pass 1: General AI detection, evenly sampled, all concurrent ──────────
  const p1Count = Math.min(4, frameBuffers.length);
  const p1Indices = evenlySpacedIndices(frameBuffers.length, p1Count);
  const p1Frames = p1Indices.map((i) => ({ frame: frameBuffers[i], index: i }));

  console.log(`[Video] Pass 1: ${p1Frames.length} frames (concurrent)...`);

  const p1Settled = await Promise.allSettled(
    p1Frames.map(({ frame, index }) =>
      runFrameAnalysis(frame, GENERAL_AI_DETECTION_PROMPT, groqApiKey, `P1-F${index + 1}`)
    )
  );

  const pass1Results = p1Settled
    .map((s, i) => ({
      frame: p1Frames[i].frame,
      result: s.status === 'fulfilled' ? s.value : null,
      index: p1Frames[i].index,
    }))
    .filter((r) => r.result !== null);

  if (pass1Results.length === 0) {
    return {
      isPhishing: false,
      confidence: 50,
      explanation: 'Frame analysis inconclusive — no frames could be processed by vision models',
      frameVotes: {
        pass1: { deepfake: 0, clean: 0, total: 0 },
        pass2: { deepfake: 0, clean: 0, total: 0 },
      },
      signals: { framesExtracted: frameBuffers.length, framesAnalyzed: 0, metadataOnly: false },
    };
  }

  const p1Flagged = pass1Results.filter((r) => r.result.isPhishing);
  const p1Total = pass1Results.length;
  const p1FlaggedCount = p1Flagged.length;

  // ── Pass 2: Second opinion on up to 2 candidates, concurrent ─────────────
  const pass2Candidates = p1FlaggedCount > 0
    ? p1Flagged.slice(0, 2)
    : pass1Results.slice(0, 2);

  console.log(`[Video] Pass 2: ${pass2Candidates.length} frames (concurrent)...`);

  const p2Settled = await Promise.allSettled(
    pass2Candidates.map(({ frame, index }) =>
      runFrameAnalysis(frame, SECOND_OPINION_PROMPT, groqApiKey, `P2-F${index + 1}`)
    )
  );

  const pass2Results = p2Settled
    .map((s) => (s.status === 'fulfilled' ? s.value : null))
    .filter(Boolean);

  // ── Verdict aggregation ───────────────────────────────────────────────────
  const p2FlaggedCount = pass2Results.filter((r) => r.isPhishing).length;
  const isTemporallyInconsistent = p1FlaggedCount > 0 && p1FlaggedCount < p1Total;

  const allConfidences = [
    ...pass1Results.map((r) => r.result.confidence || 70),
    ...pass2Results.map((r) => r.confidence || 70),
  ];
  const avgConfidence = Math.round(
    allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
  );

  let isDeepfake = false;
  let finalConfidence = avgConfidence;
  let verdictReason = '';

  if (p1FlaggedCount > 0 && p2FlaggedCount > 0) {
    isDeepfake = true;
    finalConfidence = Math.min(avgConfidence + 10, 95);
    verdictReason = 'Both analysis passes confirmed AI-generated content. ';
  } else if (p1FlaggedCount > 0) {
    const maxConf = Math.max(...p1Flagged.map((r) => r.result.confidence || 70));
    isDeepfake = maxConf >= 65;
    finalConfidence = avgConfidence;
    verdictReason = isDeepfake
      ? `AI-generation detected in Pass 1 (max confidence ${maxConf}%). `
      : `Weak AI-generation signal in Pass 1 (max confidence ${maxConf}%). `;
  } else if (p2FlaggedCount > 0) {
    isDeepfake = true;
    finalConfidence = Math.min(avgConfidence + 5, 90);
    verdictReason = 'Second-pass analysis detected AI-generation artifacts. ';
  } else {
    verdictReason = 'Both passes found no AI-generation artifacts. ';
  }

  if (isTemporallyInconsistent) {
    verdictReason += '⚠️ Temporal inconsistency across frames detected. ';
    if (!isDeepfake) {
      isDeepfake = true;
      finalConfidence = Math.max(finalConfidence, 67);
    } else {
      finalConfidence = Math.min(finalConfidence + 8, 95);
    }
  }

  const artifactDetails = [
    ...pass1Results
      .filter((r) => r.result.isPhishing)
      .map((r) => `[Frame ${r.index + 1}]: ${r.result.explanation}`),
    ...pass2Results
      .filter((r) => r.isPhishing)
      .map((r, i) => `[Pass 2, Frame ${pass2Candidates[i]?.index + 1}]: ${r.explanation}`),
  ].join(' | ');

  const cleanDetail =
    !isDeepfake && pass1Results[0]?.result?.explanation
      ? pass1Results[0].result.explanation
      : '';

  return {
    isPhishing: isDeepfake,
    confidence: finalConfidence,
    explanation: verdictReason + (artifactDetails || cleanDetail),
    frameVotes: {
      pass1: { deepfake: p1FlaggedCount, clean: p1Total - p1FlaggedCount, total: p1Total },
      pass2: {
        deepfake: p2FlaggedCount,
        clean: pass2Results.length - p2FlaggedCount,
        total: pass2Results.length,
      },
    },
    // Signals breakdown — mirrors image response shape for consistent frontend display
    signals: {
      framesExtracted: frameBuffers.length,
      framesAnalyzed: p1Total,
      temporallyInconsistent: isTemporallyInconsistent,
      modelsUsed: [
        ...new Set([
          ...pass1Results.map((r) => r.result?._model).filter(Boolean),
          ...pass2Results.map((r) => r._model).filter(Boolean),
        ]),
      ],
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata Fallback
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fallback when frame extraction fails — metadata heuristics + LLM text analysis.
 * Returns the same response shape as analyzeVideoFrames for a consistent API.
 *
 * @param {Buffer} buffer
 * @param {string} originalname
 * @param {string} groqApiKey
 * @returns {object}
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
    'pika labs', 'sora', 'kling', 'hailuo', 'reface', 'avatarify', 'deepfakes',
  ];
  const lowerStrings = strings.toLowerCase();
  const foundSig = AI_SIGNATURES.find((sig) => lowerStrings.includes(sig));

  if (foundSig) {
    return {
      isPhishing: true,
      confidence: 92,
      explanation: `[Metadata] Explicit AI tool signature found in file: "${foundSig}"`,
      frameVotes: { pass1: { deepfake: 0, clean: 0, total: 0 }, pass2: { deepfake: 0, clean: 0, total: 0 } },
      signals: { framesExtracted: 0, framesAnalyzed: 0, metadataOnly: true },
    };
  }

  const groqRes = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a video forensics analyst. Examine these metadata strings extracted from a video file. Common encoders (FFmpeg, Lavf, WhatsApp, iOS, Android camera apps) are normal and should NOT be flagged. Only flag if you find explicit AI/GAN/deepfake tool signatures. Respond ONLY in valid JSON: {"isPhishing": true/false, "confidence": 50-85, "explanation": "<findings>"}',
        },
        { role: 'user', content: `Filename: ${originalname}\nMetadata strings: ${strings.substring(0, 2500)}` },
      ],
    },
    { headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' } }
  );

  const content = groqRes.data.choices[0].message.content;
  const match = content.match(/\{[\s\S]*\}/);
  const result = match
    ? JSON.parse(match[0])
    : JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim());

  result.explanation = '[⚠️ Frame extraction unavailable — metadata analysis only] ' + result.explanation;
  result.confidence = Math.min(result.confidence || 60, 78); // cap: metadata-only verdict is inherently uncertain
  result.frameVotes = { pass1: { deepfake: 0, clean: 0, total: 0 }, pass2: { deepfake: 0, clean: 0, total: 0 } };
  result.signals = { framesExtracted: 0, framesAnalyzed: 0, metadataOnly: true };
  return result;
}
