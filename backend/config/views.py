from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@extend_schema(
    tags=["health"],
    responses={
        200: inline_serializer(
            name="HealthCheck",
            fields={"status": serializers.CharField()},
        )
    },
)
@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """
    Endpoint simple para confirmar que la API está viva. Útil para
    probar que el backend levantó bien en Docker, y como base para
    futuros chequeos de salud (ej. verificar conexión a la base de datos).
    """
    return Response({"status": "ok"})
