import express from "express"
import * as webhookController from "../controllers/webhook.controller.js"

const router = express.Router()

router.post(
    "/razorpay",
    express.raw({ type: "application/json" }),
    webhookController.handleRazorpayWebhook
)

export default router