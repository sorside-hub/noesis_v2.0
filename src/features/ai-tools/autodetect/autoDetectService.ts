import { CategoryId } from '../../vault/pages/VaultPage';

export interface AutoDetectRequest {
  content: string;
  title?: string;
  customGroqApiKey?: string;
  model?: string;
}

export interface AutoDetectResult {
  title: string;
  category: CategoryId;
  type?: string;
  tags: string[];
  summary?: string;
  confidence?: number;
}

export async function autoDetectMetadata(params: AutoDetectRequest): Promise<AutoDetectResult> {
  try {
    const response = await fetch('/api/auto-detect', {
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
      return getFallbackResult(params);
    }

    let category: CategoryId = 'self';
    const rawCategory = String(data.category || '').toLowerCase().trim();
    if (rawCategory === 'world' || rawCategory === 'self' || rawCategory === 'ideas') {
      category = rawCategory as CategoryId;
    } else if (rawCategory === 'learn') {
      category = 'world';
    } else if (rawCategory === 'reflect') {
      category = 'self';
    } else if (rawCategory === 'create') {
      category = 'ideas';
    }

    const type = data.type && typeof data.type === 'string' && data.type.trim()
      ? data.type.trim().toLowerCase()
      : 'unknown';

    const title = data.title && typeof data.title === 'string' && data.title.trim()
      ? data.title.trim()
      : getFallbackTitle(params.content, params.title);

    return {
      title,
      category,
      type,
      tags: Array.isArray(data.tags) ? data.tags : [],
      summary: typeof data.summary === 'string' ? data.summary : '',
      confidence: typeof data.confidence === 'number' ? data.confidence : 0,
    };
  } catch (err: any) {
    if (err?.message?.includes('Groq API Key belum dikonfigurasi')) {
      throw err;
    }
    return getFallbackResult(params);
  }
}

function getFallbackTitle(content: string, existingTitle?: string): string {
  if (existingTitle && existingTitle.trim()) {
    return existingTitle.trim();
  }
  const firstLine = content.trim().split('\n')[0].replace(/^[#*-\s]+/, '').trim();
  if (firstLine) {
    const words = firstLine.split(/\s+/).slice(0, 7).join(' ');
    return words || 'Catatan Baru';
  }
  return 'Catatan Baru';
}

function getFallbackResult(params: AutoDetectRequest): AutoDetectResult {
  return {
    title: getFallbackTitle(params.content, params.title),
    category: 'self',
    type: 'unknown',
    tags: [],
    summary: '',
    confidence: 0,
  };
}

