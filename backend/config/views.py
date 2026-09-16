from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """
    Endpoint simple para confirmar que la API está viva. Útil para
    probar que el backend levantó bien en Docker, y como base para
    futuros chequeos de salud (ej. verificar conexión a la base de datos).
    """
    return Response({"status": "ok"})
