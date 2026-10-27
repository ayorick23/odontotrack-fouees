from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Notification, Role
from .permissions import HasRequiredAcl
from .permissions_catalog import catalog_payload
from .serializers import (
    ChangeOwnPasswordSerializer,
    EmailOrUsernameTokenObtainPairSerializer,
    MeSerializer,
    NotificationSerializer,
    RoleSerializer,
    SetPasswordSerializer,
    StudentListSerializer,
    UserCreateSerializer,
    UserSerializer,
)
from .services import assert_can_delete_user, assert_can_manage_user

User = get_user_model()


@extend_schema(tags=["auth"])
class EmailOrUsernameTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailOrUsernameTokenObtainPairSerializer


@extend_schema(tags=["accounts"])
class UserViewSet(viewsets.ModelViewSet):
    """
    Listado de usuarios. Alta y edición según `users.create` / `users.edit`.
    GET /me y POST /me/password no exigen permiso: cualquier autenticado
    lee su perfil y cambia su propia contraseña. Las reglas que el ACL no
    cubre (cuentas admin, auto-bloqueo, borrar con historial) están en
    accounts/services.py.
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
        "set_password": "users.edit",
    }

    def _students_only(self):
        """
        Quien lee usuarios solo con `students.view` (docente, recepción) ve
        estudiantes y nada más, en el listado y en el detalle (ODO-16). Se
        decide por quién pregunta, no por el filtro ?role= que mande.
        """
        if self.action not in ("list", "retrieve"):
            return False
        if getattr(self, "swagger_fake_view", False):
            return False
        return not self.request.user.has_acl("users.view")

    def get_queryset(self):
        queryset = User.objects.all().order_by("id")
        if self._students_only():
            return queryset.filter(role=User.Role.ESTUDIANTE)
        if self.action != "list":
            return queryset
        params = self.request.query_params
        role = params.get("role")
        if role in User.Role.values:
            queryset = queryset.filter(role=role)
        is_active = params.get("is_active")
        if is_active in ("true", "false"):
            queryset = queryset.filter(is_active=is_active == "true")
        for term in params.get("search", "").split():
            queryset = queryset.filter(
                Q(username__icontains=term)
                | Q(email__icontains=term)
                | Q(first_name__icontains=term)
                | Q(last_name__icontains=term)
            )
        return queryset

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action == "me":
            return MeSerializer
        if self._students_only():
            return StudentListSerializer
        return UserSerializer

    def perform_create(self, serializer):
        assert_can_manage_user(
            self.request.user, None, new_role=serializer.validated_data.get("role")
        )
        serializer.save()

    def perform_update(self, serializer):
        data = serializer.validated_data
        assert_can_manage_user(
            self.request.user,
            serializer.instance,
            new_role=data.get("role"),
            new_is_active=data.get("is_active"),
        )
        serializer.save()

    def perform_destroy(self, instance):
        assert_can_delete_user(self.request.user, instance)
        instance.delete()

    @action(detail=False, methods=["get"])
    def me(self, request):
        serializer = MeSerializer(request.user)
        return Response(serializer.data)

    @extend_schema(request=ChangeOwnPasswordSerializer, responses={204: None})
    @action(detail=False, methods=["post"], url_path="me/password")
    def change_own_password(self, request):
        user = request.user
        payload = ChangeOwnPasswordSerializer(data=request.data, context={"user": user})
        payload.is_valid(raise_exception=True)
        user.set_password(payload.validated_data["new_password"])
        user.save(update_fields=["password"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=SetPasswordSerializer, responses={204: None})
    @action(detail=True, methods=["post"], url_path="set-password")
    def set_password(self, request, pk=None):
        target = self.get_object()
        assert_can_manage_user(request.user, target)
        payload = SetPasswordSerializer(data=request.data, context={"user": target})
        payload.is_valid(raise_exception=True)
        target.set_password(payload.validated_data["password"])
        target.save(update_fields=["password"])
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["accounts"])
class RoleViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """CRUD de roles. Los de sistema no se eliminan."""

    queryset = Role.objects.prefetch_related("permissions").all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, HasRequiredAcl]
    pagination_class = None
    acl_permissions = {
        "list": "roles.view",
        "retrieve": "roles.view",
        "create": "roles.create",
        "update": "roles.edit",
        "partial_update": "roles.edit",
        "destroy": "roles.delete",
        "catalog": ("roles.view", "roles.create", "roles.edit"),
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


@extend_schema(tags=["accounts"])
class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    Avisos in-app del usuario autenticado (ODO-68). Cada quien ve solo los
    suyos; no hay alta por API: los crean los servicios de cada app.
    `?unread=true` deja solo los no leídos.
    """

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated, HasRequiredAcl]
    # Singular a propósito: cubre también las @action de abajo.
    acl_permission = "notifications.view"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Notification.objects.none()
        queryset = Notification.objects.filter(recipient=self.request.user)
        if self.request.query_params.get("unread") == "true":
            queryset = queryset.filter(read_at__isnull=True)
        return queryset

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        count = self.get_queryset().filter(read_at__isnull=True).count()
        return Response({"count": count})

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        notification = self.get_object()
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at"])
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        updated = (
            self.get_queryset()
            .filter(read_at__isnull=True)
            .update(read_at=timezone.now())
        )
        return Response({"updated": updated})

