from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Role
from .permissions import HasRequiredAcl
from .permissions_catalog import catalog_payload
from .serializers import (
    EmailOrUsernameTokenObtainPairSerializer,
    MeSerializer,
    RoleSerializer,
    UserCreateSerializer,
    UserSerializer,
)

User = get_user_model()


@extend_schema(tags=["auth"])
class EmailOrUsernameTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailOrUsernameTokenObtainPairSerializer


@extend_schema(tags=["accounts"])
class UserViewSet(viewsets.ModelViewSet):
    """
    Listado de usuarios. Alta y edición según `users.create` / `users.edit`.
    GET /me no exige users.view: cualquier autenticado lee su perfil y ACL.
    """

    queryset = User.objects.all().order_by("id")
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, HasRequiredAcl]
    acl_permissions = {
        "list": ("users.view", "students.view"),
        "retrieve": ("users.view", "students.view"),
        "create": "users.create",
        "update": "users.edit",
        "partial_update": "users.edit",
        "destroy": "users.delete",
    }

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action == "me":
            return MeSerializer
        return UserSerializer

    @action(detail=False, methods=["get"])
    def me(self, request):
        serializer = MeSerializer(request.user)
        return Response(serializer.data)


@extend_schema(tags=["accounts"])
class RoleViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Listado y matriz de permisos. Los roles de sistema no se borran."""

    queryset = Role.objects.prefetch_related("permissions").all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, HasRequiredAcl]
    pagination_class = None
    acl_permissions = {
        "list": "roles.view",
        "retrieve": "roles.view",
        "update": "roles.edit",
        "partial_update": "roles.edit",
        "destroy": "roles.delete",
        "catalog": "roles.view",
    }

    def perform_destroy(self, instance):
        if instance.is_system:
            raise ValidationError(
                "No se pueden eliminar los roles de sistema (admin, docente, estudiante, recepción, soporte)."
            )
        if User.objects.filter(role=instance.slug).exists():
            raise ValidationError(
                "No se puede eliminar un rol que todavía tiene usuarios asignados."
            )
        instance.delete()

    @action(detail=False, methods=["get"])
    def catalog(self, request):
        return Response({"catalog": catalog_payload()})
