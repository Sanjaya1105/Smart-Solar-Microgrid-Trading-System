export type Role = "Backoffice" | "GridOperator" | "Prosumer";

export type Page =
  "overview" | "stations" | "reservations" | "people" | "settings";

export type Station = {
  id?: string;
  name: string;
  area: string;
  status: string;
  slots: string;
  capacityKwh?: number;
  operatingHours?: string;
};

export type Reservation = {
  id: string;
  name: string;
  person: string;
  station: string;
  stationId: string;
  slotId?: string;
  transactionType: string;
  startUtc?: string;
  endUtc?: string;
  time: string;
  amount: string;
  status: string;
};

export type Slot = {
  id: string;
  stationId: string;
  startUtc: string;
  endUtc: string;
  totalCapacity: number;
  reservedCapacity: number;
  status: string;
};

export type OperatorOption = {
  id: string;
  fullName: string;
};
