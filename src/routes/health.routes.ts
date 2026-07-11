import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ status: "ok", message: "CSVIQ backend is alive" });
});

export default router;