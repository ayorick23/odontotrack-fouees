"""
Edición del propio perfil: PATCH /api/accounts/users/me/.

Cada usuario cambia solo su foto, nombre y apellido. Correo, usuario, rol y
estado de la cuenta quedan fuera a propósito: los gestiona un admin desde
Usuarios (el correo es el institucional con el que se inicia sesión).
"""

from rest_framework import serializers

from patients.serializers import PatientPhotoField

from .models import User


class ProfilePhotoField(PatientPhotoField):
    """Misma validación que la foto de paciente: hasta 2 MB, JPG, PNG o WebP."""


class ProfileUpdateSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(
        max_length=150, error_messages={"blank": "El nombre es obligatorio."}
    )
    last_name = serializers.CharField(
        max_length=150, error_messages={"blank": "El apellido es obligatorio."}
    )
    # null (JSON) o "" (multipart) quitan la foto.
    photo = ProfilePhotoField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = ["first_name", "last_name", "photo"]

    def update(self, instance, validated_data):
        previous = instance.photo.name if instance.photo else None
        instance = super().update(instance, validated_data)
        current = instance.photo.name if instance.photo else None
        # Al reemplazar o quitar la foto se borra el archivo viejo del disco.
        if "photo" in validated_data and previous and previous != current:
            User._meta.get_field("photo").storage.delete(previous)
        return instance
