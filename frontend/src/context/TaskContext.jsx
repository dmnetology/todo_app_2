// src/context/TaskContext.jsx

import React, { createContext, useState, useEffect, useContext } from 'react';
import { useCallback, useMemo } from 'react'; // Добавляем useMemo и useCallback

const TaskContext = createContext();

export const TaskProvider = ({ children }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [favorites, setFavorites] = useState(() => {
    const savedFavorites = localStorage.getItem('favorites');
    return savedFavorites ? JSON.parse(savedFavorites) : [];
  });

  const getToken = useCallback(() => localStorage.getItem('access_token'), []); // Мемоизируем

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = getToken();

      if (!token) {
        setTasks([]);
        setLoading(false);
        return;
      }

      const response = await fetch('http://localhost:8000/tasks', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Ошибка HTTP: ${response.status}`);
      }

      const data = await response.json();
      setTasks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getToken]); // Зависимость от getToken

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }, [favorites]);

  const addTaskToFavorites = useCallback((taskId) => {
    setFavorites((prevFavorites) => {
      if (!prevFavorites.includes(taskId)) {
        return [...prevFavorites, taskId];
      }
      return prevFavorites;
    });
  }, []); // Нет зависимостей, т.к. setFavorites стабилен

  const removeTaskFromFavorites = useCallback((taskId) => {
    setFavorites((prevFavorites) => prevFavorites.filter((id) => id !== taskId));
  }, []); // Нет зависимостей, т.к. setFavorites стабилен

  const isFavorite = useCallback((taskId) => favorites.includes(taskId), [favorites]); // Зависимость от favorites

  return (
    <TaskContext.Provider
      value={{
        tasks,
        loading,
        error,
        favorites,
        addTaskToFavorites,
        removeTaskFromFavorites,
        isFavorite,
        fetchTasks,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
};

export const useTasks = () => useContext(TaskContext);