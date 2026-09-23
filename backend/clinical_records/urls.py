from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ClinicalEvolutionViewSet,
    DiagnosisViewSet,
    PatientOdontogramHistoryView,
    PatientOdontogramView,
    TreatmentViewSet,
)

router = DefaultRouter()
router.register("diagnoses", DiagnosisViewSet, basename="diagnosis")
router.register("treatments", TreatmentViewSet, basename="treatment")
router.register("evolution", ClinicalEvolutionViewSet, basename="clinicalevolution")

urlpatterns = [
    path(
        "odontogram/<int:patient_id>/",
        PatientOdontogramView.as_view(),
        name="patient-odontogram",
    ),
    path(
        "odontogram/<int:patient_id>/history/",
        PatientOdontogramHistoryView.as_view(),
        name="patient-odontogram-history",
    ),
    *router.urls,
]