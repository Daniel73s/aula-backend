import { randomUUID } from 'node:crypto';

// ========== Ejercicios ==========
const exercises = new Map();

export function createExercise({ title, description = '', instructions = '' }) {
  const id = randomUUID();
  const exercise = {
    id,
    title,
    description,
    instructions,
    active: false,
    createdAt: new Date().toISOString(),
  };
  exercises.set(id, exercise);
  return exercise;
}

export function getExercise(id) {
  return exercises.get(id) ?? null;
}

export function getAllExercises() {
  return [...exercises.values()];
}

export function getActiveExercises() {
  return [...exercises.values()].filter((e) => e.active);
}

export function updateExercise(id, data) {
  const exercise = exercises.get(id);
  if (!exercise) return null;
  if (data.title !== undefined) exercise.title = data.title;
  if (data.description !== undefined) exercise.description = data.description;
  if (data.instructions !== undefined) exercise.instructions = data.instructions;
  return exercise;
}

export function toggleExercise(id) {
  const exercise = exercises.get(id);
  if (!exercise) return null;
  exercise.active = !exercise.active;
  return exercise;
}

export function deleteExercise(id) {
  return exercises.delete(id);
}

// ========== Alumnos ==========
const students = new Map();

export function createStudent(alias, socketId) {
  const id = randomUUID();
  const token = randomUUID();
  const student = {
    id,
    alias,
    token,
    socketId,
    connected: true,
    exerciseId: null,
    status: null,
    joinedAt: null,
    lastStatusChange: null,
    disconnectedAt: null,
  };
  students.set(id, student);
  return student;
}

export function findStudentByToken(token) {
  for (const student of students.values()) {
    if (student.token === token) return student;
  }
  return null;
}

export function getStudent(id) {
  return students.get(id) ?? null;
}

export function updateStudentSocket(studentId, socketId) {
  const student = students.get(studentId);
  if (!student) return null;
  student.socketId = socketId;
  student.connected = true;
  student.disconnectedAt = null;
  return student;
}

export function disconnectStudent(studentId) {
  const student = students.get(studentId);
  if (!student) return null;
  student.connected = false;
  student.socketId = null;
  student.disconnectedAt = new Date().toISOString();
  return student;
}

export function removeStudentFromExercise(studentId) {
  const student = students.get(studentId);
  if (!student) return null;
  student.exerciseId = null;
  student.status = null;
  student.joinedAt = null;
  student.lastStatusChange = null;
  return student;
}

export function joinExercise(studentId, exerciseId) {
  const student = students.get(studentId);
  if (!student) return null;
  student.exerciseId = exerciseId;
  student.status = 'working';
  student.joinedAt = new Date().toISOString();
  student.lastStatusChange = new Date().toISOString();
  return student;
}

export function updateStudentStatus(studentId, status) {
  const student = students.get(studentId);
  if (!student) return null;
  student.status = status;
  student.lastStatusChange = new Date().toISOString();
  return student;
}

export function getStudentsInExercise(exerciseId) {
  return [...students.values()].filter((s) => s.exerciseId === exerciseId);
}

export function getAllStudents() {
  return [...students.values()];
}

export function isAliasTakenInExercise(exerciseId, alias) {
  return [...students.values()].some(
    (s) =>
      s.exerciseId === exerciseId &&
      s.alias.toLowerCase() === alias.toLowerCase() &&
      s.connected,
  );
}

export function removeStudent(studentId) {
  return students.delete(studentId);
}

export function cleanupDisconnectedStudents(maxAgeMs = 5 * 60 * 1000) {
  const now = Date.now();
  for (const [id, student] of students.entries()) {
    if (!student.connected && student.disconnectedAt) {
      const age = now - new Date(student.disconnectedAt).getTime();
      if (age > maxAgeMs) {
        students.delete(id);
      }
    }
  }
}

// ========== Tokens del docente ==========
const teacherTokens = new Set();

export function addTeacherToken(token) {
  teacherTokens.add(token);
}

export function isValidTeacherToken(token) {
  return teacherTokens.has(token);
}

export function removeTeacherToken(token) {
  teacherTokens.delete(token);
}
