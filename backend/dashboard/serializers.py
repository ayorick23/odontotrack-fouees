from rest_framework import serializers


class DashboardSummarySerializer(serializers.Serializer):
    total_patients = serializers.IntegerField()
    total_assignments = serializers.IntegerField()
    total_clinical_records = serializers.IntegerField()
    patients_by_status = serializers.DictField(child=serializers.IntegerField())
    pending_validations = serializers.IntegerField()


class DashboardMonthPointSerializer(serializers.Serializer):
    month = serializers.CharField()
    label = serializers.CharField()
    patients = serializers.IntegerField()
    assignments = serializers.IntegerField()


class DashboardAreaCountSerializer(serializers.Serializer):
    area = serializers.CharField()
    count = serializers.IntegerField()


class DashboardStudentLoadSerializer(serializers.Serializer):
    student = serializers.CharField()
    active_cases = serializers.IntegerField()


class DashboardSeriesSerializer(serializers.Serializer):
    months = DashboardMonthPointSerializer(many=True)
    pending_by_area = DashboardAreaCountSerializer(many=True)
    student_load = DashboardStudentLoadSerializer(many=True)
