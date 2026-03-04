import express from "express"
import { authMiddleware, isDriver } from "../middlewares/auth.middleware.js"
import * as driverController from "../controllers/driver.controller.js"
import { requireAuth } from "@clerk/express"

const router = express.Router()

router.post("/go-online", requireAuth(), authMiddleware, isDriver, driverController.goOnline)
router.post("/go-offline", requireAuth(), authMiddleware, isDriver, driverController.goOffline)
router.post("/location-update", requireAuth(), authMiddleware, isDriver, driverController.locationUpdate)

router.get("/earnings", requireAuth(), authMiddleware, isDriver, driverController.getDriverEarnings)
router.get("/profile", requireAuth(), authMiddleware, isDriver, driverController.getDriverProfile)

export default router