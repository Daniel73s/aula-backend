export const config = {
  port: Number(process.env.PORT) || 3000,
  teacherUser: process.env.TEACHER_USER || 'docente',
  teacherPassword: process.env.TEACHER_PASSWORD || 'aula2024',
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
