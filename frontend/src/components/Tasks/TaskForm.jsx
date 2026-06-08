import React, { useEffect, useState } from 'react';
import './TaskForm.scss';
import { dateTimeToLocalInputValue } from '../../utils/datetime';

const getClientTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;

const emptyForm = {
  title: '',
  description: '',
  category_id: '',
  priority: 'medium',
  due_date: '',
  planned_start_local: '',
  planned_start_timezone: getClientTimezone(),
};

const TaskForm = ({
  initialValues = null,
  categories = [],
  onSubmit,
  onCancel,
  submitText = 'Сохранить',
  loading = false,
  readOnlyFields = [],
  hideFields = [],
}) => {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (initialValues) {
      setForm({
        title: initialValues.title ?? '',
        description: initialValues.description ?? '',
        category_id: initialValues.category_id ?? '',
        priority: initialValues.priority ?? 'medium',
        due_date: dateTimeToLocalInputValue(initialValues.due_date),
        planned_start_local: dateTimeToLocalInputValue(
          initialValues.planned_start_local
        ),
        planned_start_timezone:
          initialValues.planned_start_timezone ?? getClientTimezone(),
      });
    } else {
      setForm(emptyForm);
    }
  }, [initialValues]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category_id: form.category_id ? Number(form.category_id) : null,
      priority: form.priority,
      due_date: form.due_date || null,
      planned_start_local: form.planned_start_local || null,
      planned_start_timezone: form.planned_start_timezone || getClientTimezone(),
    };

    onSubmit(payload);
  };

  const isReadOnly = (fieldName) => readOnlyFields.includes(fieldName);
  const isHidden = (fieldName) => hideFields.includes(fieldName);

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <div className="task-form__field">
        <label className="task-form__label" htmlFor="title">
          Название
        </label>
        <input
          id="title"
          name="title"
          type="text"
          className="task-form__input"
          value={form.title}
          onChange={handleChange}
          required
          disabled={loading}
        />
      </div>

      <div className="task-form__field">
        <label className="task-form__label" htmlFor="description">
          Описание
        </label>
        <textarea
          id="description"
          name="description"
          className="task-form__textarea"
          value={form.description}
          onChange={handleChange}
          rows={4}
          disabled={loading}
        />
      </div>

      <div className="task-form__row">
        <div className="task-form__field">
          <label className="task-form__label" htmlFor="category_id">
            Категория
          </label>
          <select
            id="category_id"
            name="category_id"
            className="task-form__input"
            value={form.category_id}
            onChange={handleChange}
            disabled={loading}
          >
            <option value="">Без категории</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="task-form__field">
          <label className="task-form__label" htmlFor="priority">
            Приоритет
          </label>
          <select
            id="priority"
            name="priority"
            className="task-form__input"
            value={form.priority}
            onChange={handleChange}
            disabled={loading}
          >
            <option value="low">Низкий</option>
            <option value="medium">Средний</option>
            <option value="high">Высокий</option>
          </select>
        </div>
      </div>

      {!isHidden('planned_start_local') && (
        <div className="task-form__row">
          <div className="task-form__field">
            <label className="task-form__label" htmlFor="planned_start_local">
              Плановый старт
            </label>
            <input
              id="planned_start_local"
              name="planned_start_local"
              type="datetime-local"
              className="task-form__input"
              value={form.planned_start_local}
              onChange={handleChange}
              disabled={loading || isReadOnly('planned_start_local')}
              readOnly={isReadOnly('planned_start_local')}
            />
          </div>

          {!isHidden('due_date') && (
            <div className="task-form__field">
              <label className="task-form__label" htmlFor="due_date">
                Дедлайн
              </label>
              <input
                id="due_date"
                name="due_date"
                type="datetime-local"
                className="task-form__input"
                value={form.due_date}
                onChange={handleChange}
                disabled={loading || isReadOnly('due_date')}
                readOnly={isReadOnly('due_date')}
              />
            </div>
          )}
        </div>
      )}

      <div className="task-form__actions">
        {onCancel && (
          <button
            type="button"
            className="task-form__button task-form__button--secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Отмена
          </button>
        )}

        <button type="submit" className="task-form__button" disabled={loading}>
          {loading ? 'Сохранение...' : submitText}
        </button>
      </div>
    </form>
  );
};

export default TaskForm;