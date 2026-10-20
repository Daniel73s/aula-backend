import { Server } from 'socket.io';
import { config } from './config.js';
import { isValidTeacherToken } from './store.js';
import {
  createStudent,
  findStudentByToken,
  updateStudentSocket,
  disconnectStudent,
  removeStudentFromExercise,
  joinExercise,
  updateStudentStatus,
  getStudentsInExercise,
  getExercise,
  isAliasTakenInExercise,
  getStudent,
  getAllStudents,
  getAllExercises,
  cleanupDisconnectedStudents,
} from './store.js';

const VALID_STATUSES = ['working', 'finished', 'need_help'];

function getActiveExercisesPublic() {
  return getAllExercises()
    .filter((e) => e.active)
    .map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      instructions: e.instructions,
      active: e.active,
      createdAt: e.createdAt,
    }));
}

function sanitizeStudent(s) {
  return {
    id: s.id,
    alias: s.alias,
    status: s.status,
    connected: s.connected,
    joinedAt: s.joinedAt,
    lastStatusChange: s.lastStatusChange,
    exerciseId: s.exerciseId,
  };
}

function buildPanelSync() {
  const exercises = getAllExercises().map((e) => ({
    ...e,
    students: getStudentsInExercise(e.id).map(sanitizeStudent),
  }));
  const inExercise = getAllStudents().filter((s) => s.connected && s.exerciseId);
  const stats = {
    totalStudents: inExercise.length,
    working: inExercise.filter((s) => s.status === 'working').length,
    finished: inExercise.filter((s) => s.status === 'finished').length,
    needHelp: inExercise.filter((s) => s.status === 'need_help').length,
  };
  return { exercises, stats };
}

