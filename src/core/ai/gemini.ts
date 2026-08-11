import { Message, MessageModelMeta } from '../../shared/types';

/**
 * Service to communicate with Gemini API via backend proxy using streaming
 */
export async function sendMessageStream(
  message: string,
  history: Message[] = [],
  onChunk?: (chunk: string) => void,
  onMeta?: (meta: MessageModelMeta) => void
): Promise<string> {
  try {
    const formattedHistory = history.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      content: msg.content,
    }));

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        history: formattedHistory,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 405) {
        throw new Error(
          'Endpoint /api/chat mengembalikan status 405 (Method Not Allowed). ' +
          'Pada Cloudflare Pages, pastikan folder /functions/api/chat.ts ikut ter-deploy ' +
          'dan variabel GEMINI_API_KEY telah dikonfigurasi di Settings > Environment Variables Cloudflare Pages.'
        );
      }
      throw new Error(
        errorData.error || `Gagal mendapatkan respon (Status ${response.status})`
      );
    }

    if (!response.body) {
      throw new Error('Respon stream dari server tidak tersedia.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const dataStr = trimmed.substring(6).trim();
        if (dataStr === '[DONE]') {
          break;
        }

        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.error) {
            throw new Error(parsed.error);
          }
          if (parsed.modelMeta) {
            if (onMeta) {
              onMeta(parsed.modelMeta);
            }
          }
          if (parsed.text) {
            fullText += parsed.text;
            if (onChunk) {
              onChunk(parsed.text);
            }
          }
        } catch (e: any) {
          if (e.message && e.message !== 'Unexpected token') {
            throw e;
          }
        }
      }
    }

    if (!fullText) {
      throw new Error('Respon dari Gemini kosong.');
    }

    return fullText;
  } catch (err: any) {
    console.error('Service Gemini Error:', err);
    throw new Error(
      err?.message || 'Terjadi kesalahan koneksi saat berkomunikasi dengan Noesis AI.'
    );
  }
}

/**
 * Fallback / backward compatible non-streaming wrapper
 */
export async function sendMessage(
  message: string,
  history: Message[] = []
): Promise<string> {
  return sendMessageStream(message, history);
}
