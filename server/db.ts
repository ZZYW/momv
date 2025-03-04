import { JSONFilePreset } from 'lowdb/node';

export interface PlayerChoice {
  chosenIndex?: number;
  chosenText: string;
  availableOptions?: string[];
}

export interface DynamicContent {
  blockType: string;
  content: string | string[];
  timestamp: string;
}

export interface Player {
  choices: Record<string, PlayerChoice>;
  dynamicContent: Record<string, DynamicContent>;
  codename?: string;
  codenameId?: string;
}

export interface Database {
  players: Record<string, Player>;
  blocks: any[];
}

const defaultData: Database = { players: {}, blocks: [] };
const db = await JSONFilePreset<Database>("./database.json", defaultData);

export default db;