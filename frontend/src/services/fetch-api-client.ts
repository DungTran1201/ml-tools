/**
 * Fetch-based API client for environments without Axios
 * Use this if you prefer fetch over Axios
 */

import { getApiBaseUrl, getApiHeaders } from '../config/api';

interface FetchOptions extends RequestInit {
  data?: any;
  params?: Record<string, any>;
}

class FetchApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getApiBaseUrl();
  }

  /**
   * Execute fetch request
   */
  private async request<T = any>(
    endpoint: string,
    options: FetchOptions = {}
  ): Promise<T> {
    const { data, params, ...fetchOptions } = options;

    // Build URL with query parameters
    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const query = new URLSearchParams(params).toString();
      url += `?${query}`;
    }

    // Add headers
    const headers = getApiHeaders(true);

    const config: RequestInit = {
      ...fetchOptions,
      headers: {
        ...headers,
        ...fetchOptions.headers,
      },
      credentials: 'include', // Include cookies
    };

    // Add body for POST, PUT, PATCH
    if (data) {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('authToken');
          window.location.href = '/login';
        }
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      // Handle empty responses
      const text = await response.text();
      return text ? JSON.parse(text) : ({} as T);
    } catch (error) {
      console.error('Fetch API Error:', error);
      throw error;
    }
  }

  /**
   * GET request
   */
  public get<T = any>(endpoint: string, options?: FetchOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  public post<T = any>(
    endpoint: string,
    data?: any,
    options?: FetchOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      data,
    });
  }

  /**
   * PUT request
   */
  public put<T = any>(
    endpoint: string,
    data?: any,
    options?: FetchOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      data,
    });
  }

  /**
   * PATCH request
   */
  public patch<T = any>(
    endpoint: string,
    data?: any,
    options?: FetchOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      data,
    });
  }

  /**
   * DELETE request
   */
  public delete<T = any>(endpoint: string, options?: FetchOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// Export singleton instance
export const fetchApiClient = new FetchApiClient();
