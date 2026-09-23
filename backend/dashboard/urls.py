from django.urls import path

from .views import DashboardSeriesView, DashboardSummaryView

urlpatterns = [
    path("summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("series/", DashboardSeriesView.as_view(), name="dashboard-series"),
]
