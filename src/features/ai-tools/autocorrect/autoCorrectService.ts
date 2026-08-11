export interface AutoCorrectRequest {
  content: string;
  customGroqApiKey?: string;
  model?: string;
}

export interface AutoCorrectResult {
  correctedText: string;
}

export async function autoCorrectContent(params: AutoCorrectRequest): Promise<AutoCorrectResult> {
  const response = await fetch('/api/auto-correct', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  const data = await response.json();

  if (!response.ok) {
    if (data.needsApiKey) {
      throw new Error(data.error || 'Groq API Key belum dikonfigurasi.');
    }
    throw new Error(data.error || 'Gagal memproses Auto Correct dengan Groq AI.');
  }

  return {
    correctedText: data.correctedText || params.content,
  };
}
