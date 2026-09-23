from django.db.models import Count
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import IsAuthenticated

from accounts.permissions import HasRequiredAcl
from rest_framework.response import Response
from rest_framework.views import APIView

from assignments.models import Assignment
from clinical_records.models import Diagnostico, EvolucionClinica, Tratamiento
from patients.models import Patient

from .serializers import DashboardSeriesSerializer, DashboardSummarySerializer
from .services import build_dashboard_series


class DashboardSummaryView(APIView):
    """
    Vista de agregación con estadísticas generales del sistema.

    Este endpoint no tiene modelos propios: solo agrega datos de las
    apps patients, assignments y clinical_records. Los números que
    devuelve hoy son un placeholder simple; cuando se defina qué debe
    ver cada rol (admin, docente, estudiante) esto se separará en
    vistas más específicas.
    """

    permission_classes = [IsAuthenticated, HasRequiredAcl]
    acl_permission = "dashboard.view"

    @extend_schema(
        tags=["dashboard"],
        parameters=[
            OpenApiParameter(
                name="period",
                description="Filtra pacientes creados en el último mes (1m), 6 meses (6m) o año (1a).",
                required=False,
                type=str,
                enum=["1m", "6m", "1a"],
            ),
        ],
        responses=DashboardSummarySerializer,
    )
    def get(self, request):
        patients = Patient.objects.in_period(request.query_params.get("period"))
        data = {
            "total_patients": patients.count(),
            "total_assignments": Assignment.objects.count(),
            "total_clinical_records": (
                Diagnostico.objects.count()
                + Tratamiento.objects.count()
                + EvolucionClinica.objects.count()
            ),
            "patients_by_status": dict(
                patients.values_list("case_status").annotate(count=Count("id"))
            ),
        }
        return Response(data)


class DashboardSeriesView(APIView):
    permission_classes = [IsAuthenticated, HasRequiredAcl]
    acl_permission = "dashboard.view"

    @extend_schema(
        tags=["dashboard"],
        parameters=[
            OpenApiParameter(
                name="period",
                description="Filtra series del último mes (1m), 6 meses (6m) o año (1a).",
                required=False,
                type=str,
                enum=["1m", "6m", "1a"],
            ),
        ],
        responses=DashboardSeriesSerializer,
    )
    def get(self, request):
        return Response(build_dashboard_series(request.query_params.get("period")))
