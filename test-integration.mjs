import { io } from 'socket.io-client';

const URL = 'http://localhost:3000';
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${detail ? ' :: ' + detail : ''}`);
}
function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function login() {
  const res = await fetch(`${URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'docente', password: 'aula2024' }),
  });
  return (await res.json()).token;
}

async function createExercise(token, title) {
  const res = await fetch(`${URL}/api/exercises`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title, description: 'desc', instructions: 'inst' }),
  });
  return (await res.json()).exercise;
}

async function toggle(token, id) {
  const res = await fetch(`${URL}/api/exercises/${id}/toggle`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  return (await res.json()).exercise;
}

function connectSocket() {
  return new Promise((resolve) => {
    const s = io(URL, { transports: ['websocket'] });
    s.on('connect', () => resolve(s));
  });
}

function emit(socket, event, data) {
  return new Promise((resolve) => {
    socket.emit(event, data, (res) => resolve(res));
  });
}

const main = async () => {
  const token = await login();
  const exercise = await createExercise(token, 'Ejercicio Socket');
  await toggle(token, exercise.id);

  // ===== Teacher socket =====
  const teacher = await connectSocket();
  const teacherAuth = await emit(teacher, 'teacher:auth', { token });
  check('teacher:auth con token válido', teacherAuth?.success === true);

  let syncReceived = null;
  teacher.on('panel:sync', (d) => (syncReceived = d));

  // ===== Student socket =====
  const student = await connectSocket();
  const badAuth = await emit(student, 'teacher:auth', { token: 'falso' });
  check('teacher:auth con token inválido rechazado', badAuth?.success === false);

  const studentIdentify = await emit(student, 'student:identify', { alias: 'AlumnoTest' });
  check('student:identify', studentIdentify?.success === true && !!studentIdentify.studentToken);
  check(
    'student:identify entrega ejercicios activos',
    Array.isArray(studentIdentify.activeExercises) &&
      studentIdentify.activeExercises.some((e) => e.id === exercise.id),
  );

  // Join exercise
  let studentJoinedEvent = null;
  teacher.on('panel:student-joined', (d) => (studentJoinedEvent = d));
  const join = await emit(student, 'student:join-exercise', { exerciseId: exercise.id });
  await wait(200);
  check('student:join-exercise', join?.success === true);
  check('docente recibe panel:student-joined', studentJoinedEvent?.student?.alias === 'AlumnoTest');

  // Update status
  let statusEvent = null;
  teacher.on('panel:student-status', (d) => (statusEvent = d));
  const upd = await emit(student, 'student:update-status', { status: 'need_help' });
  await wait(200);
  check('student:update-status', upd?.success === true && upd.status === 'need_help');
  check('docente recibe panel:student-status need_help', statusEvent?.student?.status === 'need_help');

  // Invalid status
  const badStatus = await emit(student, 'student:update-status', { status: 'hacked' });
  check('estado inválido rechazado', badStatus?.success === false);

  // Student tries admin event: student has no teacher role, so no panel:sync is emitted
  let studentGotSync = false;
  student.on('panel:sync', () => (studentGotSync = true));
  student.emit('panel:request-sync');
  await wait(200);
  check('alumno no recibe panel:sync (rol aislado)', studentGotSync === false);

  // Alias duplication
  const student2 = await connectSocket();
  const dup = await emit(student2, 'student:identify', { alias: 'AlumnoTest' });
  const dupJoin = await emit(student2, 'student:join-exercise', { exerciseId: exercise.id });
  check('alias duplicado rechazado en ejercicio', dupJoin?.success === false);

  // Deactivate exercise -> students notified
  let deactivated = null;
  student.on('exercise:deactivated', (d) => (deactivated = d));
  await toggle(token, exercise.id);
  await wait(200);
  check('al desactivar, alumno recibe exercise:deactivated', !!deactivated);

  // Panel sync per teacher
  teacher.emit('panel:request-sync');
  await wait(200);
  check('panel:sync contiene stats', !!syncReceived && typeof syncReceived.stats?.totalStudents === 'number');

  teacher.close();
  student.close();
  student2.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} pruebas OK ===`);
  process.exit(failed.length === 0 ? 0 : 1);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
