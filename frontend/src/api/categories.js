import request from './http';

export async function getCategories() {
  return request('/categories', {
    method: 'GET',
    cache: 'no-store',
  });
}

export async function createCategory(payload) {
  return request('/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCategory(id, payload) {
  return request(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteCategory(id) {
  return request(`/categories/${id}`, {
    method: 'DELETE',
  });
}