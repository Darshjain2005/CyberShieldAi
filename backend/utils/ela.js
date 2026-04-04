import sharp from 'sharp';

/**
 * Error Level Analysis (ELA)
 * Re-compresses the image at a known quality and measures pixel-level differences.
 * Real camera photos → uniform low noise (~2–8)
 * AI-generated / edited images → spiky high noise (~12–25+)
 */
export async function computeELAScore(buffer) {
  try {
    // Resave at quality 75 to introduce uniform compression artifacts
    const recompressed = await sharp(buffer)
      .jpeg({ quality: 75 })
      .toBuffer();

    // Get raw pixel data for both versions
    const { data: original } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
    const { data: recomp } = await sharp(recompressed).raw().toBuffer({ resolveWithObject: true });

    // Mean absolute pixel difference
    let totalDiff = 0;
    const len = Math.min(original.length, recomp.length);
    for (let i = 0; i < len; i++) {
      totalDiff += Math.abs(original[i] - recomp[i]);
    }
    const meanDiff = totalDiff / len;
    const score = Math.round(meanDiff * 10) / 10;

    return {
      elaScore: score,
      suspiciousELA: meanDiff > 12,
      elaFlag: meanDiff > 12
        ? `High ELA score (${score}) — indicates editing or synthetic generation`
        : null
    };
  } catch (e) {
    console.warn('[ELA] Computation failed:', e.message);
    return { elaScore: 0, suspiciousELA: false, elaFlag: null };
  }
}
