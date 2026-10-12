from rest_framework.routers import DefaultRouter

from .views import NotificationViewSet, RoleViewSet, UserViewSet

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")
router.register("roles", RoleViewSet, basename="role")
router.register("notifications", NotificationViewSet, basename="notification")

urlpatterns = router.urls
