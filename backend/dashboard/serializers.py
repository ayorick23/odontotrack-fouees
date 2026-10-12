from rest_framework import serializers


class IndicatorSerializer(serializers.Serializer):
    percent = serializers.FloatField(allow_null=True)
    count = serializers.IntegerField()
    total = serializers.IntegerField()


class DashboardIndicatorsSerializer(serializers.Serializer):
    """Fórmulas documentadas en dashboard/indicators.py. None = no aplica."""

    digitalization = IndicatorSerializer(allow_null=True)
    validated_diagnoses = IndicatorSerializer(allow_null=True)
    cases_with_validated_diagnosis = IndicatorSerializer(allow_null=True)


class DashboardSummarySerializer(serializers.Serializer):
    total_patients = serializers.IntegerField()
    total_assignments = serializers.IntegerField()
    total_clinical_records = serializers.IntegerField()
    patients_by_status = serializers.DictField(child=serializers.IntegerField())


class DashboardMonthPointSerializer(serializers.Serializer):
    month = serializers.CharField()
    label = serializers.CharField()
    patients = serializers.IntegerField()
    pendiente = serializers.IntegerField()
    en_proceso = serializers.IntegerField()
    finalizado = serializers.IntegerField()
    assignments = serializers.IntegerField()


class DashboardStatusSliceSerializer(serializers.Serializer):
    status = serializers.CharField()
    label = serializers.CharField()
    count = serializers.IntegerField()


class DashboardSeriesSerializer(serializers.Serializer):
    months = DashboardMonthPointSerializer(many=True)
    by_status = DashboardStatusSliceSerializer(many=True)
