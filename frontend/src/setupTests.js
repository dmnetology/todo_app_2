import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill для TextEncoder/TextDecoder
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}

// Мокаем localStorage
const localStorageMock = (function () {
  let store = {};

  return {
    getItem: function (key) {
      return store[key] || null;
    },
    setItem: function (key, value) {
      store[key] = String(value);
    },
    removeItem: function (key) {
      delete store[key];
    },
    clear: function () {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Мокаем window.location.reload через переопределение location целиком
try {
  const originalLocation = window.location;

  delete window.location;

  window.location = {
    ...originalLocation,
    reload: jest.fn(),
  };
} catch (error) {
  // Если окружение не позволяет переопределить location, игнорируем
}