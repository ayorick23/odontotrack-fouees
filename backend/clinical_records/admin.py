from django.contrib import admin

from .models import Diagnostico, EvolucionClinica, Odontogram, OdontogramRevision, Tratamiento


@admin.register(Diagnostico)
class DiagnosticoAdmin(admin.ModelAdmin):
    list_display = ("patient", "student", "is_validated", "validated_by", "created_at")
    list_filter = ("is_validated",)
    search_fields = ("patient__first_name", "patient__last_name", "student__username")


@admin.register(Tratamiento)
class TratamientoAdmin(admin.ModelAdmin):
    list_display = ("patient", "clinical_area", "clinical_treatment", "created_at")
    list_filter = ("clinical_area",)
    search_fields = ("patient__first_name", "patient__last_name")


@admin.register(EvolucionClinica)
class EvolucionClinicaAdmin(admin.ModelAdmin):
    list_display = ("patient", "student", "date", "created_at")
    search_fields = ("patient__first_name", "patient__last_name", "student__username")


@admin.register(Odontogram)
class OdontogramAdmin(admin.ModelAdmin):
    list_display = ("patient", "placa", "sangrado", "sarro", "updated_at")
    search_fields = ("patient__first_name", "patient__last_name", "patient__dui")


@admin.register(OdontogramRevision)
class OdontogramRevisionAdmin(admin.ModelAdmin):
    list_display = ("odontogram", "created_by", "created_at")
    search_fields = (
        "odontogram__patient__first_name",
        "odontogram__patient__last_name",
    )
