from django.db.models import Count
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from assignments.models import Assignment
from clinical_records.models import ClinicalRecord
from patients.models import Patient


class DashboardSummaryView(APIView):
    """
    Vista de agregación con estadísticas generales del sistema.

    Este endpoint no tiene modelos propios: solo agrega datos de las
    apps patients, assignments y clinical_records. Los números que
    devuelve hoy son un placeholder simple; cuando se defina qué debe
    ver cada rol (admin, docente, estudiante) esto se separará en
    vistas más específicas.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = {
            "total_patients": Patient.objects.count(),
            "total_assignments": Assignment.objects.count(),
            "total_clinical_records": ClinicalRecord.objects.count(),
            "patients_by_status": dict(
                Patient.objects.values_list("case_status").annotate(count=Count("id"))
            ),
        }
        return Response(data)