export function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin === '*' ? true : config.corsOrigin,
    },
  });

  io.on('connection', (socket) => {
    socket.data.role = null;
    socket.data.studentId = null;

    // ===== Docente =====
    socket.on('teacher:auth', (data, callback) => {
      if (!data?.token || !isValidTeacherToken(data.token)) {
        callback?.({ success: false, error: 'Token inválido' });
        return;
      }
      socket.data.role = 'teacher';
      socket.join('teachers');
      callback?.({ success: true });
      socket.emit('panel:sync', buildPanelSync());
    });

    socket.on('panel:request-sync', () => {
      if (socket.data.role === 'teacher') {
        socket.emit('panel:sync', buildPanelSync());
      }
    });

    // ===== Alumno =====
    socket.on('student:identify', (data, callback) => {
      const { alias, token } = data ?? {};
      if (!alias?.trim()) {
        callback?.({ success: false, error: 'El alias es requerido' });
        return;
      }
      if (alias.trim().length > 30) {
        callback?.({ success: false, error: 'El alias no puede superar 30 caracteres' });
        return;
      }

      let student = null;

      if (token) {
        student = findStudentByToken(token);
        if (student) {
          updateStudentSocket(student.id, socket.id);
          socket.data.role = 'student';
          socket.data.studentId = student.id;
          socket.join('students');

          let exerciseData = null;
          if (student.exerciseId) {
            socket.join(`exercise:${student.exerciseId}`);
            const ex = getExercise(student.exerciseId);
            if (ex) {
              exerciseData = {
                id: ex.id,
                title: ex.title,
                description: ex.description,
                instructions: ex.instructions,
              };
            }
            io.to('teachers').emit('panel:student-status', {
              exerciseId: student.exerciseId,
              student: sanitizeStudent(student),
            });
          }

          callback?.({
            success: true,
            studentId: student.id,
            studentToken: student.token,
            alias: student.alias,
            exerciseId: student.exerciseId,
            exercise: exerciseData,
            status: student.status,
            activeExercises: getActiveExercisesPublic(),
            recovered: true,
          });
          return;
        }
      }

      student = createStudent(alias.trim(), socket.id);
      socket.data.role = 'student';
      socket.data.studentId = student.id;
      socket.join('students');
      callback?.({
        success: true,
        studentId: student.id,
        studentToken: student.token,
        alias: student.alias,
        activeExercises: getActiveExercisesPublic(),
        recovered: false,
      });
    });

    socket.on('student:join-exercise', (data, callback) => {
      if (socket.data.role !== 'student') {
        callback?.({ success: false, error: 'No autorizado' });
        return;
      }
      const { exerciseId } = data ?? {};
      const student = getStudent(socket.data.studentId);
      if (!student) {
        callback?.({ success: false, error: 'Estudiante no encontrado' });
        return;
      }
      const exercise = getExercise(exerciseId);
      if (!exercise) {
        callback?.({ success: false, error: 'Ejercicio no encontrado' });
        return;
      }
      if (!exercise.active) {
        callback?.({ success: false, error: 'El ejercicio no está activo' });
        return;
      }
      if (
        student.exerciseId !== exerciseId &&
        isAliasTakenInExercise(exerciseId, student.alias)
      ) {
        callback?.({ success: false, error: 'Ya hay un alumno con ese alias en este ejercicio' });
        return;
      }

      if (student.exerciseId) {
        const prevId = student.exerciseId;
        socket.leave(`exercise:${prevId}`);
        removeStudentFromExercise(student.id);
        io.to('teachers').emit('panel:student-left', {
          exerciseId: prevId,
          studentId: student.id,
        });
      }

      joinExercise(student.id, exerciseId);
      socket.join(`exercise:${exerciseId}`);

      io.to('teachers').emit('panel:student-joined', {
        exerciseId,
        student: sanitizeStudent(student),
      });

      callback?.({
        success: true,
        exercise: {
          id: exercise.id,
          title: exercise.title,
          description: exercise.description,
          instructions: exercise.instructions,
        },
        student: sanitizeStudent(student),
      });
    });

    socket.on('student:leave-exercise', (_data, callback) => {
      if (socket.data.role !== 'student') {
        callback?.({ success: false, error: 'No autorizado' });
        return;
      }
      const student = getStudent(socket.data.studentId);
      if (!student || !student.exerciseId) {
        callback?.({ success: true });
        return;
      }
      const exerciseId = student.exerciseId;
      socket.leave(`exercise:${exerciseId}`);
      removeStudentFromExercise(student.id);
      io.to('teachers').emit('panel:student-left', {
        exerciseId,
        studentId: student.id,
      });
      callback?.({ success: true });
    });

    socket.on('student:update-status', (data, callback) => {
      if (socket.data.role !== 'student') {
        callback?.({ success: false, error: 'No autorizado' });
        return;
      }
      const { status } = data ?? {};
      if (!VALID_STATUSES.includes(status)) {
        callback?.({ success: false, error: 'Estado inválido' });
        return;
      }
      const student = getStudent(socket.data.studentId);
      if (!student || !student.exerciseId) {
        callback?.({ success: false, error: 'No estás en un ejercicio' });
        return;
      }
      const exercise = getExercise(student.exerciseId);
      if (!exercise || !exercise.active) {
        removeStudentFromExercise(student.id);
        socket.leave(`exercise:${student.exerciseId}`);
        callback?.({ success: false, error: 'El ejercicio ya no está activo' });
        return;
      }

      updateStudentStatus(student.id, status);
      io.to('teachers').emit('panel:student-status', {
        exerciseId: student.exerciseId,
        student: sanitizeStudent(student),
      });
      callback?.({ success: true, status, lastStatusChange: student.lastStatusChange });
    });

    socket.on('disconnect', () => {
      if (socket.data.role === 'student' && socket.data.studentId) {
        const student = disconnectStudent(socket.data.studentId);
        if (student?.exerciseId) {
          io.to('teachers').emit('panel:student-status', {
            exerciseId: student.exerciseId,
            student: sanitizeStudent(student),
          });
        }
      }
    });
  });

  setInterval(() => cleanupDisconnectedStudents(5 * 60 * 1000), 60 * 1000);

  return io;
}
