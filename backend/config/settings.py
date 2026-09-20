"""
Configuración principal del proyecto Django "config" (backend de
OdontoTrack FOUEES).

Este archivo lee la configuración sensible (SECRET_KEY, credenciales de
base de datos, etc.) desde variables de entorno usando python-decouple,
en vez de tenerla escrita directamente aquí. Así cada desarrollador (o
Docker) puede usar sus propios valores sin tocar el código y sin subir
secretos al repositorio. Ver el archivo .env.example en la raíz del
proyecto para la lista completa de variables esperadas.
"""

from datetime import timedelta
from pathlib import Path

from decouple import Csv, config

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config("DJANGO_SECRET_KEY", default="django-insecure-change-me-in-env")

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config("DJANGO_DEBUG", default=True, cast=bool)

ALLOWED_HOSTS = config("DJANGO_ALLOWED_HOSTS", default="localhost,127.0.0.1", cast=Csv())


# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Librerías de terceros
    "rest_framework",
    "corsheaders",
    "drf_spectacular",
    # Apps propias del proyecto
    "accounts.apps.AccountsConfig",
    "patients",
    "assignments",
    "clinical_records",
    "dashboard",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # CorsMiddleware debe ir antes de CommonMiddleware para que las
    # cabeceras CORS se agreguen correctamente en todas las respuestas.
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# Modelo de usuario personalizado.
# IMPORTANTE: esto debe existir ANTES de correr la primera migración.
# Cambiar AUTH_USER_MODEL después de migrar requiere recrear la base
# de datos, por eso se define desde el inicio del proyecto.
AUTH_USER_MODEL = "accounts.User"


# Database
# https://docs.djangoproject.com/en/6.0/ref/settings/#databases
# Todos los valores vienen de variables de entorno (ver .env.example)
# para que cada desarrollador y Docker Compose puedan usar su propia
# configuración sin editar este archivo ni subir credenciales al repo.

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME", default="odontotrack"),
        "USER": config("DB_USER", default="odontotrack"),
        "PASSWORD": config("DB_PASSWORD", default="odontotrack"),
        "HOST": config("DB_HOST", default="localhost"),
        "PORT": config("DB_PORT", default="5432"),
    }
}


# Password validation
# https://docs.djangoproject.com/en/6.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# Internationalization
# https://docs.djangoproject.com/en/6.0/topics/i18n/

LANGUAGE_CODE = "es"

TIME_ZONE = "America/El_Salvador"

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.0/howto/static-files/

STATIC_URL = "static/"

# Fotos de paciente. El serving HTTP y el upload se agregan aparte.
# MEDIA_ROOT relativo a BASE_DIR si no es una ruta absoluta.
MEDIA_URL = config("MEDIA_URL", default="/media/")
_media_root = config("MEDIA_ROOT", default="media")
MEDIA_ROOT = Path(_media_root) if Path(_media_root).is_absolute() else BASE_DIR / _media_root

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# Django REST Framework
# Por defecto, todos los endpoints requieren autenticación vía JWT.
# Se puede sobreescribir permiso por permiso en cada vista si hace falta.

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "OdontoTrack FOUEES API",
    "DESCRIPTION": (
        "Banco digital de pacientes de la Facultad de Odontología "
        "de la Universidad Evangélica de El Salvador (FOUEES). "
        "Para probar endpoints autenticados: POST /api/auth/token/, "
        "luego Authorize con el access token (Bearer)."
    ),
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": r"/api/",
    "COMPONENT_SPLIT_REQUEST": True,
    "TAGS": [
        {"name": "health", "description": "Chequeo de que la API está viva."},
        {"name": "auth", "description": "Login JWT y refresh del access token."},
        {"name": "accounts", "description": "Usuarios del sistema."},
        {"name": "patients", "description": "Directorio de pacientes."},
        {"name": "assignments", "description": "Asignación paciente-estudiante."},
        {"name": "clinical-records", "description": "Expediente clínico."},
        {"name": "dashboard", "description": "KPIs e indicadores."},
    ],
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=config("JWT_ACCESS_MINUTES", default=60, cast=int),
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=config("JWT_REFRESH_DAYS", default=1, cast=int),
    ),
    "ROTATE_REFRESH_TOKENS": True,
}


# django-cors-headers
# Permite que el frontend (React + Vite, corriendo en localhost:5173 por
# defecto) pueda hacer peticiones a esta API durante el desarrollo local.

CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:5173,http://127.0.0.1:5173",
    cast=Csv(),
)
