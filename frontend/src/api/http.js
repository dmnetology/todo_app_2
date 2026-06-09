const BASE_URL = 'http://localhost:8000';

async function request(path, options = {}) {
  const token = localStorage.getItem('access_token');

  const headers = {
    ...(options.headers || {}),
  };

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('favorites');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  let data = null;
  if (isJson) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      data = await response.text();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message = Array.isArray(data?.detail)
      ? data.detail
          .map((item) => item.msg || item.message || JSON.stringify(item))
          .join(', ')
      : data?.detail || data?.message || data || `HTTP ${response.status}`;

    throw new Error(String(message));
  }

  return data;
}

export default request;