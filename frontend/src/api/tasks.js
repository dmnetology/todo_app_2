import request from './http';

export async function getTasks(params = {}) {
  const query = new URLSearchParams();

  const allowedParams = [
  'skip',
  'limit',
  'status',
  'category_id',
  'title',
  'date_preset',
  'planned_start_from',
  'planned_start_to',
  'planned_start_timezone',
  'sort_by',
  'sort_order',
];

  allowedParams.forEach((key) => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      query.set(key, params[key]);
    }
  });

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