from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ClinicalRecordViewSet, PatientOdontogramView

router = DefaultRouter()
router.register("", ClinicalRecordViewSet, basename="clinicalrecord")

urlpatterns = [
    path(
        "odontogram/<int:patient_id>/",
        PatientOdontogramView.as_view(),
        name="patient-odontogram",
    ),
    *router.urls,
]