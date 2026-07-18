/**
 * Dynamic API Configuration
 * Automatically detects environment (local or Codespaces) and sets the correct backend URL
 */

/**
 * Determine if running in GitHub Codespaces
 */
const isCodespaces = (): boolean => {
  return !!(
    typeof process !== 'undefined' &&
    process.env.CODESPACE_NAME
  ) || !!(
    typeof window !== 'undefined' &&
    window.location.hostname.includes('.app.github.dev')
  );
};

/**
 * Get the current environment
 */
const getEnvironment = (): 'local' | 'codespaces' => {
  if (isCodespaces()) {
    return 'codespaces';
  }
  return 'local';
};

/**
 * Build the backend API URL
 */
const buildApiUrl = (): string => {
  const env = getEnvironment();

  if (env === 'codespaces') {
    // Extract codespace name from the current URL
    const hostname = window.location.hostname;
    const match = hostname.match(/^(.+?)-\d+\.app\.github\.dev$/);
    
    if (match) {
      const codespaceName = match[1];
      const apiPort = import.meta.env.VITE_API_PORT || '5000';
      return `https://${codespaceName}-${apiPort}.app.github.dev`;
    }

    // Fallback: use the current hostname but replace the port
    const apiPort = import.meta.env.VITE_API_PORT || '5000';
    const baseHostname = hostname.replace(/-\d+\.app\.github\.dev/, '');
    return `https://${baseHostname}-${apiPort}.app.github.dev`;
  }

  // Local development
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    return apiUrl;
  }

  const apiPort = import.meta.env.VITE_API_PORT || '5000';
  return `http://localhost:${apiPort}`;
};

/**
 * Get the API base URL
 */
export const getApiBaseUrl = (): string => {
  return buildApiUrl();
};

/**
 * API configuration object
 */
export const apiConfig = {
  baseUrl: buildApiUrl(),
  environment: getEnvironment(),
  isCodespaces: isCodespaces(),
  timeout: 30000,
};

/**
 * Axios config or fetch headers helper
 */
export const getApiHeaders = (includeAuth = true) => {
  return {
    'Content-Type': 'application/json',
    ...(includeAuth && {
      'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
    }),
  };
};

// Log API configuration in development
if (import.meta.env.DEV) {
  console.log('📡 API Configuration:', {
    environment: apiConfig.environment,
    baseUrl: apiConfig.baseUrl,
    isCodespaces: apiConfig.isCodespaces,
  });
}
