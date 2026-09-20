from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import AclPermission, Role, User


@admin.register(AclPermission)
class AclPermissionAdmin(admin.ModelAdmin):
    list_display = ("name", "module", "action")
    search_fields = ("name",)
    list_filter = ("module",)
    readonly_fields = ("name", "module", "action")


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_system")
    search_fields = ("name", "slug")
    filter_horizontal = ("permissions",)
    readonly_fields = ("slug", "is_system")


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
