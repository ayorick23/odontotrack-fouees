"""Catálogo ACL: fuente de verdad de permisos `{modulo}.{accion}`.

No crear permisos a mano en BD. En desarrollo local, el comando
`acl_sync_permissions` carga este archivo en las tablas Role y
AclPermission. No corre al migrar ni en producción.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final


@dataclass(frozen=True)
class ActionSpec:
    key: str
    label: str


@dataclass(frozen=True)
class ModuleSpec:
    key: str
    label: str
    description: str
    actions: tuple[ActionSpec, ...]


@dataclass(frozen=True)
class SectionSpec:
    key: str
    label: str
    modules: tuple[ModuleSpec, ...]


@dataclass(frozen=True)
class SystemRoleSpec:
    slug: str
    name: str
    description: str
    permissions: frozenset[str] | None
    """None = todos los permisos del catálogo."""


VIEW = ActionSpec("view", "Ver")
CREATE = ActionSpec("create", "Crear")
EDIT = ActionSpec("edit", "Editar")
DELETE = ActionSpec("delete", "Eliminar")
EXPORT = ActionSpec("export", "Exportar")
VALIDATE = ActionSpec("validate", "Validar")
ASSIGN_STUDENT = ActionSpec("assign_student", "Asignar estudiante")
CHANGE_STATUS = ActionSpec("change_status", "Cambiar estado")
UPDATE = ActionSpec("update", "Actualizar")

PERMISSION_CATALOG: Final[tuple[SectionSpec, ...]] = (
    SectionSpec(
        key="principal",
        label="Principal",
        modules=(
            ModuleSpec(
                key="dashboard",
                label="Dashboard",
                description="Indicadores y resumen del banco de pacientes.",
                actions=(VIEW,),
            ),
        ),
    ),
    SectionSpec(
        key="pacientes",
        label="Pacientes y operaciones",
        modules=(
            ModuleSpec(
                key="patients",
                label="Pacientes",
                description="Directorio y ficha de datos básicos.",
                actions=(VIEW, CREATE, EDIT, DELETE, EXPORT),
            ),
            ModuleSpec(
                key="assignments",
                label="Asignaciones",
                description="Asignar paciente a estudiante, prioridad y estado del caso.",
                actions=(VIEW, CREATE, EDIT, ASSIGN_STUDENT, CHANGE_STATUS),
            ),
            ModuleSpec(
                key="calendar",
                label="Calendario",
                description="Vista de citas por rango de fechas.",
                actions=(VIEW, CREATE, EDIT),
            ),
        ),
    ),
    SectionSpec(
        key="clinico",
        label="Expediente clínico",
        modules=(
            ModuleSpec(
                key="clinical_records",
                label="Expediente clínico",
                description="Acceso general al expediente mientras diagnóstico, tratamiento y evolución conviven en la API.",
                actions=(VIEW, CREATE, EDIT),
            ),
            ModuleSpec(
                key="diagnoses",
                label="Diagnósticos",
                description="Carga de diagnóstico y validación del docente.",
                actions=(VIEW, CREATE, EDIT, VALIDATE),
            ),
            ModuleSpec(
                key="treatments",
                label="Tratamientos",
                description="Registro de tratamientos del caso.",
                actions=(VIEW, CREATE, EDIT),
            ),
            ModuleSpec(
                key="evolution",
                label="Evolución clínica",
                description="Notas de evolución del caso.",
                actions=(VIEW, CREATE, EDIT),
            ),
            ModuleSpec(
                key="odontogram",
                label="Odontograma",
                description="Odontograma FDI y marcas generales.",
                actions=(VIEW, UPDATE),
            ),
            ModuleSpec(
                key="supervision",
                label="Supervisión",
                description="Cola de casos para el docente supervisor.",
                actions=(VIEW,),
            ),
        ),
    ),
    SectionSpec(
        key="personas",
        label="Personas",
        modules=(
            ModuleSpec(
                key="students",
                label="Estudiantes",
                description="Listado de estudiantes para asignación y seguimiento.",
                actions=(VIEW,),
            ),
            ModuleSpec(
                key="users",
                label="Usuarios",
                description="Altas y edición de cuentas del sistema.",
                actions=(VIEW, CREATE, EDIT, DELETE),
            ),
        ),
    ),
    SectionSpec(
        key="sistema",
        label="Sistema",
        modules=(
            ModuleSpec(
                key="roles",
                label="Roles y permisos",
                description="Catálogo ACL y matriz de permisos por rol.",
                actions=(VIEW, CREATE, EDIT, DELETE),
            ),
            ModuleSpec(
                key="catalogs",
                label="Catálogos clínicos",
                description="Áreas clínicas y tratamientos del tarifario FOUEES.",
                actions=(VIEW, CREATE, EDIT, DELETE),
            ),
            ModuleSpec(
                key="support",
                label="Soporte técnico",
                description="Panel de mantenimiento. Sin escritura clínica.",
                actions=(VIEW,),
            ),
        ),
    ),
)


def permission_name(module: str, action: str) -> str:
    return f"{module}.{action}"


def iter_catalog_permissions() -> tuple[tuple[str, str, str], ...]:
    """Tuplas (name, module, action) del catálogo."""
    items: list[tuple[str, str, str]] = []
    for section in PERMISSION_CATALOG:
        for module in section.modules:
            for action in module.actions:
                items.append(
                    (permission_name(module.key, action.key), module.key, action.key)
                )
    return tuple(items)


def all_permission_names() -> frozenset[str]:
    return frozenset(name for name, _module, _action in iter_catalog_permissions())


def catalog_payload() -> list[dict]:
    """Jerarquía serializable para la UI de la matriz."""
    return [
        {
            "key": section.key,
            "label": section.label,
            "modules": [
                {
                    "key": module.key,
                    "label": module.label,
                    "description": module.description,
                    "actions": [
                        {
                            "key": action.key,
                            "label": action.label,
                            "name": permission_name(module.key, action.key),
                        }
                        for action in module.actions
                    ],
                }
                for module in section.modules
            ],
        }
        for section in PERMISSION_CATALOG
    ]


_ALL_NAMES = all_permission_names()


def _names(*items: str) -> frozenset[str]:
    unknown = [item for item in items if item not in _ALL_NAMES]
    if unknown:
        raise ValueError(f"Permisos fuera del catálogo: {unknown}")
    return frozenset(items)


SYSTEM_ROLES: Final[tuple[SystemRoleSpec, ...]] = (
    SystemRoleSpec(
        slug="admin",
        name="Administrador",
        description="Acceso total al dashboard, supervisión y configuración ACL.",
        permissions=None,
    ),
    SystemRoleSpec(
        slug="docente",
        name="Docente supervisor",
        description="Supervisa casos, valida diagnósticos y consulta el directorio.",
        permissions=_names(
            "dashboard.view",
            "patients.view",
            "assignments.view",
            "calendar.view",
            "clinical_records.view",
            "diagnoses.view",
            "diagnoses.validate",
            "treatments.view",
            "evolution.view",
            "odontogram.view",
            "supervision.view",
            "students.view",
        ),
    ),
    SystemRoleSpec(
        slug="estudiante",
        name="Estudiante",
        description="Carga clínica de sus pacientes: diagnóstico, tratamiento, evolución y odontograma.",
        permissions=_names(
            "dashboard.view",
            "patients.view",
            "calendar.view",
            "clinical_records.view",
            "clinical_records.create",
            "clinical_records.edit",
            "diagnoses.view",
            "diagnoses.create",
            "diagnoses.edit",
            "treatments.view",
            "treatments.create",
            "treatments.edit",
            "evolution.view",
            "evolution.create",
            "evolution.edit",
            "odontogram.view",
            "odontogram.update",
        ),
    ),
    SystemRoleSpec(
        slug="recepcion",
        name="Recepción",
        description="Registra pacientes no asignados, apoya citas y asignaciones. Sin escritura clínica.",
        permissions=_names(
            "dashboard.view",
            "patients.view",
            "patients.create",
            "patients.edit",
            "assignments.view",
            "assignments.create",
            "assignments.assign_student",
            "calendar.view",
            "calendar.create",
            "students.view",
        ),
    ),
    SystemRoleSpec(
        slug="soporte",
        name="Soporte técnico",
        description="Mantiene cuentas y el sistema. Sin acceso de escritura al expediente clínico.",
        permissions=_names(
            "dashboard.view",
            "users.view",
            "users.create",
            "users.edit",
            "users.delete",
            "roles.view",
            "catalogs.view",
            "catalogs.create",
            "catalogs.edit",
            "catalogs.delete",
            "support.view",
        ),
    ),
)
