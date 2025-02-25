import { JSONFilePreset } from 'lowdb/node';

const defaultData = { players: {}, blocks: [] };
const db = await JSONFilePreset("./data.json", defaultData);

export default db;
