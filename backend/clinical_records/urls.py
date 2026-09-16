from rest_framework.routers import DefaultRouter

from .views import ClinicalRecordViewSet

router = DefaultRouter()
router.register("", ClinicalRecordViewSet, basename="clinicalrecord")

urlpatterns = router.urls
