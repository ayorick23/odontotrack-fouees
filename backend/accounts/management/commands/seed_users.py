from django.core.management.base import BaseCommand, CommandError
from accounts.models import User
from django.conf import settings

class Command(BaseCommand):
    help = "Crea un usuario de prueba por cada rol (admin, docente, estudiante,recepcion, soporte). Solo para desarrollo local."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Comando no disponible en produccion.")

        password = settings.SEED_USER_PASSWORD
        if not password:
            raise CommandError("Falta declarar SEED_USER_PASSWORD en .env ")

        datos_usuarios = [{
            "username": "valeriamz",
            "email": "valeriamz@fouees.edu.sv",
            "first_name": "Valeria",
            "last_name": "Martinez",
            "role": User.Role.ADMIN,
            "is_staff": True,
            "is_superuser": True,
        },{
            "username": "mariahz",
            "email": "mariahz@fouees.edu.sv",
            "first_name": "Maria",
            "last_name": "Hernandez",
            "role": User.Role.DOCENTE,
        },{
            "username": "luciazd",
            "email": "luciazd@fouees.edu.sv",
            "first_name": "Lucia",
            "last_name": "Zepeda",
            "role": User.Role.ESTUDIANTE,
        },{
            "username": "samuelpr",
            "email": "samuelpr@fouees.edu.sv",
            "first_name": "Samuel",
            "last_name": "Perez",
            "role": User.Role.SOPORTE,
        },{
            "username": "robertogr",
            "email": "robertogr@fouees.edu.sv",
            "first_name": "Roberto",
            "last_name": "Garcia",
            "role": User.Role.RECEPCION,
        }]

        self.stdout.write("Creando usuarios de prueba...")

        for usuario in datos_usuarios:
            username = usuario.get("username")

            obj, create = User.objects.get_or_create(
                username = username,
                defaults = usuario,
            )

            if create:
                obj.set_password(password)
                obj.save()
                self.stdout.write(self.style.SUCCESS(f"Usuario creado: {username}"))
            else :
                self.stdout.write(
                    self.style.WARNING(f"El usuario ya existia {username}")
                )