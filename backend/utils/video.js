import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import os from 'os';
import path from 'path';
import axios from 'axios';

ffmpeg.setFfmpegPath(ffmpegPath);

// ─────────────────────────────────────────────────────────────────────────────
// PASS 1 — Authenticity check: "Does this look like a REAL photograph/video?"
// Asking affirmatively for REAL signals is more reliable than asking for fake ones.
// ─────────────────────────────────────────────────────────────────────────────
const AUTHENTICITY_CHECK_PROMPT = `You are a forensic media analyst. Examine this video frame and assess whether it shows a REAL, physically-captured image of a person — or whether it shows signs of being AI-generated or face-swapped.

Look for these AUTHENTICITY MARKERS that real captured media has:
- Natural, randomised skin pore texture with imperfections
- Realistic, physics-correct hair with individual strand variation
- Eyes with natural, asymmetric catch-lights and visible capillaries near the edges
- Natural micro-expression lines (wrinkles, blemishes)
- Consistent, physically-accurate specular lighting across all facial features
- Natural motion blur or film grain consistent with real camera capture

Also look for these DEEPFAKE TELLS present in AI-generated or face-swapped media:
- Skin that looks airbrushed, waxy, or overly uniform
- Face boundaries that appear softer or with a slight halo compared to the rest of the image
- Eyes that look glassy, flat, or with identical reflections
- Hair that becomes a fuzzy blob near the face boundary (common face-swap artifact)
- Jaw/neck inconsistency — face texture doesn't match neck skin
- Lighting on the face doesn't match lighting in the background or on other body parts
- Teeth that look tiled, too uniform, or overly bright
- Background warping or distortion near the face edges

IMPORTANT: Modern deepfakes are very convincing. If you see even subtle signs of the above deepfake tells — especially face boundary softness, skin airbrushing, or lighting mismatch — flag it. Do NOT require multiple obvious artifacts.

RESPOND ONLY IN THIS EXACT JSON FORMAT:
{"isPhishing": true/false, "confidence": <integer 55-95>, "explanation": "<describe exactly what you found or did not find for each category>"}`;

// ─────────────────────────────────────────────────────────────────────────────
// PASS 2 — Deep face analysis: second opinion focusing purely on face region
// ─────────────────────────────────────────────────────────────────────────────
const FACE_FORENSICS_PROMPT = `You are analyzing a video frame specifically for face-swap deepfake artifacts. Focus exclusively on the primary face in this frame.

Check for these specific face-swap signatures:
1. FACE BOUNDARY: Is there a subtle softness, halo, blending artifact, or color temperature difference at the edge where the face meets the neck/hair/background?
2. SKIN CONSISTENCY: Does the face skin texture match the neck and ears? Deepfakes often have smoother face skin than surrounding areas.
3. EYE REFLECTIONS: Do both eyes show the same identical light reflection pattern? Identical catchlights are a GAN artifact — real eyes have slight variation.
4. FACIAL GEOMETRY: Does the face look slightly "flat" or like it's a 2D texture mapped onto a 3D shape?
5. TEMPORAL ARTIFACTS: Does anything look blurred in an unnatural way — like the face was composited from a different video?
6. INNER MOUTH: If visible, do the teeth and gums look natural, or do they look like generic AI-generated teeth?

Be aggressive in detection. If the face boundary looks even slightly unusual, or if the skin looks too smooth, flag it. It is better to flag a natural photo as suspicious than to miss a deepfake.

RESPOND ONLY IN THIS EXACT JSON FORMAT:
{"isPhishing": true/false, "confidence": <integer 55-95>, "explanation": "<describe each check result in 1-2 sentences>"}`;

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
      if (probeErr) {
        console.warn('[Video] ffprobe failed:', probeErr.message, '— using default duration');
      }
      const duration = metadata?.format?.duration || 10;
      const fps = numFrames / Math.max(duration, 1);

      ffmpeg(inputPath)
        .outputOptions([
          `-vf fps=${fps.toFixed(6)}`,
          '-vframes', String(numFrames),
          '-q:v', '2'   // highest quality JPEG
        ])
        .output(framePattern)
        .on('end', () => {
          const frames = [];
          for (let i = 1; i <= numFrames; i++) {
            const framePath = path.join(tmpDir, `frame-${String(i).padStart(3, '0')}.jpg`);
            if (fs.existsSync(framePath)) {
              frames.push(fs.readFileSync(framePath));
            }
          }
          fs.rmSync(tmpDir, { recursive: true, force: true });
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
 * Runs a single LLM vision call on a frame buffer with a given prompt.
 * Returns parsed JSON result or null on failure.
 */
async function runFrameAnalysis(frameBuffer, prompt, groqApiKey, label) {
  const base64 = frameBuffer.toString('base64');
  try {
    const res = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
          ]
        }]
      },
      {
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const content = res.data.choices[0].message.content;
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      console.log(`[Video][${label}] deepfake=${parsed.isPhishing}, confidence=${parsed.confidence}`);
      return parsed;
    }
  } catch (e) {
    console.warn(`[Video][${label}] Analysis failed:`, e.response?.data?.error?.message || e.message);
  }
  return null;
}

