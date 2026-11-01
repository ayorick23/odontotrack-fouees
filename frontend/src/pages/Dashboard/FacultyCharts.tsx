import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  DashboardAreaStatus,
  DashboardBankDemand,
} from "../../services/dashboard";
import {
  CASE_STATUS_LABELS,
  CASE_STATUS_ORDER,
  SINGLE_SERIES_COLOR,
  useChartTheme,
} from "./chartColors";
import { ChartCard, ChartLegend } from "./DashboardCharts";

/** Alto por fila para que las barras no se aplasten con muchas áreas. */
const ROW_HEIGHT = 34;

function total(row: DashboardAreaStatus): number {
  return CASE_STATUS_ORDER.reduce((sum, key) => sum + row[key], 0);
}

/** Pacientes por área de la ficha, apilados por estado del caso. */
export function AreaStatusChart({ rows }: { rows: DashboardAreaStatus[] }) {
  const { axis, grid, surface, cursor, status, tooltipStyle } = useChartTheme();
  const data = rows.filter((row) => total(row) > 0);
  const legend = CASE_STATUS_ORDER.map((key) => ({
    label: CASE_STATUS_LABELS[key],
    color: status[key],
  }));

  return (
    <ChartCard title="Pacientes por área clínica" bodyClassName="">
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">Sin pacientes registrados.</p>
      ) : (
        <>
          <div style={{ height: data.length * ROW_HEIGHT + 24 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                barCategoryGap="30%"
                margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke={grid} strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  stroke={axis}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: axis, fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="area"
                  width={150}
                  stroke={axis}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: axis, fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ fill: cursor }}
                  contentStyle={tooltipStyle}
                  labelFormatter={(label, payload) => {
                    const sum = payload.reduce(
                      (acc, item) => acc + Number(item.value ?? 0),
                      0,
                    );
                    return `${label} · ${sum} pacientes`;
                  }}
                />
                {CASE_STATUS_ORDER.map((key, index) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    name={CASE_STATUS_LABELS[key]}
                    stackId="estado"
                    fill={status[key]}
                    stroke={surface}
                    strokeWidth={1}
                    radius={index === CASE_STATUS_ORDER.length - 1 ? [0, 4, 4, 0] : 0}
                    maxBarSize={16}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ChartLegend items={legend} />
        </>
      )}
    </ChartCard>
  );
}

/** Tratamientos planificados en pacientes del banco, de más a menos. */
export function BankDemandChart({ rows }: { rows: DashboardBankDemand[] }) {
  const { axis, cursor, tooltipStyle } = useChartTheme();

  return (
    <ChartCard title="Tratamientos más demandados en el banco" bodyClassName="">
      <p className="-mt-1 mb-3 text-xs text-slate-500 dark:text-slate-400">
        Prácticas planificadas en pacientes disponibles para elegir.
      </p>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">
          Ningún paciente del banco tiene tratamientos planificados.
        </p>
      ) : (
        <div style={{ height: rows.length * ROW_HEIGHT + 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              barCategoryGap="30%"
              margin={{ top: 0, right: 32, left: 0, bottom: 0 }}
            >
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={190}
                stroke={axis}
                tickLine={false}
                axisLine={false}
                tick={{ fill: axis, fontSize: 11 }}
                tickFormatter={(name: string) =>
                  name.length > 30 ? `${name.slice(0, 29)}…` : name
                }
              />
              <Tooltip
                cursor={{ fill: cursor }}
                contentStyle={tooltipStyle}
                formatter={(value) => [`${value} en el banco`, "Planificados"]}
                labelFormatter={(label, payload) => {
                  const area = payload[0]?.payload?.area;
                  return area ? `${label} (${area})` : String(label);
                }}
              />
              <Bar
                dataKey="count"
                name="Planificados"
                fill={SINGLE_SERIES_COLOR}
                radius={[0, 4, 4, 0]}
                maxBarSize={16}
              >
                <LabelList
                  dataKey="count"
                  position="right"
                  style={{ fill: axis, fontSize: 11 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
