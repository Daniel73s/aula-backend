import { Router } from 'express';
import { authMiddleware } from '../auth.js';
import {
  createExercise,
  getExercise,
  getAllExercises,
  updateExercise,
  toggleExercise,
  deleteExercise,
  getStudentsInExercise,
  removeStudentFromExercise,
} from '../store.js';

export const exercisesRouter = Router();
exercisesRouter.use(authMiddleware);

function io(req) {
  return req.app.get('io');
}

function notifyTeachers(req, event, data) {
  io(req)?.to('teachers').emit(event, data);
}

function notifyStudents(req, event, data) {
  io(req)?.to('students').emit(event, data);
}

function exerciseWithStudents(id) {
  const exercise = getExercise(id);
  if (!exercise) return null;
  return {
    ...exercise,
    students: getStudentsInExercise(id).map(sanitizeStudent),
  };
}

function sanitizeStudent(s) {
  return {
    id: s.id,
    alias: s.alias,
    status: s.status,
    connected: s.connected,
    joinedAt: s.joinedAt,
    lastStatusChange: s.lastStatusChange,
  };
}

function broadcastActiveList(req) {
  const active = getAllExercises().filter((e) => e.active);
  notifyStudents(req, 'exercise:list-updated', { exercises: active });
}

exercisesRouter.get('/', (_req, res) => {
  const exercises = getAllExercises().map((e) => exerciseWithStudents(e.id));
  res.json({ exercises });
});

exercisesRouter.post('/', (req, res) => {
  const { title, description, instructions } = req.body ?? {};
  if (!title?.trim()) {
    return res.status(400).json({ error: 'El título es requerido' });
  }
  const exercise = createExercise({
    title: title.trim(),
    description: description?.trim() ?? '',
    instructions: instructions?.trim() ?? '',
  });
  notifyTeachers(req, 'panel:exercise-created', { exercise: exerciseWithStudents(exercise.id) });
  broadcastActiveList(req);
  res.status(201).json({ exercise });
});

exercisesRouter.put('/:id', (req, res) => {
  const { title, description, instructions } = req.body ?? {};
  if (!title?.trim()) {
    return res.status(400).json({ error: 'El título es requerido' });
  }
  const exercise = updateExercise(req.params.id, {
    title: title.trim(),
    description: description?.trim() ?? '',
    instructions: instructions?.trim() ?? '',
  });
  if (!exercise) {
    return res.status(404).json({ error: 'Ejercicio no encontrado' });
  }
  notifyTeachers(req, 'panel:exercise-updated', { exercise: exerciseWithStudents(exercise.id) });
  broadcastActiveList(req);
  res.json({ exercise });
});

exercisesRouter.patch('/:id/toggle', (req, res) => {
  const exercise = toggleExercise(req.params.id);
  if (!exercise) {
    return res.status(404).json({ error: 'Ejercicio no encontrado' });
  }
  if (!exercise.active) {
    const affected = getStudentsInExercise(exercise.id);
    for (const student of affected) {
      removeStudentFromExercise(student.id);
      if (student.socketId) {
        io(req)?.to(student.socketId).emit('exercise:deactivated', {
          exerciseId: exercise.id,
          message: 'El ejercicio ha sido desactivado por el docente.',
        });
      }
    }
  }
  notifyTeachers(req, 'panel:exercise-toggled', { exercise: exerciseWithStudents(exercise.id) });
  broadcastActiveList(req);
  res.json({ exercise });
});

exercisesRouter.delete('/:id', (req, res) => {
  const exercise = getExercise(req.params.id);
  if (!exercise) {
    return res.status(404).json({ error: 'Ejercicio no encontrado' });
  }
  const affected = getStudentsInExercise(exercise.id);
  for (const student of affected) {
    removeStudentFromExercise(student.id);
    if (student.socketId) {
      io(req)?.to(student.socketId).emit('exercise:deactivated', {
        exerciseId: exercise.id,
        message: 'El ejercicio ha sido eliminado por el docente.',
      });
    }
  }
  deleteExercise(exercise.id);
  notifyTeachers(req, 'panel:exercise-deleted', { exerciseId: exercise.id });
  broadcastActiveList(req);
  res.json({ success: true });
});
