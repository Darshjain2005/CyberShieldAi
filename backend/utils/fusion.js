/**
 * Multi-signal fusion for deepfake detection.
 *
 * Weights:
 *   ELA Score    → 30%  (deterministic pixel forensics)
 *   EXIF Score   → 30%  (deterministic metadata forensics)
 *   LLM Result   → 40%  (visual artifact reasoning)
 *
 * If LLM is unavailable, weight is redistributed to heuristics.
 * This ensures LLM hallucinations never fully control the final verdict.
 */
export function fuseImageSignals({ elaResult, exifResult, llmResult }) {
  // ELA component (0–30)
  const elaComponent = elaResult?.suspiciousELA
    ? Math.min(30, (elaResult.elaScore / 25) * 30)
    : 0;

  // EXIF component (0–30)
  const exifComponent = ((exifResult?.exifScore || 0) / 100) * 30;

  // Build explanation lines from all signals
  const explanationParts = [];
  if (elaResult?.elaFlag) explanationParts.push(elaResult.elaFlag);
  else if (elaResult?.elaScore !== undefined) explanationParts.push(`ELA score ${elaResult.elaScore} — within normal range`);
  if (exifResult?.exifFlags?.length) explanationParts.push(...exifResult.exifFlags);

  // If no LLM result, redistribute weights to heuristics
  if (!llmResult) {
    const heuristicTotal = elaComponent + exifComponent;
    // Scale 0–60 range → 0–100 for final scoring without LLM
    const scaledScore = (heuristicTotal / 60) * 100;
    const isDeepfake = scaledScore > 45;

    explanationParts.push('Vision model unavailable — verdict based on metadata heuristics only');

    return {
      isPhishing: isDeepfake,
      confidence: Math.min(Math.round(45 + scaledScore * 0.45), 88),
      explanation: explanationParts.filter(Boolean).join(' | '),
      signals: { ela: elaResult, exif: exifResult, llm: null }
    };
  }

  // LLM component (0–40)
  // If LLM says deepfake → scale its confidence up; if safe → invert and scale down
  const llmRaw = llmResult.isPhishing
    ? Math.min(llmResult.confidence || 70, 90)
    : Math.max(100 - (llmResult.confidence || 50), 10);
  const llmComponent = (llmRaw / 100) * 40;

  if (llmResult.explanation) explanationParts.push(`Vision AI: ${llmResult.explanation}`);

  const fusedScore = elaComponent + exifComponent + llmComponent;
  // fusedScore is 0–100; re-map to confidence range 45–97
  const confidence = Math.min(Math.round(45 + fusedScore * 0.52), 97);
  const isDeepfake = fusedScore > 40;

  return {
    isPhishing: isDeepfake,
    confidence,
    explanation: explanationParts.filter(Boolean).join(' | '),
    signals: {
      ela: elaResult,
      exif: exifResult,
      llm: llmResult,
      fusedScore: Math.round(fusedScore)
    }
  };
}
