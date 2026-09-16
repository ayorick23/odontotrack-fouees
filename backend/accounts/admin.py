from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    """
    Registramos el modelo de usuario en el admin de Django para que el
    equipo pueda crear/editar usuarios y asignar roles sin necesidad de
    una pantalla propia mientras el frontend no la tenga lista.
    """

    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Rol del sistema", {"fields": ("role",)}),
    )
    list_display = ("username", "email", "first_name", "last_name", "role", "is_staff")
    list_filter = DjangoUserAdmin.list_filter + ("role",)
