from django.contrib import admin

from .models import ClinicalRecord


@admin.register(ClinicalRecord)
class ClinicalRecordAdmin(admin.ModelAdmin):
    list_display = ("patient", "student", "is_validated", "validated_by", "created_at")
    list_filter = ("is_validated",)
    search_fields = ("patient__first_name", "patient__last_name", "student__username")
