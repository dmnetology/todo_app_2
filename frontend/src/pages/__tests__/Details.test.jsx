import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Details from '../Details';
import { useTasks } from '../../context/TaskContext';

jest.mock('../../context/TaskContext', () => ({
  useTasks: jest.fn(),
}));

const mockTask = {
  id: 1,
  title: 'Детальная тестовая задача',
  description: 'Подробное описание тестовой задачи',
  is_completed: false,
  priority: 'High',
  due_date: '2026-06-10T10:00:00Z',
  created_at: '2026-06-01T09:00:00Z',
  completed_at: null,
  estimated_minutes: 120,
  actual_minutes: null,
  category_id: 1,
  category: { id: 1, name: 'Программирование' },
};

const mockCategories = [{ id: 1, name: 'Программирование' }];

global.fetch = jest.fn();

describe('Details Component', () => {
  const addTaskToFavorites = jest.fn();
  const removeTaskFromFavorites = jest.fn();
  const isFavoriteMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('access_token', 'fake-jwt-token');

    isFavoriteMock.mockReturnValue(false);

    useTasks.mockReturnValue({
      addTaskToFavorites,
      removeTaskFromFavorites,
      isFavorite: isFavoriteMock,
    });

    fetch.mockImplementation((url) => {
      if (url.includes('/categories')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCategories),
        });
      }

      if (url.includes('/tasks/1')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTask),
        });
      }

      return Promise.reject(new Error(`unmocked fetch call: ${url}`));
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('отображает сообщение о загрузке', () => {
    fetch.mockImplementationOnce(() => new Promise(() => {}));
    fetch.mockImplementationOnce(() => new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={['/list/1']}>
        <Routes>
          <Route path="/list/:id" element={<Details />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Загрузка информации о задаче...')).toBeInTheDocument();
  });

  test('отображает сообщение об ошибке при неудачной загрузке задачи', async () => {
    fetch.mockImplementation((url) => {
      if (url.includes('/categories')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCategories),
        });
      }

      if (url.includes('/tasks/1')) {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ detail: 'Task not found' }),
        });
      }

      return Promise.reject(new Error(`unmocked fetch call: ${url}`));
    });

    render(
      <MemoryRouter initialEntries={['/list/1']}>
        <Routes>
          <Route path="/list/:id" element={<Details />} />
        </Routes>
      </MemoryRouter>
    );

    expect(
      await screen.findByText(/Ошибка при загрузке задачи/i)
    ).toBeInTheDocument();
  });

  test('отображает детали задачи', async () => {
    render(
      <MemoryRouter initialEntries={['/list/1']}>
        <Routes>
          <Route path="/list/:id" element={<Details />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Детальная тестовая задача');

    const paragraphs = screen.getAllByText((_, element) => element.tagName.toLowerCase() === 'p');

    expect(
      paragraphs.find((p) => p.textContent.includes('ID:'))
    ).toHaveTextContent('ID: 1');

    expect(paragraphs.find((p) => p.textContent.includes('Название:'))).toHaveTextContent(
      'Название: Детальная тестовая задача'
    );
    expect(paragraphs.find((p) => p.textContent.includes('Описание:'))).toHaveTextContent(
      'Описание: Подробное описание тестовой задачи'
    );
    expect(paragraphs.find((p) => p.textContent.includes('Статус:'))).toHaveTextContent(
      'Статус: Не выполнена'
    );
    expect(paragraphs.find((p) => p.textContent.includes('Приоритет:'))).toHaveTextContent(
      'Приоритет: High'
    );
    expect(paragraphs.find((p) => p.textContent.includes('Срок выполнения:'))).toHaveTextContent(
      'Срок выполнения: 10.06.2026, 13:00:00'
    );
    expect(paragraphs.find((p) => p.textContent.includes('Создана:'))).toHaveTextContent(
      'Создана: 01.06.2026, 12:00:00'
    );
    expect(paragraphs.find((p) => p.textContent.includes('Выполнена:'))).toHaveTextContent(
      'Выполнена: —'
    );
    expect(paragraphs.find((p) => p.textContent.includes('Ожидаемое время:'))).toHaveTextContent(
      'Ожидаемое время: 120 мин.'
    );
    expect(paragraphs.find((p) => p.textContent.includes('Фактическое время:'))).toHaveTextContent(
      'Фактическое время: —'
    );
    expect(paragraphs.find((p) => p.textContent.includes('Категория:'))).toHaveTextContent(
      'Категория: Программирование'
    );

    expect(screen.getByRole('button', { name: 'Добавить в избранное' })).toBeInTheDocument();
  });

  test('добавляет задачу в избранное при клике', async () => {
    const user = userEvent.setup();

    isFavoriteMock.mockReturnValue(false);

    render(
      <MemoryRouter initialEntries={['/list/1']}>
        <Routes>
          <Route path="/list/:id" element={<Details />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Детальная тестовая задача');

    const favoriteButton = screen.getByRole('button', { name: 'Добавить в избранное' });
    await user.click(favoriteButton);

    expect(addTaskToFavorites).toHaveBeenCalledTimes(1);
    expect(addTaskToFavorites).toHaveBeenCalledWith(mockTask.id);
    expect(removeTaskFromFavorites).not.toHaveBeenCalled();
  });

  test('удаляет задачу из избранного при клике', async () => {
    const user = userEvent.setup();

    isFavoriteMock.mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={['/list/1']}>
        <Routes>
          <Route path="/list/:id" element={<Details />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Детальная тестовая задача');

    const removeFavoriteButton = screen.getByRole('button', { name: 'Удалить из избранного' });
    await user.click(removeFavoriteButton);

    expect(removeTaskFromFavorites).toHaveBeenCalledTimes(1);
    expect(removeTaskFromFavorites).toHaveBeenCalledWith(mockTask.id);
    expect(addTaskToFavorites).not.toHaveBeenCalled();
  });
});