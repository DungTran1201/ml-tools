/**
 * Axios-based API client with dynamic URL configuration
 * Works seamlessly in both local and Codespaces environments
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { getApiBaseUrl, getApiHeaders } from './api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    const baseURL = getApiBaseUrl();

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: getApiHeaders(false),
      withCredentials: true, // Allow cookies in cross-origin requests
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error);
        
        // Handle authentication errors
        if (error.response?.status === 401) {
          localStorage.removeItem('authToken');
          window.location.href = '/login';
        }

        return Promise.reject(error);
      }
    );

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  /**
   * GET request
   */
  public get<T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.client.get(url, config).then(res => res.data);
  }

  /**
   * POST request
   */
  public post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.client.post(url, data, config).then(res => res.data);
  }

  /**
   * PUT request
   */
  public put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.client.put(url, data, config).then(res => res.data);
  }

  /**
   * PATCH request
   */
  public patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.client.patch(url, data, config).then(res => res.data);
  }

  /**
   * DELETE request
   */
  public delete<T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.client.delete(url, config).then(res => res.data);
  }

  /**
   * Get the raw Axios instance for advanced use cases
   */
  public getInstance(): AxiosInstance {
    return this.client;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export types for convenience
export type { AxiosRequestConfig };
