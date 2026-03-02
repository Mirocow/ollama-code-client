/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseWebSearchProvider } from '../base-provider.js';
import type {
  WebSearchResult,
  WebSearchResultItem,
  TavilyProviderConfig,
} from '../types.js';
import { createHttpClient } from '../../../../utils/httpClient.js';

interface TavilyResultItem {
  title: string;
  url: string;
  content?: string;
  score?: number;
  published_date?: string;
}

interface TavilySearchResponse {
  query: string;
  answer?: string;
  results: TavilyResultItem[];
}

/**
 * Web search provider using Tavily API.
 */
export class TavilyProvider extends BaseWebSearchProvider {
  readonly name = 'Tavily';

  private readonly httpClient = createHttpClient({
    timeout: 30000,
    debug: process.env['DEBUG'] === '1' || process.env['DEBUG'] === 'true',
  });

  constructor(private readonly config: TavilyProviderConfig) {
    super();
  }

  isAvailable(): boolean {
    return !!this.config.apiKey;
  }

  protected async performSearch(
    query: string,
    signal: AbortSignal,
  ): Promise<WebSearchResult> {
    const response = await this.httpClient.post<TavilySearchResponse>(
      'https://api.tavily.com/search',
      {
        api_key: this.config.apiKey,
        query,
        search_depth: this.config.searchDepth || 'advanced',
        max_results: this.config.maxResults || 5,
        include_answer: this.config.includeAnswer !== false,
      },
      {
        signal,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    const data = response.data;

    const results: WebSearchResultItem[] = (data.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
      publishedDate: r.published_date,
    }));

    return {
      query,
      answer: data.answer?.trim(),
      results,
    };
  }
}
