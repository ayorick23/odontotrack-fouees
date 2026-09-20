from django.apps import AppConfig
from django.db.models.signals import post_migrate


def _sync_acl_after_migrate(sender, **kwargs):
    from django.db import connection

    from .services import sync_acl

    tables = connection.introspection.table_names()
    if "accounts_role" not in tables or "accounts_aclpermission" not in tables:
        return
    sync_acl()


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"

    def ready(self):
        post_migrate.connect(
            _sync_acl_after_migrate,
            sender=self,
            dispatch_uid="accounts_sync_acl",
        )
