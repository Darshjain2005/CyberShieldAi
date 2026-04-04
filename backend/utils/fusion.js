/**
 * Multi-signal fusion for deepfake image detection.
 *
 * Signal weights:
 *   ELA Score    → 30%  (deterministic pixel forensics)
 *   EXIF Score   → 30%  (deterministic metadata forensics)
 *   LLM Result   → 40%  (visual artifact reasoning via vision model)
 *
 * If the LLM is unavailable, its weight is redistributed to heuristics,
 * but the threshold is raised to prevent a single flag from triggering a
 * false-positive verdict without visual confirmation.
 *
 * Fix I3 — Calibrated thresholds:
 *   The original threshold of fusedScore > 32 was too permissive.
 *   A clean PNG with stripped EXIF could reach a fused score of ~36
 *   without any LLM input, producing a false "deepfake" verdict for
 *   legitimate web-downloaded images.
 *
 *   Changes:
 *   1. Raise main threshold: fusedScore > 32 → fusedScore > 40.
 *   2. LLM high-confidence clean override: if the vision model says safe
 *      with ≥80% confidence, require fusedScore > 52 before heuristics
 *      can override that verdict. This respects strong visual evidence.
 *   3. No-LLM fallback threshold: raise scaled threshold 45 → 55 so
 *      heuristics alone (without a vision model) need a very clear signal
 *      before flagging. Cap confidence at 82 to signal reduced certainty.
 */
export function fuseImageSignals({ elaResult, exifResult, llmResult }) {
  // ── ELA component (0–30) ─────────────────────────────────────────────────
  const elaComponent = elaResult?.suspiciousELA
    ? Math.min(30, (elaResult.elaScore / 25) * 30)
    : 0;

  // ── EXIF component (0–30) ────────────────────────────────────────────────
  const exifComponent = ((exifResult?.exifScore || 0) / 100) * 30;

  // Build human-readable explanation lines from each signal
  const explanationParts = [];
  if (elaResult?.elaFlag) {
    explanationParts.push(elaResult.elaFlag);
  } else if (elaResult?.elaScore !== undefined) {
    explanationParts.push(`ELA score ${elaResult.elaScore} — within normal range`);
  }
  if (exifResult?.exifFlags?.length) {
    explanationParts.push(...exifResult.exifFlags);
  }

  // ── No LLM available: heuristics-only fallback ───────────────────────────
  if (!llmResult) {
    const heuristicTotal = elaComponent + exifComponent; // 0–60
    const scaledScore = (heuristicTotal / 60) * 100;     // normalise to 0–100

    // Fix I3 (no-LLM path): raise threshold 45 → 55 to require both ELA *and*
    // EXIF signals to be strong before flagging without any visual confirmation.
    const isDeepfake = scaledScore > 55;

    explanationParts.push('Vision model unavailable — verdict based on metadata heuristics only');

    return {
      isPhishing: isDeepfake,
      // Cap at 82: without a vision model, confidence is inherently limited
      confidence: Math.min(Math.round(45 + scaledScore * 0.37), 82),
      explanation: explanationParts.filter(Boolean).join(' | '),
      signals: { ela: elaResult, exif: exifResult, llm: null },
    };
  }

  // ── LLM component (0–40) ─────────────────────────────────────────────────
  // If LLM says deepfake → scale its confidence up (more certain = higher component).
  // If LLM says clean    → invert confidence (100 - conf), so high certainty of clean
  //                        produces a very low component, pulling the fused score down.
  const llmRaw = llmResult.isPhishing
    ? Math.min(llmResult.confidence || 70, 90)
    : Math.max(100 - (llmResult.confidence || 50), 10);
  const llmComponent = (llmRaw / 100) * 40;

  if (llmResult.explanation) {
    explanationParts.push(`Vision AI: ${llmResult.explanation}`);
  }

  const fusedScore = elaComponent + exifComponent + llmComponent;

  // Re-map fusedScore (0–100) to confidence range (45–97)
  const confidence = Math.min(Math.round(45 + fusedScore * 0.52), 97);

  // Fix I3: Base threshold raised from 32 → 40.
  // Special case: if the LLM says clean with high confidence (≥80%), require
  // a stronger heuristic signal (fusedScore > 52) before overriding its verdict.
  // This prevents moderate ELA/EXIF noise from overruling strong visual evidence.
  const llmHighConfidenceClean = !llmResult.isPhishing && (llmResult.confidence || 0) >= 80;
  const threshold = llmHighConfidenceClean ? 52 : 40;
  const isDeepfake = fusedScore > threshold;

  return {
    isPhishing: isDeepfake,
    confidence,
    explanation: explanationParts.filter(Boolean).join(' | '),
    signals: {
      ela: elaResult,
      exif: exifResult,
      llm: llmResult,
      fusedScore: Math.round(fusedScore),
      threshold,
    },
  };
}
