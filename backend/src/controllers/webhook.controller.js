import crypto from "crypto"
import { supabase } from "../config/supabase.js"
import { verifyWebhook } from "@clerk/backend/webhooks"

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

        return res.status(200).json({ success: true, message: "Payment updated successfully" })
    } catch (error) {
        console.error("Error handling razorpay webhook:", error)
        return res.status(500).json({ success: false, message: "Failed to handle razorpay webhook", error: error.message })
    }
}

export async function handleClerkWebhook(req, res) {
    try {
        const event = await verifyWebhook(req, {
            signingSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
        })

        if (!event) {
            return res.status(400).json({ success: false, message: "Invalid webhook signature" })
        }

        const eventType = event.type
        const payload = event.data

        if (eventType === "user.created") {
            const { id, email_addresses, first_name, last_name } = payload
            const { error } = await supabase
                .from("users")
                .upsert({
                    id,
                    email: email_addresses?.[0]?.email_address,
                    name: `${first_name || ""} ${last_name || ""}`.trim() || payload.username || "User",
                    role: "RIDER"
                })
            if (error) {
                console.error("Error creating user:", error)
                return res.status(500).json({ success: false, message: "Failed to create user" })
            }
        }

        if (eventType === "user.updated") {
            const { id, email_addresses, first_name, last_name } = payload
            const { error } = await supabase
                .from("users")
                .update({
                    email: email_addresses[0].email_address,
                    name: `${first_name || ""} ${last_name || ""}`.trim() || payload.username || "User",
                })
                .eq("id", id)
            if (error) {
                console.error("Error updating user:", error)
                return res.status(500).json({ success: false, message: "Failed to update user" })
            }
        }

        if (eventType === "user.deleted") {
            const { id } = payload
            const { error } = await supabase
                .from("users")
                .delete()
                .eq("id", id)
            if (error) {
                console.error("Error deleting user:", error)
                return res.status(500).json({ success: false, message: "Failed to delete user" })
            }
        }

        return res.status(200).json({ success: true, message: "Webhook processed successfully" })
    } catch (error) {
        console.error("Error in webhook controller:", error)
        return res.status(500).json({ success: false, message: "Webhook processing failed" })
    }
}