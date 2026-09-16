from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Usuario personalizado de la plataforma.

    Extendemos AbstractUser (en vez de usar el User por defecto de Django)
    para poder agregar el campo "role" desde el inicio del proyecto.
    Cambiar el modelo de usuario después de haber corrido migraciones es
    muy complicado en Django, así que esto se decidió desde el día uno.
    """

    class Role(models.TextChoices):
        ADMIN = "admin", "Administrador"
        DOCENTE = "docente", "Docente supervisor"
        ESTUDIANTE = "estudiante", "Estudiante"
        RECEPCION = "recepcion", "Recepción / Administrativo"
        SOPORTE = "soporte", "Soporte técnico"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.ESTUDIANTE,
        help_text="Rol del usuario dentro del sistema. Define permisos y pantallas visibles.",
    )

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.role})"
