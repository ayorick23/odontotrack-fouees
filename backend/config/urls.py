"""
Configuración de rutas principal del proyecto.

Todas las rutas de la API viven bajo el prefijo /api/. Cada app tiene
su propio archivo urls.py con sus rutas (normalmente usando un router
de DRF), y aquí solo las incluimos. Así, cuando se agregue una app
nueva, solo hay que agregar una línea aquí.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.views import EmailOrUsernameTokenObtainPairView

from .views import health_check

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health_check, name="health-check"),
    path(
        "api/schema/",
        SpectacularAPIView.as_view(permission_classes=[AllowAny]),
        name="schema",
    ),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(
            url_name="schema",
            permission_classes=[AllowAny],
        ),
        name="swagger-ui",
    ),
    path(
        "api/auth/token/",
        EmailOrUsernameTokenObtainPairView.as_view(),
        name="token_obtain_pair",
    ),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/accounts/", include("accounts.urls")),
    path("api/catalogs/", include("catalogs.urls")),
    path("api/patients/", include("patients.urls")),
    path("api/assignments/", include("assignments.urls")),
    path("api/appointments/", include("assignments.appointment_urls")),
    path("api/clinical-records/", include("clinical_records.urls")),
    path("api/dashboard/", include("dashboard.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
