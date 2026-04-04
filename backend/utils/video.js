import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import os from 'os';
import path from 'path';
import axios from 'axios';

ffmpeg.setFfmpegPath(ffmpegPath);

// Focused, scoped prompt — only checks things a vision model can actually detect
const DEEPFAKE_FRAME_PROMPT = `You are a forensic image analyst. Examine this image ONLY for these specific visual artifacts that indicate AI generation or deepfake manipulation:

1. EYES: Inconsistent specular highlights, unnatural iris patterns, or asymmetric pupils?
2. TEETH: Unnaturally uniform, overly smooth, or tiled appearance?
3. HAIR: Blurs into a uniform texture at edges instead of showing individual strands?
4. SKIN: Repetitive texture tiles, unnaturally smooth regions, or sharp boundaries near face edges?
5. BACKGROUND: Unrealistic blur gradient, objects merging unnaturally into faces?
6. TEXT/LOGOS: Any visible text garbled, distorted, or illegible?
7. HANDS/FINGERS: Incorrect finger count, merged fingers, or anatomically wrong joints?

BE CONSERVATIVE. Only mark as deepfake if you observe clear, specific artifacts above.
A natural-looking frame with no visible artifacts must be marked safe.

RESPOND ONLY IN THIS EXACT JSON FORMAT (no markdown, no extra text):
{"isPhishing": true/false, "confidence": <integer 50-95>, "explanation": "<list the exact artifacts found, or state why none were found>"}`;

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
    // Probe duration so we can spread frames evenly across the video
    ffmpeg.ffprobe(inputPath, (probeErr, metadata) => {
      const duration = metadata?.format?.duration || 10;
      // Set fps so we get exactly numFrames across the full duration
      const fps = numFrames / Math.max(duration, 1);

      ffmpeg(inputPath)
        .outputOptions([
          `-vf fps=${fps.toFixed(6)}`,
          '-vframes', String(numFrames),
          '-q:v', '3'           // High-quality JPEG output
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
          console.log(`[Video] Extracted ${frames.length} frames from ${duration.toFixed(1)}s video`);
          resolve(frames);
        })
        .on('error', (err) => {
          fs.rmSync(tmpDir, { recursive: true, force: true });
          reject(err);
        })
        .run();
    });
  });
}

/**
 * Analyzes an array of JPEG frame Buffers using the vision LLM.
 * Uses majority voting + temporal inconsistency detection.
 */
export async function analyzeVideoFrames(frameBuffers, groqApiKey) {
  const frameResults = [];

  // Sample at most 4 frames evenly to conserve API quota
  const step = Math.max(1, Math.ceil(frameBuffers.length / 4));
  const sampled = frameBuffers.filter((_, i) => i % step === 0).slice(0, 4);

  console.log(`[Video] Sending ${sampled.length} sampled frames to vision LLM...`);

  for (const frameBuffer of sampled) {
    const base64 = frameBuffer.toString('base64');
    try {
      const res = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: DEEPFAKE_FRAME_PROMPT },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
            ]
          }]
        },
        {
          headers: {
            'Authorization': `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 25000
        }
      );

      const content = res.data.choices[0].message.content;
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        frameResults.push(parsed);
        console.log(`[Video] Frame result: deepfake=${parsed.isPhishing}, confidence=${parsed.confidence}`);
      }
    } catch (e) {
      console.warn('[Video] Frame analysis failed:', e.message);
    }
  }

  if (frameResults.length === 0) {
    return {
      isPhishing: false,
      confidence: 50,
      explanation: 'Frame visual analysis inconclusive — no frames could be processed by vision model'
    };
  }

  // Majority vote
  const deepfakeVotes = frameResults.filter(r => r.isPhishing).length;
  const totalVotes = frameResults.length;
  const isDeepfake = deepfakeVotes > totalVotes / 2;
  const avgConfidence = Math.round(
    frameResults.reduce((sum, r) => sum + (r.confidence || 70), 0) / totalVotes
  );

  // Temporal inconsistency: mixed votes across frames = suspicious (possible patchy face swap)
  const isInconsistent = deepfakeVotes > 0 && deepfakeVotes < totalVotes;

  const deepfakeExplanations = frameResults
    .filter(r => r.isPhishing && r.explanation)
    .map(r => r.explanation)
    .join('; ');

  return {
    isPhishing: isDeepfake,
    confidence: isInconsistent
      ? Math.min(avgConfidence + 15, 95)
      : avgConfidence,
    explanation:
      `Analyzed ${totalVotes} video frames: ${deepfakeVotes}/${totalVotes} flagged as deepfake.` +
      (isInconsistent ? ' ⚠️ Temporal inconsistency detected — possible localized face substitution.' : '') +
      (deepfakeExplanations ? ` Artifacts: ${deepfakeExplanations}` : ''),
    frameVotes: {
      deepfake: deepfakeVotes,
      clean: totalVotes - deepfakeVotes,
      total: totalVotes
    }
  };
}

/**
 * Fallback: metadata-only analysis when frame extraction is unavailable.
 * Conservative prompt — only flags explicit AI pipeline strings.
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

  const groqRes = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a video forensics analyst. Analyze metadata strings for EXPLICIT AI-generation signatures ONLY. ' +
            'Common real-world encoders (FFmpeg, Lavf, LibAV, WhatsApp, iOS, Android) are completely normal — do NOT flag them. ' +
            'Only flag if you see strings like "stable-diffusion", "GAN", "deepfacelab", "neural-render", "diffusion-model", or similar explicit AI pipeline identifiers inside the metadata. ' +
            'Respond ONLY in valid JSON: {"isPhishing": true/false, "confidence": 50-99, "explanation": "<your findings>"}'
        },
        {
          role: 'user',
          content: `Filename: ${originalname}\nMetadata sample: ${strings.substring(0, 2500)}`
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

  result.explanation = '[Metadata fallback — frame extraction unavailable] ' + result.explanation;
  return result;
}
