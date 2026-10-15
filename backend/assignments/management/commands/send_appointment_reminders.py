from datetime import date

from django.core.management.base import BaseCommand, CommandError

from assignments.services import send_appointment_reminders


class Command(BaseCommand):
    help = (
        "Avisa in-app a cada estudiante de sus citas programadas para mañana "
        "(ODO-71). Correr una vez al día; volver a correrlo no duplica avisos."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--date",
            help="Día de las citas a recordar (AAAA-MM-DD). Por defecto, mañana.",
        )

    def handle(self, *args, **options):
        day = None
        if options["date"]:
            try:
                day = date.fromisoformat(options["date"])
            except ValueError as error:
                raise CommandError("--date debe tener el formato AAAA-MM-DD.") from error
        sent = send_appointment_reminders(day)
        self.stdout.write(self.style.SUCCESS(f"Recordatorios enviados: {sent}."))
