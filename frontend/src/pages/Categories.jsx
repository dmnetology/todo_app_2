import React, { useEffect, useState } from 'react';
import { createCategory, deleteCategory, getCategories, updateCategory } from '../api/categories';
import CategoryForm from '../components/categories/CategoryForm';
import './Categories.scss';

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  const loadCategories = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getCategories();
      setCategories(data || []);
    } catch (err) {
      setError(err.message || 'Ошибка загрузки категорий');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleCreate = async (payload) => {
    setSaving(true);
    setError('');

    try {
      await createCategory(payload);
      setShowForm(false);
      await loadCategories();
    } catch (err) {
      setError(err.message || 'Ошибка создания категории');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (payload) => {
    if (!editingCategory) return;

    setSaving(true);
    setError('');

    try {
      await updateCategory(editingCategory.id, payload);
      setEditingCategory(null);
      await loadCategories();
    } catch (err) {
      setError(err.message || 'Ошибка обновления категории');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить категорию?')) return;

    try {
      await deleteCategory(id);
      await loadCategories();
    } catch (err) {
      setError(err.message || 'Ошибка удаления категории');
    }
  };

  if (loading) {
    return (
      <main className="categories-page">
        <p className="categories-page__message">Загрузка категорий...</p>
      </main>
    );
  }

  return (
    <main className="categories-page">
      <header className="categories-page__header">
        <div>
          <h1 className="categories-page__title">Категории</h1>
          <p className="categories-page__subtitle">Создание и управление категориями задач.</p>
        </div>

        <button
          type="button"
          className="categories-page__create-button"
          onClick={() => {
            setEditingCategory(null);
            setShowForm(true);
          }}
        >
          + Новая категория
        </button>
      </header>

      {error && (
        <div className="categories-page__error" role="alert">
          {error}
        </div>
      )}

      {(showForm || editingCategory) && (
        <section className="categories-page__panel">
          <h2 className="categories-page__panel-title">
            {editingCategory ? 'Редактирование категории' : 'Создание категории'}
          </h2>

          <CategoryForm
            initialValues={editingCategory}
            onSubmit={editingCategory ? handleUpdate : handleCreate}
            onCancel={() => {
              setShowForm(false);
              setEditingCategory(null);
            }}
            submitText={editingCategory ? 'Обновить' : 'Создать'}
            loading={saving}
          />
        </section>
      )}

      <section className="categories-list">
        {categories.length === 0 ? (
          <p className="categories-page__message">Категорий пока нет.</p>
        ) : (
          categories.map((category) => (
            <article key={category.id} className="category-card">
              <div className="category-card__main">
                <h2 className="category-card__title">{category.name}</h2>
              </div>

              <div className="category-card__actions">
                <button
                  type="button"
                  className="category-card__button category-card__button--secondary"
                  onClick={() => {
                    setShowForm(false);
                    setEditingCategory(category);
                  }}
                >
                  Редактировать
                </button>

                <button
                  type="button"
                  className="category-card__button category-card__button--danger"
                  onClick={() => handleDelete(category.id)}
                >
                  Удалить
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
};

export default Categories;
