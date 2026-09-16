from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer básico del usuario. No expone password ni permite
    escribirlo aquí a propósito: la creación/cambio de contraseña se
    manejará en un endpoint dedicado más adelante.
    """

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "role"]
        read_only_fields = ["id"]
