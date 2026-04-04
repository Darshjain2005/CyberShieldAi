import sharp from 'sharp';

/**
 * Error Level Analysis (ELA)
 *
 * Re-compresses the image at a fixed quality and measures pixel-level differences.
 * High delta → regions were edited or synthetically generated (they hold detail
 * that a compression artifact would have smoothed out in an authentic photo).
 *
 * Fix I1 — Format-aware thresholds:
 *   The old code applied the same threshold (12) to both JPEG and PNG inputs.
 *   This was wrong: when a PNG is converted to JPEG for the first time, the
 *   codec introduces quantisation losses that produce a naturally higher diff,
 *   regardless of whether the content is authentic or AI-generated.
 *
 *   Solution:
 *   1. Detect PNG by magic bytes (89 50 4E 47).
 *   2. For PNG: convert to a high-quality JPEG baseline (q=95) first, so both
 *      sides of the comparison are JPEG — the same codec family.
 *   3. Apply a higher suspicion threshold (18 vs 12) for PNG-origin content,
 *      because even after codec normalisation, the first JPEG encode adds noise.
 *
 * Thresholds (mean absolute pixel difference):
 *   Real camera JPEG  → typically  2–10   → threshold 12
 *   Real camera PNG   → typically  5–14   → threshold 18
 *   AI-generated      → typically 14–30+  (above both thresholds)
 */
export async function computeELAScore(buffer) {
  try {
    // Detect format by magic bytes (first 4 bytes of a PNG are: 89 50 4E 47)
    const isPng =
      buffer.length >= 4 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47;

    // For PNG: build a JPEG baseline at q=95 so the re-compression diff below
    // measures JPEG codec artefacts, not PNG → JPEG format-conversion noise.
    const baselineBuffer = isPng
      ? await sharp(buffer).jpeg({ quality: 95 }).toBuffer()
      : buffer;

    // Re-compress at q=75 to expose editing / generation artefacts
    const recompressed = await sharp(baselineBuffer).jpeg({ quality: 75 }).toBuffer();

    const { data: original } = await sharp(baselineBuffer).raw().toBuffer({ resolveWithObject: true });
    const { data: recomp } = await sharp(recompressed).raw().toBuffer({ resolveWithObject: true });

    let totalDiff = 0;
    const len = Math.min(original.length, recomp.length);
    for (let i = 0; i < len; i++) {
      totalDiff += Math.abs(original[i] - recomp[i]);
    }
    const meanDiff = totalDiff / len;
    const score = Math.round(meanDiff * 10) / 10;

    // Format-aware threshold: PNG images tolerate more compression noise
    const threshold = isPng ? 18 : 12;
    const suspicious = meanDiff > threshold;

    return {
      elaScore: score,
      suspiciousELA: suspicious,
      elaFlag: suspicious
        ? `High ELA score (${score}, threshold ${threshold}) — indicates editing or synthetic generation`
        : null,
      format: isPng ? 'png' : 'jpeg',
    };
  } catch (e) {
    console.warn('[ELA] Computation failed:', e.message);
    return { elaScore: 0, suspiciousELA: false, elaFlag: null, format: 'unknown' };
  }
}
