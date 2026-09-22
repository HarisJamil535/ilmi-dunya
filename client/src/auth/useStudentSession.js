import { useSyncExternalStore } from 'react';
import { STUDENT_AUTH_CHANGED } from './authEvents';

const subscribe = listener => {
  window.addEventListener(STUDENT_AUTH_CHANGED, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(STUDENT_AUTH_CHANGED, listener);
    window.removeEventListener('storage', listener);
  };
};
const snapshot = () => Boolean(localStorage.getItem('studentToken'));
const serverSnapshot = () => false;

export function useStudentSession() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
