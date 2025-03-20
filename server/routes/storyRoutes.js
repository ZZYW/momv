import express from "express";
import { 
  getStoryBeforeBlockByPlayer, 
  getBlockData, 
  compileStoryForPlayer, 
  compileChoiceSummaryForBlock 
} from "../controllers/storyRetriever.ts";

const router = express.Router();


/**
 * !!!!! NOTE:
 * every route here will be mounted under /story router.
 */


// Story API endpoints
router.get("/blocks", async (req, res) => {
  try {
    const { playerId, blockId, storyId = 1, blockType } = req.query;
    const blocks = await getStoryBeforeBlockByPlayer(
      playerId || null,
      blockId || null,
      parseInt(storyId, 10),
      blockType || null
    );
    res.json({ success: true, blocks });
  } catch (error) {
    logger.error("Error in /story/blocks:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/block/:blockId", async (req, res) => {
  try {
    const { blockId } = req.params;
    const { playerId } = req.query;
    const block = await getBlockData(blockId, playerId || null);
    
    if (!block) {
      return res.status(404).json({ success: false, error: "Block not found" });
    }
    
    res.json({ success: true, block });
  } catch (error) {
    logger.error("Error in /story/block/:blockId:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/compile", async (req, res) => {
  try {
    const { playerId, storyId = 1, blockId } = req.query;
    const compiledText = await compileStoryForPlayer(
      playerId || null,
      parseInt(storyId, 10),
      blockId || null
    );
    res.json({ success: true, compiledText });
  } catch (error) {
    logger.error("Error in /story/compile:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/choices/:blockId", async (req, res) => {
  try {
    const { blockId } = req.params;
    const summary = await compileChoiceSummaryForBlock(blockId);
    res.json({ success: true, summary });
  } catch (error) {
    logger.error("Error in /story/choices/:blockId:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;