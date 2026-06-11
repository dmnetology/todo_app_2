import React, { useEffect, useState } from 'react';
import './CategoryForm.scss';

const CategoryForm = ({
  initialValues = null,
  onSubmit,
  onCancel,
  submitText = 'Сохранить',
  loading = false,
}) => {
  const [name, setName] = useState('');

  useEffect(() => {
    setName(initialValues?.name ?? '');
  }, [initialValues]);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({ name: name.trim() });
  };

  return (
    <form className="category-form" onSubmit={handleSubmit}>
      <div className="category-form__field">
        <label className="category-form__label" htmlFor="name">
          Название категории
        </label>
        <input
          id="name"
          type="text"
          className="category-form__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="category-form__actions">
        {onCancel && (
          <button
            type="button"
            className="category-form__button category-form__button--secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Отмена
          </button>
        )}

        <button type="submit" className="category-form__button" disabled={loading}>
          {loading ? 'Сохранение...' : submitText}
        </button>
      </div>
    </form>
  );
};

export default CategoryForm;