import request from './http';

export async function loginUser(payload) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function refreshToken(refresh_token) {
  return request('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token }),
  });
}

export async function getCurrentUser() {
  return request('/auth/me', {
    method: 'GET',
  });
}