import { api } from "./api";
import {
  emptyOralMarks,
  type OdontogramSnapshot,
  type OdontogramValue,
  type ToothFinding,
} from "../features/clinical-records/types";

export type OdontogramRecord = {
  patient: number;
  placa: boolean;
  sangrado: boolean;
  sarro: boolean;
  teeth: ToothFinding[];
  visual_snapshot: OdontogramSnapshot | null;
  updated_at: string;
};

export async function getOdontogram(patientId: number): Promise<OdontogramValue> {
  const { data } = await api.get<OdontogramRecord>(
    `/clinical-records/odontogram/${patientId}/`,
  );
  return toDomain(data);
}

export async function saveOdontogram(
  patientId: number,
  value: OdontogramValue,
): Promise<OdontogramValue> {
  const { data } = await api.put<OdontogramRecord>(
    `/clinical-records/odontogram/${patientId}/`,
    {
      placa: value.oralMarks.placa,
      sangrado: value.oralMarks.sangrado,
      sarro: value.oralMarks.sarro,
      teeth: value.teeth,
      visual_snapshot: value.visualSnapshot ?? null,
    },
  );
  return toDomain(data);
}

function toDomain(record: OdontogramRecord): OdontogramValue {
  return {
    teeth: record.teeth,
    oralMarks: {
      ...emptyOralMarks(),
      placa: record.placa,
      sangrado: record.sangrado,
      sarro: record.sarro,
    },
    visualSnapshot: record.visual_snapshot ?? undefined,
  };
}
