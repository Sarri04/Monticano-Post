export type TemplateKind = 'A' | 'B'; // A = prima squadra (la partita è il titolo), B = giovanili/seconda squadra (la categoria è il titolo)
export type ProjectKind = 'announce' | 'result';
export type Outcome = 'win' | 'loss' | 'draw';

export interface Category { id: string; name: string; template: TemplateKind; useLogos: boolean; }
export interface Team { id: string; name: string; short?: string; categoryId?: string; logoId?: string; isMonticano?: boolean; notes?: string; }
export interface LogoRec { id: string; name: string; blob: Blob; }
export interface ResultData { home: number; away: number; scorers: string; assists: string; notes: string; }
export interface Match {
  id: string; categoryId: string; competition: string; round: string;
  homeName: string; awayName: string; homeTeamId?: string; awayTeamId?: string;
  extraTeams: string[]; // squadre oltre le prime due (triangolari/tornei)
  date: string; time: string; venue: string;
  monticanoHome: boolean; theme: string; result?: ResultData; archived: boolean; createdAt: number;
}

export type LayerKind = 'text' | 'logo';
export interface LayerBase {
  id: string; kind: LayerKind; name: string; role: string;
  x: number; y: number; rotation: number; // centro del livello in px, canvas 1080x1350
  visible: boolean;
}
export interface TextLayer extends LayerBase {
  kind: 'text'; text: string; font: string; size: number; weight: number;
  color: string; color2?: string; // color2 => gradiente verticale
  stroke: string; strokeWidth: number; glow: string; glowBlur: number;
  shadow: boolean; letterSpacing: number; lineHeight: number; maxWidth: number; align: 'center' | 'left' | 'right'; upper: boolean;
  depth?: number; depthColor?: string; // effetto 3D: spessore in px e colore
  plate?: Plate; // targa/banner a tema dietro al testo
}
export interface Plate { fill: string; border: string; borderWidth: number; opacity: number; padX: number; padY: number; radius: number; }
export type FrameShape = 'circle' | 'rounded' | 'shield';
export interface Frame { shape: FrameShape; fill: string; border: string; borderWidth: number; opacity: number; pad: number; }
export interface LogoLayer extends LayerBase { kind: 'logo'; logoId: string; size: number; glow: string; glowBlur: number; shadow: boolean; frame?: Frame; }
export type Layer = TextLayer | LogoLayer;

export interface Version { id: string; createdAt: number; seed: number; prompt: string; bg: Blob; }
export interface Project {
  id: string; matchId: string; kind: ProjectKind; theme: string; mode?: 'integrated' | 'layers';
  layers: Layer[]; bgBlob?: Blob; versions: Version[]; prompt: string; seed: number;
  description: string; createdAt: number; updatedAt: number;
}
export interface Settings { workerUrl: string; workerToken: string; engine?: 'puter' | 'cloudflare'; puterModel?: string; puterQuality?: string; cfModel?: string; }
export const W = 1080;
export const H = 1350;
