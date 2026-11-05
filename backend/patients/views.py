from django.contrib.auth import get_user_model
from django.db.models import Count
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import HasRequiredAcl, RecepcionCannotEditAssignedPatient
from assignments.models import Assignment

from .exports import patients_csv_response
from .models import Patient
from .filters import PatientSearchFilter
from .permissions import EstudianteEditsOwnOrAvailablePatient
from .practices import PracticeMatch
from .serializers import PatientListSerializer, PatientSerializer

User = get_user_model()

# Orden del directorio (?ordering=name, -created_at, ...). Lista cerrada:
# solo columnas que la tabla muestra, nunca campos arbitrarios. "id" al
# final desempata para que la paginación no repita ni salte filas.
DIRECTORY_ORDERINGS = {
    "name": ("first_name", "last_name"),
    "created_at": ("created_at",),
}


def directory_ordering(value: str | None) -> tuple[str, ...]:
    """Campos de `order_by` para `value`; sin valor o desconocido, por id."""
    value = (value or "").strip()
    descending = value.startswith("-")
    fields = DIRECTORY_ORDERINGS.get(value.removeprefix("-"))
    if fields is None:
        return ("id",)
    prefix = "-" if descending else ""
    return tuple(f"{prefix}{field}" for field in fields) + (f"{prefix}id",)


class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    permission_classes = [
        IsAuthenticated,
        HasRequiredAcl,
        RecepcionCannotEditAssignedPatient,
        EstudianteEditsOwnOrAvailablePatient,
    ]
    acl_permissions = {
        "list": "patients.view",
        "retrieve": "patients.view",
        "create": "patients.create",
        "update": "patients.edit",
        "partial_update": "patients.edit",
        "destroy": "patients.delete",
        "assignees": "patients.view",
        "export": "patients.export",
        "available": ("assignments.claim", "assignments.assign_student"),
    }
    # Nombre sin acentos, documento, teléfono y pieza/tratamiento indicado.
    filter_backends = [PatientSearchFilter]

    def get_queryset(self):
        # Lista aparte del directorio: un scoping futuro por rol no debe
        # ocultar los pendientes sin asignación.
        params = self.request.query_params
        if self.action == "available":
            return (
                Patient.objects.prefetch_related("assignments__student")
                .select_related("clinical_area", "clinical_treatment", "odontogram")
                .available()
                .by_clinical_area(params.get("clinical_area"))
                .by_indicated_practice(params.get("tooth"), params.get("treatment"))
                # Mismo ?ordering= del directorio; la pantalla de
                # asignaciones pide created_at (más tiempo en espera primero).
                .order_by(*directory_ordering(params.get("ordering")))
            )
        queryset = Patient.objects.prefetch_related("assignments__student")
        if self.action not in ("list", "export"):
            # Solo la ficha muestra created_by_name y first_diagnosis_by.
            queryset = queryset.select_related("created_by").prefetch_related(
                "diagnoses__student"
            )
        return (
            self._directory_filters(queryset)
            .select_related("clinical_area", "clinical_treatment", "odontogram")
            .by_case_status(params.get("case_status"))
            .order_by(*directory_ordering(params.get("ordering")))
        )

    def _directory_filters(self, queryset):
        """Filtros del directorio salvo el estado del caso: los conteos de
        las pestañas de estado salen de aquí."""
        params = self.request.query_params
        return (
            queryset.visible_to(self.request.user)
            .in_period(params.get("period"))
            .by_clinical_area(params.get("clinical_area"))
            .by_assignee(params.get("assigned_to"))
            .by_indicated_practice(params.get("tooth"), params.get("treatment"))
        )

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        if isinstance(response.data, dict):
            response.data["status_counts"] = self._status_counts()
        return response

    def _status_counts(self) -> dict[str, int]:
        """Cuántos pacientes habría en cada estado con la búsqueda y los
        demás filtros actuales (pestañas del directorio)."""
        queryset = self.filter_queryset(self._directory_filters(Patient.objects.all()))
        rows = (
            queryset.order_by()
            .values("case_status")
            .annotate(total=Count("id", distinct=True))
        )
        counts = {status: 0 for status in Patient.CaseStatus.values}
        for row in rows:
            counts[row["case_status"]] = row["total"]
        return counts

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.action in ("list", "available"):
            # Para poner primero las prácticas que coinciden con lo buscado.
            context["practice_match"] = PracticeMatch.from_request(
                self.request.query_params,
                PatientSearchFilter().get_search_terms(self.request),
            )
        return context

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def get_serializer_class(self):
        if self.action == "list":
            return PatientListSerializer
        return PatientSerializer

    @action(detail=False, methods=["get"])
    def available(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        serializer = PatientListSerializer(
            page if page is not None else queryset,
            many=True,
            context=self.get_serializer_context(),
        )
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def export(self, request):
        """CSV del directorio con los mismos filtros y alcance que el listado."""
        return patients_csv_response(self.filter_queryset(self.get_queryset()))

    @action(detail=False, methods=["get"])
    def assignees(self, request):
        students = (
            User.objects.filter(
                role=User.Role.ESTUDIANTE,
                patient_assignments__status=Assignment.AssignmentStatus.ACTIVA,
            )
            .distinct()
            .order_by("last_name", "first_name", "id")
        )
        return Response(
            [
                {
                    "id": student.id,
                    "name": student.get_full_name() or student.username,
                }
                for student in students
            ]
        )
