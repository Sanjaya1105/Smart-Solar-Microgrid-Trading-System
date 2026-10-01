export type User = {
  id: string;
  nic: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  role: string;
  status: string;
};

export type Station = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  capacityKwh: number;
  batteryStorageSlots: number;
  operatingHours: string;
  operatorUserId: string | null;
};
