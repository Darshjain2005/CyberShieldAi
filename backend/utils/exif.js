import ExifReader from 'exifreader';

/**
 * Structured EXIF heuristic scorer.
 * Deterministically scores specific EXIF fields for deepfake/AI-generation signals.
 * Returns a suspicion score (0–100) and a list of human-readable flags.
 */
export function scoreExifData(buffer, filename) {
  let suspicionScore = 0;
  const flags = [];

  try {
    const tags = ExifReader.load(buffer);

    const hasCameraMake = 'Make' in tags;
    const hasCameraModel = 'Model' in tags;
    const hasDateTimeOriginal = 'DateTimeOriginal' in tags;
    const software = tags['Software']?.description || '';
    const imageDescription = tags['ImageDescription']?.description || '';

    // Flag 1: No camera hardware signature — real photos always have Make + Model
    if (!hasCameraMake && !hasCameraModel) {
      suspicionScore += 35;
      flags.push('No camera hardware signature — Make/Model fields absent');
    }

    // Flag 2: Explicit AI/GAN software in metadata 
    const aiSignatures = [
      'stable diffusion', 'midjourney', 'dall-e', 'adobe firefly',
      'runway', 'pika', 'sora', 'deepfacelab', 'faceswap',
      'comfyui', 'automatic1111', 'invoke ai', 'novelai', 'bing image'
    ];
    if (aiSignatures.some(sig => software.toLowerCase().includes(sig) ||
                                  imageDescription.toLowerCase().includes(sig))) {
      suspicionScore += 65;
      flags.push(`AI generation software detected in metadata: "${software || imageDescription}"`);
    }

    // Flag 3: Image editing software (edited ≠ deepfake, but raises suspicion)
    const editorSignatures = ['photoshop', 'gimp', 'affinity', 'canva', 'paint.net', 'lightroom'];
    if (editorSignatures.some(sig => software.toLowerCase().includes(sig))) {
      suspicionScore += 20;
      flags.push(`Image editing software found: "${software}"`);
    }

    // Flag 4: Camera make present but no original capture timestamp
    if (!hasDateTimeOriginal && hasCameraMake) {
      suspicionScore += 15;
      flags.push('Camera make present but original timestamp is absent — possible metadata stripping');
    }

  } catch (e) {
    // Completely missing EXIF — suspicious for images claiming to be photographs
    suspicionScore += 25;
    flags.push('No EXIF data present — metadata entirely absent or stripped');
  }

  return {
    exifScore: Math.min(suspicionScore, 100),
    exifFlags: flags,
    suspicious: suspicionScore > 40
  };
}
