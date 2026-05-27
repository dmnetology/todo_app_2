module.exports = {
  testEnvironment: 'jest-environment-jsdom', // Используем jest-environment-jsdom для симуляции DOM
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  moduleNameMapper: {
    // Маппинг для CSS-файлов, чтобы Jest их корректно обрабатывал
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Если есть алиасы в vite.config.js (например, @/components), их нужно будет добавить сюда
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest', // Трансформируем JS/JSX файлы с помощью Babel
  },
};