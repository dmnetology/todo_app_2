import request from './http';

export async function getTasks(params = {}) {
  const query = new URLSearchParams();

  if (params.skip !== undefined) query.set('skip', params.skip);
  if (params.limit !== undefined) query.set('limit', params.limit);

  const qs = query.toString();
  const url = qs ? `/tasks?${qs}` : '/tasks';

  return request(url, {
    method: 'GET',
    cache: 'no-store',
  });
}

export async function getTaskById(id) {
  return request(`/tasks/${id}`, {
    method: 'GET',
    cache: 'no-store',
  });
}

export async function createTask(payload) {
  return request('/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTask(id, payload) {
  return request(`/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteTask(id) {
  return request(`/tasks/${id}`, {
    method: 'DELETE',
  });
}