from django.contrib import admin

from .models import Patient


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = (
        "full_name",
        "dui",
        "carnet",
        "clinical_area",
        "case_status",
        "created_at",
    )
    list_filter = ("case_status", "clinical_area")
    search_fields = ("first_name", "last_name", "dui", "carnet")

    @admin.display(description="Nombre completo")
    def full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"
