# OdontoTrack FOUEES

Plataforma web para la Facultad de Odontología de la Universidad
Evangélica de El Salvador (FOUEES): un banco digital de pacientes que
permite registrar pacientes, asignarlos a estudiantes, dar seguimiento
a diagnósticos y tratamientos, y ofrecer dashboards a administrativos,
docentes y estudiantes.

Roles del sistema: **administrador**, **docente supervisor**,
**estudiante**, **recepción/administrativo** y **soporte técnico**.

## Stack

- **Backend:** Django + Django REST Framework (API REST pura, sin templates)
- **Base de datos:** PostgreSQL
- **Frontend:** React + Vite + TypeScript
- **Autenticación:** JWT (`djangorestframework-simplejwt`), backend y frontend desacoplados
- **Entorno local:** Docker Compose

## Estructura del repositorio

```
odontotrack-fouees/
├── backend/            # Proyecto Django (API REST)
├── frontend/           # Proyecto React con Vite
├── docker-compose.yml  # Orquesta db + backend + frontend
├── .env.example        # Variables de entorno necesarias (sin valores reales)
├── .gitignore
└── README.md
```

## Requisitos previos

Solo necesitas tener instalado:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (incluye Docker Compose)
- [Git](https://git-scm.com/)

No necesitas instalar Python, Node ni PostgreSQL en tu máquina: todo
corre dentro de contenedores.

## Cómo levantar el entorno local (paso a paso)

1. **Clona el repositorio:**

   ```bash
   git clone <url-del-repositorio>
   cd odontotrack-fouees
   ```

2. **Crea tu archivo de variables de entorno** copiando el ejemplo:

   ```bash
   cp .env.example .env
   ```

   Puedes dejar los valores por defecto para desarrollo local; no hace
   falta editarlos a menos que tengas un conflicto de puertos.

3. **Levanta todo con Docker Compose:**

   ```bash
   docker compose up --build
   ```

   La primera vez tardará varios minutos porque descarga las imágenes
   base e instala las dependencias. Las siguientes veces será mucho
   más rápido.

   Esto levanta 3 servicios:
   - `db` → PostgreSQL en el puerto `5432`
   - `backend` → API de Django en [http://localhost:8000](http://localhost:8000)
   - `frontend` → React (Vite) en [http://localhost:5173](http://localhost:5173)

   El backend espera automáticamente a que la base de datos esté lista
   y aplica las migraciones antes de arrancar el servidor.

4. **Verifica que el backend responde:**

   Abre [http://localhost:8000/api/health/](http://localhost:8000/api/health/)
   en tu navegador. Deberías ver `{"status": "ok"}`.

5. **Abre el frontend:**

   Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

6. **Crea un superusuario** (para entrar al admin de Django y gestionar
   datos mientras no exista una pantalla propia para todo). En otra
   terminal, con los contenedores ya corriendo:

   ```bash
   docker compose exec backend python manage.py createsuperuser
   ```

   Luego entra a [http://localhost:8000/admin/](http://localhost:8000/admin/)
   con ese usuario.

### Comandos útiles del día a día

```bash
docker compose up            # levantar todo (sin reconstruir imágenes)
docker compose up --build    # levantar todo, reconstruyendo si cambiaron dependencias
docker compose down          # apagar todo
docker compose logs -f backend    # ver logs del backend en tiempo real
docker compose logs -f frontend   # ver logs del frontend en tiempo real
docker compose exec backend python manage.py <comando>   # correr un comando de Django
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate
```

### Si agregas una dependencia nueva

- **Backend:** agrégala a `backend/requirements.txt` y corre `docker compose up --build backend`.
- **Frontend:** instálala normalmente con `npm install <paquete>` dentro de `frontend/` (o vía `docker compose exec frontend npm install <paquete>`) y confirma que `package.json`/`package-lock.json` quedaron actualizados antes de hacer commit.

## Flujo de trabajo con Git

- `main` → rama estable/protegida. Solo se llega aquí por merge desde `develop`.
- `develop` → rama de integración, donde se juntan las features antes de pasar a `main`.

Convención de nombres de rama:

- `feature/nombre-corto` → para funcionalidad nueva (ej. `feature/login-jwt`)
- `fix/nombre-corto` → para corrección de bugs (ej. `fix/validacion-paciente`)

Flujo sugerido: crea tu rama desde `develop`, trabaja ahí, y abre un
Pull Request de vuelta hacia `develop`.

## Gestión de tareas

Las tareas del equipo se gestionan en **Linear**, no en los Issues de
GitHub. Antes de empezar a trabajar en algo, revisa que exista (o crea)
la tarjeta correspondiente en Linear.
