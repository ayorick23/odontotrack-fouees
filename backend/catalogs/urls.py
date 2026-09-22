from rest_framework.routers import DefaultRouter

from .views import ClinicalAreaViewSet, ClinicalTreatmentViewSet

router = DefaultRouter()
router.register("clinical-areas", ClinicalAreaViewSet, basename="clinical-area")
router.register(
    "clinical-treatments",
    ClinicalTreatmentViewSet,
    basename="clinical-treatment",
)

urlpatterns = router.urls
