from django.contrib import admin

from .models import Assignment


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = (
        "patient",
        "student",
        "assigned_date",
        "appointment_number",
        "priority",
        "status",
    )
    list_filter = ("status", "priority")
    search_fields = ("patient__first_name", "patient__last_name", "student__username")
