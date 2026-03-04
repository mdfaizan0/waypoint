import express from "express"
import { authMiddleware } from "../middlewares/auth.middleware.js"
import { requireAuth } from "@clerk/express"
import * as userController from "../controllers/user.controller.js"

const router = express.Router()

router.get("/me", requireAuth(), authMiddleware, userController.getMe)

export default router