/**
 * Analyzes video frames using a dual-pass approach:
 * Pass 1 — Authenticity check on a sample of frames
 * Pass 2 — Deep face forensics on the 2 most "suspicious" frames from pass 1
 *
 * Verdict logic:
 * - ANY frame flagged in BOTH passes → high confidence deepfake
 * - ANY frame flagged in pass 1 with confidence ≥ 70 → likely deepfake
 * - Temporal inconsistency (mixed results) → suspicious, escalate confidence
 */
export async function analyzeVideoFrames(frameBuffers, groqApiKey) {
  // ── PASS 1: Authenticity check on up to 4 evenly sampled frames ──
  const step = Math.max(1, Math.ceil(frameBuffers.length / 4));
  const pass1Frames = frameBuffers.filter((_, i) => i % step === 0).slice(0, 4);

  console.log(`[Video] Pass 1: Authenticity check on ${pass1Frames.length} frames...`);
  const pass1Results = [];
  for (let i = 0; i < pass1Frames.length; i++) {
    const result = await runFrameAnalysis(pass1Frames[i], AUTHENTICITY_CHECK_PROMPT, groqApiKey, `P1-F${i + 1}`);
    if (result) pass1Results.push({ frame: pass1Frames[i], result, index: i });
  }

  if (pass1Results.length === 0) {
    return {
      isPhishing: false,
      confidence: 50,
      explanation: 'Frame analysis inconclusive — no frames could be processed'
    };
  }

  const p1DeepfakeResults = pass1Results.filter(r => r.result.isPhishing);
  const p1TotalVotes = pass1Results.length;
  const p1DeepfakeVotes = p1DeepfakeResults.length;

  // ── PASS 2: Deep face forensics on any flagged frames (+ highest confidence clean frame) ──
  // We run pass 2 regardless — on the frames that were flagged, or the first 2 if none flagged
  const pass2Candidates = p1DeepfakeResults.length > 0
    ? p1DeepfakeResults.slice(0, 2)   // The flagged ones
    : pass1Results.slice(0, 2);        // None flagged — still double-check the first 2

  console.log(`[Video] Pass 2: Deep face forensics on ${pass2Candidates.length} frames...`);
  const pass2Results = [];
  for (const candidate of pass2Candidates) {
    const result = await runFrameAnalysis(candidate.frame, FACE_FORENSICS_PROMPT, groqApiKey, `P2-F${candidate.index + 1}`);
    if (result) pass2Results.push(result);
  }

  // ── VERDICT LOGIC ──
  const p2DeepfakeVotes = pass2Results.filter(r => r.isPhishing).length;
  const allConfidences = [
    ...pass1Results.map(r => r.result.confidence || 70),
    ...pass2Results.map(r => r.confidence || 70)
  ];
  const avgConfidence = Math.round(allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length);

  // Temporal inconsistency = some frames clean, some not → suspicious
  const isTemporallyInconsistent = p1DeepfakeVotes > 0 && p1DeepfakeVotes < p1TotalVotes;

  // Decision tree:
  let isDeepfake = false;
  let finalConfidence = avgConfidence;
  let verdict_reason = '';

  if (p1DeepfakeVotes > 0 && p2DeepfakeVotes > 0) {
    // Both passes agree on at least one frame — high confidence
    isDeepfake = true;
    finalConfidence = Math.min(avgConfidence + 10, 95);
    verdict_reason = `Both analysis passes flagged deepfake artifacts. `;
  } else if (p1DeepfakeVotes > 0) {
    // Only pass 1 flagged — check the confidence
    const maxP1Conf = Math.max(...p1DeepfakeResults.map(r => r.result.confidence || 70));
    if (maxP1Conf >= 68) {
      // High confidence flag from pass 1 alone is enough
      isDeepfake = true;
      finalConfidence = avgConfidence;
      verdict_reason = `Authenticity check flagged suspicious artifacts (confidence ${maxP1Conf}%). `;
    } else {
      // Low confidence flag — uncertain, mark suspicious but not conclusive
      isDeepfake = false;
      finalConfidence = Math.max(avgConfidence, 60);
      verdict_reason = `Authenticity check raised low-confidence concerns. `;
    }
  } else if (p2DeepfakeVotes > 0) {
    // Only the deeper face forensics caught something
    isDeepfake = true;
    finalConfidence = Math.min(avgConfidence + 5, 90);
    verdict_reason = `Deep face forensics detected subtle face-swap artifacts. `;
  } else {
    isDeepfake = false;
    verdict_reason = `Both analysis passes found no deepfake artifacts. `;
  }

  if (isTemporallyInconsistent) {
    verdict_reason += '⚠️ Temporal inconsistency detected across frames — possible localized face substitution. ';
    if (!isDeepfake) {
      // Inconsistency alone is suspicious enough to flag
      isDeepfake = true;
      finalConfidence = Math.max(finalConfidence, 67);
    } else {
      finalConfidence = Math.min(finalConfidence + 8, 95);
    }
  }

  // Collect all artifact explanations
  const artifactDetails = [
    ...pass1Results.filter(r => r.result.isPhishing).map(r => `[Frame ${r.index + 1}]: ${r.result.explanation}`),
    ...pass2Results.filter(r => r.isPhishing).map((r, i) => `[Face check ${i + 1}]: ${r.explanation}`)
  ].join(' | ');

  return {
    isPhishing: isDeepfake,
    confidence: finalConfidence,
    explanation: verdict_reason + (artifactDetails || (isDeepfake ? '' : pass1Results[0]?.result?.explanation || '')),
    frameVotes: {
      pass1: { deepfake: p1DeepfakeVotes, clean: p1TotalVotes - p1DeepfakeVotes, total: p1TotalVotes },
      pass2: { deepfake: p2DeepfakeVotes, clean: pass2Results.length - p2DeepfakeVotes, total: pass2Results.length }
    }
  };
}

