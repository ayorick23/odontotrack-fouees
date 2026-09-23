import { api } from "./api";
import {
  deriveOralMarks,
  emptyOralMarks,
  emptyPractice,
  emptyTooth,
  isFdiToothNumber,
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

export type OdontogramRevisionRecord = {
  id: number;
  placa: boolean;
  sangrado: boolean;
  sarro: boolean;
  teeth: ToothFinding[];
  visual_snapshot: OdontogramSnapshot | null;
  created_at: string;
  created_by: number | null;
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
  const oralMarks = deriveOralMarks(value.teeth);
  const { data } = await api.put<OdontogramRecord>(
    `/clinical-records/odontogram/${patientId}/`,
    {
      placa: oralMarks.placa,
      sangrado: oralMarks.sangrado,
      sarro: oralMarks.sarro,
      teeth: value.teeth,
      visual_snapshot: value.visualSnapshot ?? null,
    },
  );
  return toDomain(data);
}

export async function listOdontogramHistory(
  patientId: number,
): Promise<OdontogramRevisionRecord[]> {
  const { data } = await api.get<OdontogramRevisionRecord[]>(
    `/clinical-records/odontogram/${patientId}/history/`,
  );
  return data;
}

export function revisionToDomain(record: OdontogramRevisionRecord): OdontogramValue {
  return toDomain(record);
}

function toDomain(
  record: Pick<OdontogramRecord, "teeth" | "placa" | "sangrado" | "sarro" | "visual_snapshot">,
): OdontogramValue {
  const teeth = (record.teeth ?? []).flatMap((tooth) => {
    if (!isFdiToothNumber(tooth.fdi)) {
      return [];
    }
    return [
      {
        ...emptyTooth(tooth.fdi),
        ...tooth,
        marks: tooth.marks ?? [],
        oralMarks: { ...emptyOralMarks(), ...tooth.oralMarks },
        practice: { ...emptyPractice(), ...tooth.practice },
      },
    ];
  });
  const derived = deriveOralMarks(teeth);
  return {
    teeth,
    oralMarks: {
      placa: derived.placa || record.placa,
      sangrado: derived.sangrado || record.sangrado,
      sarro: derived.sarro || record.sarro,
    },
    visualSnapshot: record.visual_snapshot ?? undefined,
  };
}
