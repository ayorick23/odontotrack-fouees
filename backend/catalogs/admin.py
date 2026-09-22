from django.contrib import admin

from .models import ClinicalArea, ClinicalTreatment


class ClinicalTreatmentInline(admin.TabularInline):
    model = ClinicalTreatment
    extra = 0
    fields = ("name", "slug", "is_active", "sort_order")
    readonly_fields = ("slug",)


@admin.register(ClinicalArea)
class ClinicalAreaAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active", "sort_order")
    list_filter = ("is_active",)
    search_fields = ("name", "slug")
    readonly_fields = ("slug",)
    inlines = (ClinicalTreatmentInline,)


@admin.register(ClinicalTreatment)
class ClinicalTreatmentAdmin(admin.ModelAdmin):
    list_display = ("name", "area", "slug", "is_active", "sort_order")
    list_filter = ("area", "is_active")
    search_fields = ("name", "slug")
    readonly_fields = ("slug",)
