from django.test import SimpleTestCase

from clinical_records.catalog import (
    FDI_TOOTH_NUMBERS,
    OralGeneralMark,
    ToothStatus,
    is_fdi_permanent_tooth,
)


class OdontogramCatalogTests(SimpleTestCase):
    def test_tooth_status_is_closed(self):
        self.assertEqual(
            list(ToothStatus.values),
            [
                ToothStatus.SANO,
                ToothStatus.CARIES,
                ToothStatus.OBTURADO,
                ToothStatus.EXTRAIDO,
                ToothStatus.CORONA,
                ToothStatus.IMPLANTE,
            ],
        )

    def test_fdi_has_thirty_two_unique_permanent_teeth(self):
        self.assertEqual(len(FDI_TOOTH_NUMBERS), 32)
        self.assertEqual(len(set(FDI_TOOTH_NUMBERS)), 32)
        for number in FDI_TOOTH_NUMBERS:
            self.assertTrue(is_fdi_permanent_tooth(number))

    def test_rejects_numbers_outside_fdi_permanent_set(self):
        self.assertFalse(is_fdi_permanent_tooth(8))
        self.assertFalse(is_fdi_permanent_tooth(51))
        self.assertFalse(is_fdi_permanent_tooth(19))

    def test_oral_general_marks_are_boolean_flags(self):
        self.assertEqual(
            list(OralGeneralMark.values),
            [
                OralGeneralMark.PLACA,
                OralGeneralMark.SANGRADO,
                OralGeneralMark.SARRO,
            ],
        )
