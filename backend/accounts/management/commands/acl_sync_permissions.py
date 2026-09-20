from django.core.management.base import BaseCommand

from accounts.services import sync_acl


class Command(BaseCommand):
    help = (
        "Sincroniza permisos `{modulo}.{accion}` del catálogo a la BD. "
        "No crear permisos a mano."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset-defaults",
            action="store_true",
            help="Vuelve a aplicar la matriz por defecto de los roles de sistema.",
        )

    def handle(self, *args, **options):
        result = sync_acl(reset_role_defaults=options["reset_defaults"])
        self.stdout.write(
            self.style.SUCCESS(
                "ACL sincronizado: "
                f"{result['permissions_total']} permisos, "
                f"{result['permissions_created']} nuevos, "
                f"{result['roles_created']} roles creados, "
                f"{result['role_defaults_applied']} matrices por defecto."
            )
        )