/**
 * Fallback: metadata heuristics + structural checks when frame extraction is unavailable.
 * More aggressive than the old version — looks for encoding anomalies too.
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

  // Look for explicit AI pipeline strings directly in metadata before even calling the LLM
  const AI_SIGNATURES = [
    'stable-diffusion', 'stablediffusion', 'midjourney', 'deepfacelab',
    'faceswap', 'neural-render', 'diffusion-model', 'gan-generated',
    'runwayml', 'runway ml', 'pika labs', 'sora', 'kling', 'hailuo',
    'reface', 'avatarify', 'faceit', 'deepfakes', 'first-order-model'
  ];

  const lowerStrings = strings.toLowerCase();
  const foundSig = AI_SIGNATURES.find(sig => lowerStrings.includes(sig));
  if (foundSig) {
    return {
      isPhishing: true,
      confidence: 92,
      explanation: `[Metadata] Explicit AI generation signature found: "${foundSig}"`
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
          content:
            'You are a video forensics analyst. Examine these metadata strings extracted from a video file.\n' +
            'Common encoders (FFmpeg, Lavf, LibAV, WhatsApp, iOS, Android H.264) are completely normal.\n' +
            'Flag as suspicious ONLY if you find: AI/GAN renderer signatures, deepfake tool names, ' +
            'unusual synthetic framerates (e.g. exactly 25.000000 fps with no variation), ' +
            'or metadata fields that reference neural network pipelines.\n' +
            'NOTE: Frame extraction from this video failed, so this is the only available signal.\n' +
            'Respond ONLY in valid JSON: {"isPhishing": true/false, "confidence": 50-85, "explanation": "<your findings>"}'
        },
        {
          role: 'user',
          content: `Filename: ${originalname}\nMetadata: ${strings.substring(0, 2500)}`
        }
      ]
    },
    { headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' } }
  );

  const content = groqRes.data.choices[0].message.content;
  const match = content.match(/\{[\s\S]*\}/);
  const result = match
    ? JSON.parse(match[0])
    : JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim());

  result.explanation = '[⚠️ Frame extraction unavailable — metadata analysis only] ' + result.explanation;
  // Cap confidence for metadata-only results — it's a weaker signal
  result.confidence = Math.min(result.confidence || 60, 78);
  return result;
}
