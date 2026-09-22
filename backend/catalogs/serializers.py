from rest_framework import serializers

from .models import ClinicalArea, ClinicalTreatment


class ClinicalTreatmentSerializer(serializers.ModelSerializer):
    area = serializers.PrimaryKeyRelatedField(
        queryset=ClinicalArea.objects.all(),
    )

    class Meta:
        model = ClinicalTreatment
        fields = (
            "id",
            "slug",
            "name",
            "is_active",
            "sort_order",
            "area",
        )
        read_only_fields = ("id", "slug")

    def validate_name(self, value: str) -> str:
        name = value.strip()
        if not name:
            raise serializers.ValidationError("El nombre es obligatorio.")
        return name


class NestedTreatmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClinicalTreatment
        fields = ("id", "slug", "name", "is_active", "sort_order")
        read_only_fields = fields


class ClinicalAreaSerializer(serializers.ModelSerializer):
    treatments = NestedTreatmentSerializer(many=True, read_only=True)

    class Meta:
        model = ClinicalArea
        fields = (
            "id",
            "slug",
            "name",
            "is_active",
            "sort_order",
            "treatments",
        )
        read_only_fields = ("id", "slug", "treatments")

    def validate_name(self, value: str) -> str:
        name = value.strip()
        if not name:
            raise serializers.ValidationError("El nombre es obligatorio.")
        return name
