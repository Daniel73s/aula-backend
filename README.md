# Aula en Tiempo Real — Backend

Servidor Node.js + Express + Socket.IO para el control en tiempo real del progreso de los alumnos.

**No usa base de datos.** Todos los ejercicios, sesiones y estados viven únicamente en memoria RAM del servidor y se pierden al reiniciarlo.

## Requisitos

- Node.js 18+ (probado con Node 24)

## Instalación

```bash
npm install
```

## Configuración

Copia `.env.example` a `.env` y ajusta los valores:

| Variable | Descripción | Por defecto |
|---|---|---|
| `PORT` | Puerto del servidor HTTP/Socket.IO | `3000` |
| `TEACHER_USER` | Usuario del docente | `docente` |
| `TEACHER_PASSWORD` | Contraseña del docente | `aula2024` |
| `CORS_ORIGIN` | Origen permitido para CORS (`*` = cualquiera) | `*` |

> Las credenciales del docente se leen de variables de entorno. No hay contraseñas en el código fuente.

## Ejecución

```bash
npm start        # producción
npm run dev      # desarrollo con recarga automática
```

El servidor queda escuchando en `http://localhost:3000`.

## Pruebas de integración

Con el servidor en ejecución (`npm start`) en otra terminal:

```bash
node test-integration.mjs
```

Verifica autenticación, creación/activación de ejercicios, ingreso y salida de alumnos, cambios de estado, aislamiento de roles y notificaciones en tiempo real.

## API HTTP

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/health` | No | Estado del servidor |
| POST | `/api/auth/login` | No | Inicia sesión del docente, devuelve `{ token }` |
| POST | `/api/auth/logout` | Bearer | Cierra sesión del docente |
| GET | `/api/exercises` | Bearer | Lista todos los ejercicios con sus alumnos |
| POST | `/api/exercises` | Bearer | Crea un ejercicio `{ title, description, instructions }` |
| PUT | `/api/exercises/:id` | Bearer | Edita un ejercicio |
| PATCH | `/api/exercises/:id/toggle` | Bearer | Activa o desactiva un ejercicio |
| DELETE | `/api/exercises/:id` | Bearer | Elimina un ejercicio |

Las rutas protegidas requieren la cabecera `Authorization: Bearer <token>`.

## Eventos Socket.IO

### Docente → Servidor (con callback de respuesta)

| Evento | Payload | Respuesta | Descripción |
|---|---|---|---|
| `teacher:auth` | `{ token }` | `{ success }` | Autentica el socket del docente y lo une a la sala `teachers` |
| `panel:request-sync` | — | — | Solicita una sincronización completa del panel |

### Alumno → Servidor (con callback de respuesta)

| Evento | Payload | Respuesta | Descripción |
|---|---|---|---|
| `student:identify` | `{ alias, token? }` | `{ studentId, studentToken, alias, activeExercises, exercise?, status?, recovered }` | Identifica al alumno; recupera participación si se reenvía `token` |
| `student:join-exercise` | `{ exerciseId }` | `{ exercise, student }` | Une al alumno a un ejercicio activo |
| `student:leave-exercise` | — | `{ success }` | Sale del ejercicio actual |
| `student:update-status` | `{ status }` | `{ success, status, lastStatusChange }` | Cambia el estado (`working`, `finished`, `need_help`) |

### Servidor → Docente (sala `teachers`)

| Evento | Payload | Descripción |
|---|---|---|
| `panel:sync` | `{ exercises, stats }` | Estado completo del panel |
| `panel:exercise-created` | `{ exercise }` | Ejercicio creado |
| `panel:exercise-updated` | `{ exercise }` | Ejercicio editado |
| `panel:exercise-toggled` | `{ exercise }` | Ejercicio activado/desactivado |
| `panel:exercise-deleted` | `{ exerciseId }` | Ejercicio eliminado |
| `panel:student-joined` | `{ exerciseId, student }` | Alumno se unió |
| `panel:student-left` | `{ exerciseId, studentId }` | Alumno salió |
| `panel:student-status` | `{ exerciseId, student }` | Alumno cambió de estado o se desconectó |

### Servidor → Alumnos (sala `students`)

| Evento | Payload | Descripción |
|---|---|---|
| `exercise:list-updated` | `{ exercises }` | Lista de ejercicios activos actualizada |
| `exercise:deactivated` | `{ exerciseId, message }` | El ejercicio fue desactivado o eliminado |

## Comportamiento en memoria

- Si un alumno se desconecta, se marca como desconectado pero conserva su participación para reconexión.
- Al reconectarse con su `studentToken`, recupera su ejercicio y estado.
- Los alumnos desconectados más de 5 minutos se eliminan automáticamente.
- Si el docente se desconecta, los datos permanecen en memoria mientras el servidor siga vivo.
- **Al reiniciar el servidor, todos los datos se pierden.**

## Estructura

```
aula-backend/
├── server.js                 # Punto de entrada: HTTP + Socket.IO
├── test-integration.mjs      # Pruebas de integración
├── src/
│   ├── config.js             # Variables de entorno
│   ├── app.js                # App Express
│   ├── store.js              # Estado en memoria (Map)
│   ├── auth.js               # Login y middleware del docente
│   ├── sockets.js            # Lógica de Socket.IO
│   └── routes/
│       ├── auth.js           # /api/auth
│       └── exercises.js      # /api/exercises
```
