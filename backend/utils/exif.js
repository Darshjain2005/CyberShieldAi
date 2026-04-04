import ExifReader from 'exifreader';

/**
 * Structured EXIF heuristic scorer.
 *
 * Deterministically scores specific EXIF fields for deepfake / AI-generation signals.
 * Returns a suspicion score (0–100) and a list of human-readable flags.
 *
 * Fix I2 — Calibrated penalties:
 *   The original code penalised missing Make/Model by +35, which over-flagged
 *   a huge class of legitimate images:
 *     - Web-downloaded photos (EXIF stripped by browsers / CDNs)
 *     - WhatsApp / Telegram re-shared photos (re-encoded, metadata stripped)
 *     - Screenshots (no camera hardware at all — but clearly not deepfakes)
 *     - Stock photos (EXIF removed by distributors)
 *
 *   Fixes:
 *   1. Reduce base Make/Model penalty from +35 → +20.
 *   2. If the file still has other EXIF fields (GPS, colour space, orientation,
 *      thumbnail, etc.) — it clearly went through a real image pipeline; reduce
 *      the penalty further to +15 (partial EXIF offset).
 *   3. Keep the explicit AI-software signature penalty at +65 (high confidence).
 */
export function scoreExifData(buffer, filename) {
  let suspicionScore = 0;
  const flags = [];

  try {
    const tags = ExifReader.load(buffer);

    const hasCameraMake = 'Make' in tags;
    const hasCameraModel = 'Model' in tags;
    const hasDateTimeOriginal = 'DateTimeOriginal' in tags;

    // "Other EXIF" = any tag present beyond the bare minimum ExifReader always includes.
    // Having GPS, colour space, orientation, thumbnail etc. means the image passed
    // through a real device or imaging pipeline — it's less suspicious.
    const hasOtherExif = Object.keys(tags).filter((k) =>
      !['Make', 'Model', 'DateTimeOriginal', 'Software', 'ImageDescription'].includes(k)
    ).length > 3;

    const software = tags['Software']?.description || '';
    const imageDescription = tags['ImageDescription']?.description || '';

    // ── Flag 1: No camera hardware signature ─────────────────────────────────
    // Real DSLR / smartphone photos always embed Make + Model.
    // Penalty is deliberately moderate (not decisive on its own) because many
    // legitimate sources strip these fields. Fix I2: was +35, now +15–20.
    if (!hasCameraMake && !hasCameraModel) {
      const penalty = hasOtherExif ? 15 : 20;
      suspicionScore += penalty;
      flags.push('No camera hardware signature — Make/Model fields absent');
    }

    // ── Flag 2: Explicit AI/GAN software in metadata ─────────────────────────
    // High-confidence signal — software strings don't lie unless deliberately forged.
    const aiSignatures = [
      'stable diffusion', 'midjourney', 'dall-e', 'adobe firefly',
      'runway', 'pika', 'sora', 'deepfacelab', 'faceswap',
      'comfyui', 'automatic1111', 'invoke ai', 'novelai', 'bing image',
    ];
    if (
      aiSignatures.some(
        (sig) =>
          software.toLowerCase().includes(sig) ||
          imageDescription.toLowerCase().includes(sig)
      )
    ) {
      suspicionScore += 65;
      flags.push(`AI generation software detected in metadata: "${software || imageDescription}"`);
    }

    // ── Flag 3: Image editing software ──────────────────────────────────────
    // Edited ≠ deepfake, but raises suspicion. Lower penalty than AI signatures.
    const editorSignatures = ['photoshop', 'gimp', 'affinity', 'canva', 'paint.net', 'lightroom'];
    if (editorSignatures.some((sig) => software.toLowerCase().includes(sig))) {
      suspicionScore += 20;
      flags.push(`Image editing software found in metadata: "${software}"`);
    }

    // ── Flag 4: Camera make present but timestamp stripped ───────────────────
    // Metadata stripping is a common post-processing step in deepfake pipelines.
    if (!hasDateTimeOriginal && hasCameraMake) {
      suspicionScore += 15;
      flags.push('Camera make present but original timestamp absent — possible metadata stripping');
    }

  } catch (_e) {
    // Completely absent EXIF — moderately suspicious, but many legitimate images
    // have no EXIF at all, so this alone should not decide the verdict.
    suspicionScore += 25;
    flags.push('No EXIF data present — metadata entirely absent or stripped');
  }

  return {
    exifScore: Math.min(suspicionScore, 100),
    exifFlags: flags,
    suspicious: suspicionScore > 40,
  };
}
