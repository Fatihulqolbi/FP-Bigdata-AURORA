export interface TpsNode {
  id: number;
  tps: string;
  area: string;
  pos: [number, number];
  volume: number;
  capacity: number;
  status: string;
  predicted_full: string;
}

export interface TruckSim {
  id: number;
  type: string;
  capacity: number;
  color: string;
  pos: [number, number];
  targetTpsId: number | null;
  state: string;
  progress: number;
  speed: number;
  startPos: [number, number];
  endPos: [number, number];
  angle: number;
}
