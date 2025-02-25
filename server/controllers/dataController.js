import db from '../db.js';

export const getData = async (req, res) => {
    await db.read();
    res.json(db.data);
};

export const postData = async (req, res) => {
    db.data = req.body;
    await db.write();
    res.json({ status: "success" });
};
