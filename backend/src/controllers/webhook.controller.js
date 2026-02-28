import crypto from "crypto"
import { supabase } from "../config/supabase.js"

export async function handleRazorpayWebhook(req, res) {
    const signature = req.headers["x-razorpay-signature"]
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
    const rawBody = req.body

    try {
        const expected_sign = crypto
            .createHmac("sha256", webhookSecret)
            .update(rawBody)
            .digest("hex")

        if (expected_sign !== signature) {
            return res.status(400).json({ message: "Invalid webhook signature" })
        }

        const event = JSON.parse(rawBody.toString())
        console.log("Webhook event:", event.event)

        if (event.event === "payment.captured") {
            const payment = event.payload.payment.entity

            const { error } = await supabase
                .from("rides")
                .update({
                    payment_status: "PAID",
                    razorpay_payment_id: payment.id
                })
                .eq("payment_method", "RAZORPAY")
                .eq("payment_status", "PROCESSING")
                .eq("razorpay_order_id", payment.order_id)

            if (error) {
                console.error("Error updating payment:", error)
                return res.status(500).json({ success: false, message: "Failed to update payment" })
            }
        }

        if (event.event === "payment.failed") {
            const payment = event.payload.payment.entity

            await supabase
                .from("rides")
                .update({
                    payment_status: "FAILED"
                })
                .eq("payment_method", "RAZORPAY")
                .eq("payment_status", "PROCESSING")
                .eq("razorpay_order_id", payment.order_id)
        }

        return res.status(200).json({ message: "Payment updated successfully" })
    } catch (error) {
        console.error("Error handling razorpay webhook:", error)
        return res.status(500).json({ success: false, message: "Failed to handle razorpay webhook", error: error.message })
    }
}