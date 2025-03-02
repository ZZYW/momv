import { JSONFilePreset } from 'lowdb/node';

const defaultData = { players: {}, blocks: [] };
const db = await JSONFilePreset("./database.json", defaultData);

export default db;
