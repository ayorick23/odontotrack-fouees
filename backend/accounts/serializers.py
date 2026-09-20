from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Role
from .permissions_catalog import all_permission_names
from .services import unique_role_slug

User = get_user_model()


class EmailOrUsernameTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Acepta username o email en el campo username (o un campo email aparte)."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields[self.username_field].required = False
        self.fields["email"] = serializers.EmailField(required=False, write_only=True)

    def validate(self, attrs):
        identifier = attrs.get(self.username_field) or attrs.get("email")
        if not identifier:
            raise serializers.ValidationError(
                {self.username_field: "Indica username o email."}
            )

        user = (
            User.objects.filter(username__iexact=identifier).first()
            or User.objects.filter(email__iexact=identifier).first()
        )
        if user is not None:
            attrs[self.username_field] = user.get_username()
        else:
            attrs[self.username_field] = identifier

        attrs.pop("email", None)
        return super().validate(attrs)


class UserSerializer(serializers.ModelSerializer):
    """Listado y detalle. El password no se lee ni se escribe aquí."""

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "role"]
        read_only_fields = ["id"]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    email = serializers.EmailField(
        validators=[
            UniqueValidator(
                queryset=User.objects.all(),
                message="Ya existe un usuario con este correo.",
            )
        ],
    )
    role = serializers.ChoiceField(choices=User.Role.choices)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "password",
            "first_name",
            "last_name",
            "role",
        ]
        read_only_fields = ["id"]
        extra_kwargs = {
            "username": {"required": True},
            "email": {"required": True},
            "first_name": {"required": True},
            "last_name": {"required": True},
        }

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class MeSerializer(UserSerializer):
    permissions = serializers.ListField(child=serializers.CharField(), read_only=True)

    class Meta(UserSerializer.Meta):
        fields = [*UserSerializer.Meta.fields, "permissions"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["permissions"] = sorted(instance.acl_codenames)
        return data


class RoleSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = ["id", "name", "slug", "description", "is_system", "permissions"]
        read_only_fields = ["id", "is_system", "slug"]

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_permissions(self, instance):
        return list(
            instance.permissions.order_by("name").values_list("name", flat=True)
        )

    def validate(self, attrs):
        raw = self.initial_data.get("permissions", serializers.empty)
        if raw is serializers.empty:
            return attrs
        if not isinstance(raw, list) or not all(isinstance(item, str) for item in raw):
            raise serializers.ValidationError(
                {"permissions": "Debe ser una lista de nombres `{modulo}.{accion}`."}
            )
        unique_names = list(dict.fromkeys(raw))
        unknown = [name for name in unique_names if name not in all_permission_names()]
        if unknown:
            raise serializers.ValidationError(
                {
                    "permissions": (
                        "Permisos que no existen en el catálogo: "
                        f"{', '.join(unknown)}"
                    )
                }
            )
        attrs["permissions"] = unique_names
        return attrs

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError("El nombre es obligatorio.")
        return name

    def create(self, validated_data):
        permission_names = validated_data.pop("permissions", [])
        role = Role.objects.create(
            name=validated_data["name"],
            slug=unique_role_slug(validated_data["name"]),
            description=validated_data.get("description", ""),
            is_system=False,
        )
        role.sync_permissions(permission_names)
        return role

    def update(self, instance, validated_data):
        permission_names = validated_data.pop("permissions", None)
        instance = super().update(instance, validated_data)
        if permission_names is not None:
            instance.sync_permissions(permission_names)
        return instance
