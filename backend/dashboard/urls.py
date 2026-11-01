from django.urls import path

from .views import (
    DashboardIndicatorsView,
    DashboardOverviewView,
    DashboardSeriesView,
    DashboardSummaryView,
)

urlpatterns = [
    path("overview/", DashboardOverviewView.as_view(), name="dashboard-overview"),
    path("summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("series/", DashboardSeriesView.as_view(), name="dashboard-series"),
    path(
        "indicators/",
        DashboardIndicatorsView.as_view(),
        name="dashboard-indicators",
    ),
]
