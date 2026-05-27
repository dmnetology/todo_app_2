import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTasks } from '../context/TaskContext';
import './List.css';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return isNaN(date.getTime()) ? '—' : date.toLocaleString('ru-RU');
};

const List = () => {
  const {
    tasks,
    loading,
    error,
    addTaskToFavorites,
    removeTaskFromFavorites,
    isFavorite,
  } = useTasks();

  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('title');
  const [sortOrder, setSortOrder] = useState('asc');

  const categories = useMemo(() => {
    const unique = new Map();

    tasks.forEach((task) => {
      if (task.category?.id && task.category?.name) {
        unique.set(String(task.category.id), task.category.name);
      } else if (task.category_id) {
        unique.set(String(task.category_id), `Категория ${task.category_id}`);
      }
    });

    return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  const filteredAndSortedTasks = useMemo(() => {
    let result = [...tasks];

    if (categoryFilter !== 'all') {
      result = result.filter((task) => {
        const taskCategoryId = task.category?.id ?? task.category_id;
        return String(taskCategoryId) === String(categoryFilter);
      });
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'completed') {
        result = result.filter((task) => task.is_completed);
      } else if (statusFilter === 'active') {
        result = result.filter((task) => !task.is_completed);
      }
    }

    result.sort((a, b) => {
      let valueA;
      let valueB;

      switch (sortBy) {
        case 'title':
          valueA = a.title || '';
          valueB = b.title || '';
          return sortOrder === 'asc'
            ? valueA.localeCompare(valueB, 'ru')
            : valueB.localeCompare(valueA, 'ru');

        case 'status':
          valueA = a.is_completed ? 1 : 0;
          valueB = b.is_completed ? 1 : 0;
          return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;

        case 'estimated_minutes':
          valueA = a.estimated_minutes ?? 0;
          valueB = b.estimated_minutes ?? 0;
          return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;

        case 'actual_minutes':
          valueA = a.actual_minutes ?? 0;
          valueB = b.actual_minutes ?? 0;
          return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;

        default:
          return 0;
      }
    });

    return result;
  }, [tasks, categoryFilter, statusFilter, sortBy, sortOrder]);

  if (loading) {
    return (
      <main aria-busy="true">
        <p role="status">Загрузка задач...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main>
        <p role="alert" style={{ color: 'red' }}>
          Ошибка при загрузке задач: {error}
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Список задач</h1>

      <div
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: '20px',
        }}
        aria-label="Фильтры и сортировка задач"
      >
        <div>
          <label htmlFor="category-filter">Категория:</label>
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">Все</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="status-filter">Статус:</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Все</option>
            <option value="completed">Выполненные</option>
            <option value="active">Не выполненные</option>
          </select>
        </div>

        <div>
          <label htmlFor="sort-by">Сортировка:</label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="title">По названию</option>
            <option value="status">По статусу</option>
            <option value="estimated_minutes">По ожидаемому времени</option>
            <option value="actual_minutes">По фактическому времени</option>
          </select>
        </div>

        <div>
          <label htmlFor="sort-order">Порядок:</label>
          <select
            id="sort-order"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="asc">По возрастанию</option>
            <option value="desc">По убыванию</option>
          </select>
        </div>
      </div>

      {filteredAndSortedTasks.length === 0 ? (
        <p>Задач не найдено.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <caption style={{ textAlign: 'left', marginBottom: '8px' }}>
            Таблица задач
          </caption>
          <thead>
            <tr style={{ backgroundColor: '#f2f2f2' }}>
              <th scope="col" style={thStyle}>ID</th>
              <th scope="col" style={thStyle}>Название</th>
              <th scope="col" style={thStyle}>Описание</th>
              <th scope="col" style={thStyle}>Статус</th>
              <th scope="col" style={thStyle}>Приоритет</th>
              <th scope="col" style={thStyle}>План</th>
              <th scope="col" style={thStyle}>Создана</th>
              <th scope="col" style={thStyle}>Выполнена</th>
              <th scope="col" style={thStyle}>Ожидаемое время</th>
              <th scope="col" style={thStyle}>Фактическое время</th>
              <th scope="col" style={thStyle}>Категория</th>
              <th scope="col" style={thStyle}>Избранное</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedTasks.map((task) => {
              const completed = !!task.is_completed;
              const favorite = isFavorite(task.id);
              const favoriteLabel = favorite
                ? `Убрать задачу "${task.title}" из избранного`
                : `Добавить задачу "${task.title}" в избранное`;

              return (
                <tr
                  key={task.id}
                  style={{ backgroundColor: completed ? '#e8f8e8' : '#fff3cd' }}
                >
                  <td style={tdStyle}>{task.id}</td>

                  <td style={tdStyle}>
                    <Link to={`/list/${task.id}`}>
                      {task.title || `Задача ${task.id}`}
                    </Link>
                  </td>

                  <td style={tdStyle}>{task.description || '—'}</td>

                  <td style={tdStyle}>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        color: 'white',
                        backgroundColor: completed ? '#28a745' : '#dc3545',
                      }}
                    >
                      {completed ? 'Выполнена' : 'Не выполнена'}
                    </span>
                  </td>

                  <td style={tdStyle}>{task.priority || '—'}</td>

                  <td style={tdStyle}>{formatDate(task.due_date)}</td>

                  <td style={tdStyle}>{formatDate(task.created_at)}</td>

                  <td style={tdStyle}>{formatDate(task.completed_at)}</td>

                  <td style={tdStyle}>{task.estimated_minutes ?? '—'} мин.</td>

                  <td style={tdStyle}>{task.actual_minutes ?? '—'} мин.</td>

                  <td style={tdStyle}>
                    {task.category?.name || task.category_id || '—'}
                  </td>

                  <td style={tdStyle}>
                    <label htmlFor={`favorite-${task.id}`} className="toggle-switch">
                      <input
                        id={`favorite-${task.id}`}
                        type="checkbox"
                        checked={favorite}
                        onChange={() =>
                          favorite
                            ? removeTaskFromFavorites(task.id)
                            : addTaskToFavorites(task.id)
                        }
                        aria-label={favoriteLabel}
                      />
                      <span className="toggle-slider" aria-hidden="true"></span>
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
};

const thStyle = {
  border: '1px solid #ccc',
  padding: '8px',
  textAlign: 'left',
};

const tdStyle = {
  border: '1px solid #ccc',
  padding: '8px',
  verticalAlign: 'top',
};

export default List;
