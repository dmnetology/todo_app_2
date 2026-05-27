import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event'; // Импортируем userEvent
import { MemoryRouter } from 'react-router-dom';
import List from '../List';
import { useTasks } from '../../context/TaskContext';

jest.mock('../../context/TaskContext', () => ({
  useTasks: jest.fn(),
}));

// Моковые данные задач
const mockTasks = [
  {
    id: 1,
    title: 'Тестовая задача 1',
    description: 'Описание 1',
    is_completed: false,
    priority: 'High',
    due_date: '2026-06-01T10:00:00Z',
    created_at: '2026-05-30T10:00:00Z',
    completed_at: null,
    estimated_minutes: 60,
    actual_minutes: null,
    category_id: 1,
    category: { id: 1, name: 'Работа' },
  },
  {
    id: 2,
    title: 'Тестовая задача 2',
    description: 'Описание 2',
    is_completed: true,
    priority: 'Low',
    due_date: '2026-05-25T12:00:00Z',
    created_at: '2026-05-24T12:00:00Z',
    completed_at: '2026-05-25T11:00:00Z',
    estimated_minutes: 30,
    actual_minutes: 25,
    category_id: 2,
    category: { id: 2, name: 'Личное' },
  },
];

describe('List Component', () => {
  const addTaskToFavorites = jest.fn();
  const removeTaskFromFavorites = jest.fn();
  const isFavorite = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    isFavorite.mockImplementation((taskId) => taskId === 1); // Задача 1 в избранном по умолчанию

    useTasks.mockReturnValue({
      tasks: mockTasks,
      loading: false,
      error: null,
      addTaskToFavorites,
      removeTaskFromFavorites,
      isFavorite,
    });
  });

  test('отображает сообщение о загрузке', () => {
    useTasks.mockReturnValue({ tasks: [], loading: true, error: null });

    render(
      <MemoryRouter>
        <List />
      </MemoryRouter>
    );

    expect(screen.getByText('Загрузка задач...')).toBeInTheDocument();
  });

  test('отображает сообщение об ошибке', () => {
    useTasks.mockReturnValue({
      tasks: [],
      loading: false,
      error: 'Ошибка сети',
    });

    render(
      <MemoryRouter>
        <List />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/Ошибка при загрузке задач: Ошибка сети/i)
    ).toBeInTheDocument();
  });

  test('отображает сообщение, если задач нет', () => {
    useTasks.mockReturnValue({ tasks: [], loading: false, error: null });

    render(
      <MemoryRouter>
        <List />
      </MemoryRouter>
    );

    expect(screen.getByText('Задач не найдено.')).toBeInTheDocument();
  });

  test('корректно отображает список задач', () => {
    render(
      <MemoryRouter>
        <List />
      </MemoryRouter>
    );

    // Проверка заголовков таблицы
    expect(screen.getByRole('columnheader', { name: 'Название' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Статус' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Категория' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Выполнена' })).toBeInTheDocument(); // Проверяем заголовок

    // Проверка первой задачи
    expect(screen.getByText('Тестовая задача 1')).toBeInTheDocument();
    expect(screen.getByText('Описание 1')).toBeInTheDocument();
    expect(screen.getByText('Не выполнена')).toBeInTheDocument(); // Статус первой задачи

    // Ищем "Работа" как текст внутри конкретной ячейки таблицы
    const workCategoryCell = screen.getByRole('row', { name: /Тестовая задача 1/i }).querySelectorAll('td')[10]; // 11-я ячейка (индекс 10) это категория
    expect(workCategoryCell).toHaveTextContent('Работа');


    // Проверка второй задачи
    expect(screen.getByText('Тестовая задача 2')).toBeInTheDocument();
    expect(screen.getByText('Описание 2')).toBeInTheDocument();
    // Ищем статус "Выполнена" как часть строки таблицы для конкретной задачи
    const completedTaskStatus = screen.getByRole('row', { name: /Тестовая задача 2/i }).querySelector('span');
    expect(completedTaskStatus).toHaveTextContent('Выполнена');

    const personalCategoryCell = screen.getByRole('row', { name: /Тестовая задача 2/i }).querySelectorAll('td')[10];
    expect(personalCategoryCell).toHaveTextContent('Личное');
  });

  test('фильтрует задачи по категории "Работа"', async () => {
    const user = userEvent.setup(); // Инициализация userEvent

    render(
      <MemoryRouter>
        <List />
      </MemoryRouter>
    );

    const selects = screen.getAllByRole('combobox');
    const categorySelect = selects[0]; // Первый селект - категория

    await user.selectOptions(categorySelect, '1'); // Выбираем "Работа"

    expect(screen.getByText('Тестовая задача 1')).toBeInTheDocument();
    expect(screen.queryByText('Тестовая задача 2')).not.toBeInTheDocument();
  });

  test('фильтрует задачи по статусу "Выполненные"', async () => {
    const user = userEvent.setup(); // Инициализация userEvent

    render(
      <MemoryRouter>
        <List />
      </MemoryRouter>
    );

    const selects = screen.getAllByRole('combobox');
    const statusSelect = selects[1]; // Второй селект - статус

    await user.selectOptions(statusSelect, 'completed'); // Выбираем "Выполненные"

    expect(screen.queryByText('Тестовая задача 1')).not.toBeInTheDocument();
    expect(screen.getByText('Тестовая задача 2')).toBeInTheDocument();
  });

  test('сортирует задачи по названию в убывающем порядке', async () => {
    const user = userEvent.setup(); // Инициализация userEvent

    render(
      <MemoryRouter>
        <List />
      </MemoryRouter>
    );

    const selects = screen.getAllByRole('combobox');
    const sortBySelect = selects[2]; // Третий селект - сортировка
    const sortOrderSelect = selects[3]; // Четвертый селект - порядок

    await user.selectOptions(sortBySelect, 'title');
    await user.selectOptions(sortOrderSelect, 'desc');

    const rows = screen.getAllByRole('row').slice(1); // Пропускаем заголовочную строку

    // Ожидаем, что "Тестовая задача 2" будет первой, а "Тестовая задача 1" - второй
    expect(rows[0]).toHaveTextContent('Тестовая задача 2');
    expect(rows[1]).toHaveTextContent('Тестовая задача 1');
  });

  test('добавляет задачу в избранное при клике на чекбокс', async () => {
    const user = userEvent.setup(); // Инициализация userEvent
    isFavorite.mockImplementation((taskId) => false); // Изначально не в избранном

    render(
      <MemoryRouter>
        <List />
      </MemoryRouter>
    );

    const checkboxes = screen.getAllByRole('checkbox');
    const firstTaskCheckbox = checkboxes[0]; // Чекбокс для первой задачи

    await user.click(firstTaskCheckbox); // Используем userEvent.click

    expect(addTaskToFavorites).toHaveBeenCalledTimes(1);
    expect(addTaskToFavorites).toHaveBeenCalledWith(1);
  });

  test('удаляет задачу из избранного при повторном клике на чекбокс', async () => {
    const user = userEvent.setup(); // Инициализация userEvent
    isFavorite.mockImplementation((taskId) => taskId === 1); // Изначально в избранном

    render(
      <MemoryRouter>
        <List />
      </MemoryRouter>
    );

    const checkboxes = screen.getAllByRole('checkbox');
    const firstTaskCheckbox = checkboxes[0]; // Чекбокс для первой задачи

    await user.click(firstTaskCheckbox); // Используем userEvent.click

    expect(removeTaskFromFavorites).toHaveBeenCalledTimes(1);
    expect(removeTaskFromFavorites).toHaveBeenCalledWith(1);
  });
});