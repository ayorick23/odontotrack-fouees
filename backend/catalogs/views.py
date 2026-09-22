from django.db.models import ProtectedError
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated

from accounts.permissions import HasRequiredAcl

from .models import ClinicalArea, ClinicalTreatment
from .serializers import ClinicalAreaSerializer, ClinicalTreatmentSerializer


class ClinicalAreaViewSet(viewsets.ModelViewSet):
    queryset = ClinicalArea.objects.prefetch_related("treatments").all()
    serializer_class = ClinicalAreaSerializer
    permission_classes = [IsAuthenticated, HasRequiredAcl]
    pagination_class = None
    acl_permissions = {
        "list": ("catalogs.view", "patients.view"),
        "retrieve": ("catalogs.view", "patients.view"),
        "create": "catalogs.create",
        "update": "catalogs.edit",
        "partial_update": "catalogs.edit",
        "destroy": "catalogs.delete",
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.query_params.get("active") == "1":
            return queryset.filter(is_active=True)
        return queryset

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError as exc:
            raise ValidationError(
                "No se puede eliminar un área que ya está asignada a pacientes."
            ) from exc


class ClinicalTreatmentViewSet(viewsets.ModelViewSet):
    queryset = ClinicalTreatment.objects.select_related("area").all()
    serializer_class = ClinicalTreatmentSerializer
    permission_classes = [IsAuthenticated, HasRequiredAcl]
    pagination_class = None
    acl_permissions = {
        "list": ("catalogs.view", "patients.view"),
        "retrieve": ("catalogs.view", "patients.view"),
        "create": "catalogs.create",
        "update": "catalogs.edit",
        "partial_update": "catalogs.edit",
        "destroy": "catalogs.delete",
    }

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError as exc:
            raise ValidationError(
                "No se puede eliminar un tratamiento que ya está asignado a pacientes."
            ) from exc
