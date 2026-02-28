import express from "express"
import { authMiddleware, isDriver } from "../middlewares/auth.middleware.js"
import * as driverController from "../controllers/driver.controller.js"

const router = express.Router()

router.post("/go-online", authMiddleware, isDriver, driverController.goOnline)
router.post("/go-offline", authMiddleware, isDriver, driverController.goOffline)
router.post("/location-update", authMiddleware, isDriver, driverController.locationUpdate)

export default router