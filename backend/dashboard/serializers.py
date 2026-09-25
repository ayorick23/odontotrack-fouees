from rest_framework import serializers


class DashboardSummarySerializer(serializers.Serializer):
    total_patients = serializers.IntegerField()
    total_assignments = serializers.IntegerField()
    total_clinical_records = serializers.IntegerField()
    patients_by_status = serializers.DictField(child=serializers.IntegerField())
    pending_validations = serializers.IntegerField()
    average_wait_days = serializers.FloatField(allow_null=True)


class DashboardMonthPointSerializer(serializers.Serializer):
    month = serializers.CharField()
    label = serializers.CharField()
    patients = serializers.IntegerField()
    assignments = serializers.IntegerField()


class DashboardAreaStatusSerializer(serializers.Serializer):
    area = serializers.CharField()
    pendiente = serializers.IntegerField()
    en_proceso = serializers.IntegerField()
    finalizado = serializers.IntegerField()


class DashboardSeriesSerializer(serializers.Serializer):
    months = DashboardMonthPointSerializer(many=True)
    by_area = DashboardAreaStatusSerializer(many=True)
