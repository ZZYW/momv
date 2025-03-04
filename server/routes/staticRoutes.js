import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const parentDir = path.dirname(__dirname);

const router = express.Router();

// Static assets
router.use("/assets", express.static(path.join(parentDir, "assets")));

// Make utils directory accessible for codename components
router.use("/utils", express.static(path.join(parentDir, "utils")));

// Shared resources
router.use("/shared", express.static(path.join(parentDir, "sites", "shared")));

// Station 1: Accessible at http://localhost:3001/station1
router.use("/station1", express.static(path.join(parentDir, "sites", "station1")));

// Station 2: Accessible at http://localhost:3001/station2
router.use("/station2", express.static(path.join(parentDir, "sites", "station2")));

export default router;