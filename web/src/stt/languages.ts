// Speech languages. English (the default, loaded on start) uses the English-only (.en) Whisper.
// Ukrainian needs the multilingual one, told the language explicitly; it is only downloaded after the
// user confirms (see isModelCached). Models are overridable (VITE_STT_MODEL, VITE_STT_MODEL_UK).
export type Language = 'en' | 'uk'

const UK_MODEL_OVERRIDE = import.meta.env.VITE_STT_MODEL_UK

export const LANGUAGES: Record<
  Language,
  { label: string; model: string; whisperName: string | null; downloadSize?: string }
> = {
  en: {
    label: 'English',
    model: import.meta.env.VITE_STT_MODEL || 'onnx-community/whisper-small.en',
    whisperName: null,
  },
  uk: {
    label: 'Ukrainian',
    model: UK_MODEL_OVERRIDE || 'onnx-community/whisper-small',
    whisperName: 'ukrainian',
    // whisper-small: ~240 MB on CPU/WASM (8-bit weights), ~560 MB on WebGPU (fp32 encoder).
    downloadSize: UK_MODEL_OVERRIDE ? 'a large download (custom model)' : 'about 240 MB (CPU) to 560 MB (WebGPU)',
  },
}

export const LANGUAGE_CODES = Object.keys(LANGUAGES) as Language[]

// True when the model's weights are already in Transformers.js' browser cache (its default cache name),
// so selecting the language will not download anything. Partial downloads are never cached.
export async function isModelCached(language: Language): Promise<boolean> {
  try {
    const cache = await caches.open('transformers-cache')
    const marker = `/${LANGUAGES[language].model}/resolve/`
    return (await cache.keys()).some((request) => request.url.includes(marker) && request.url.includes('decoder_model_merged'))
  } catch {
    return false
  }
}
