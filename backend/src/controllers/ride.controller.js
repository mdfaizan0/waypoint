import { supabase } from "../config/supabase.js"
import { razorpay } from "../config/razorpay.js"

export async function createRide(req, res) {
    const { rider_id, pickup_location, dropoff_location, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng } = req.body
    try {
        const { data, error } = await supabase
            .from('rides')
            .insert({
                rider_id,
                pickup_location,
                dropoff_location,
                pickup_lat,
                pickup_lng,
                dropoff_lat,
                dropoff_lng,
                fare: Math.floor(Math.random() * 1000) + 100,
            })
            .select()
            .single()


        if (error) {
            console.error("Error creating ride:", error)
            return res.status(500).json({ success: false, message: "Failed to create ride" })
        }

        return res.status(200).json({ success: true, ride: data })
    } catch (error) {
        console.error("Error creating ride:", error);
        return res.status(500).json({ success: false, message: "Error creating ride", error: error.message });
    }
}

export async function searchRide(req, res) {
    const { id } = req.params
    try {
        const { data: ride, error: rideError } = await supabase
            .from("rides")
            .update({ status: "SEARCHING" })
            .eq("id", id)
            .eq("status", "REQUESTED")
            .select("*")
            .single()

        if (rideError) {
            console.error("Error searching ride:", rideError)
            return res.status(500).json({ success: false, message: "Failed to search ride" })
        }

        if (!ride) {
            return res.status(400).json({ success: false, message: "Ride not found or not in REQUESTED state" })
        }

        return res.status(200).json({ success: true, ride })
    } catch (error) {
        console.error("Error searching ride:", error)
        return res.status(500).json({ success: false, message: "Error searching ride", error: error.message })
    }
}

export async function acceptRide(req, res) {
    const { id } = req.params
    try {
        const { data: ride, error: rideError } = await supabase
            .from("rides")
            .update({
                status: "ACCEPTED",
                driver_id: req.user.id,
                otp_code: Math.floor(1000 + Math.random() * (10000 - 1000)).toString(),
                accepted_at: new Date().toISOString()
            })
            .eq("id", id)
            .eq("status", "SEARCHING")
            .is("driver_id", null)
            .neq("rider_id", req.user.id)
            .select()
            .single()

        if (rideError) {
            console.error("Error accepting ride:", rideError)
            return res.status(500).json({ success: false, message: "Failed to accept ride" })
        }

        if (!ride) {
            return res.status(400).json({ success: false, message: "Ride unavailable for acceptance" })
        }

        const { otp_code, ...cleanedRide } = ride

        return res.status(200).json({ success: true, ride: cleanedRide })
    } catch (error) {
        console.error("Error accepting ride:", error)
        return res.status(500).json({ success: false, message: "Error accepting ride", error: error.message })
    }
}

export async function enrouteRide(req, res) {
    const { id } = req.params
    try {
        const { data: ride, error: rideError } = await supabase
            .from("rides")
            .update({
                status: "DRIVER_EN_ROUTE"
            })
            .eq("id", id)
            .eq("status", "ACCEPTED")
            .eq("driver_id", req.user.id)
            .neq("rider_id", req.user.id)
            .select()
            .single()

        if (rideError) {
            console.error("Error enrouting ride:", rideError)
            return res.status(500).json({ success: false, message: "Failed to enroute ride" })
        }

        if (!ride) {
            return res.status(400).json({ success: false, message: "Ride not found or not in ACCEPTED state" })
        }

        const { otp_code, ...cleanedRide } = ride

        return res.status(200).json({ success: true, ride: cleanedRide })
    } catch (error) {
        console.error("Error enrouting ride:", error)
        return res.status(500).json({ success: false, message: "Failed to enroute ride", error: error.message })
    }
}

export async function startRide(req, res) {
    const { id } = req.params
    const { otp } = req.body
    try {
        const { data: ride, error: rideError } = await supabase
            .from("rides")
            .update({
                status: "STARTED",
                otp_code: null,
                started_at: new Date().toISOString()
            })
            .eq("id", id)
            .eq("status", "DRIVER_EN_ROUTE")
            .eq("driver_id", req.user.id)
            .eq("otp_code", otp)
            .neq("rider_id", req.user.id)
            .select()
            .single()

        if (rideError) {
            console.error("Error starting ride:", rideError)
            return res.status(500).json({ success: false, message: "Failed to start ride" })
        }

        if (!ride) {
            return res.status(400).json({ success: false, message: "Ride not found or not in DRIVER_EN_ROUTE state" })
        }

        const { otp_code, ...cleanedRide } = ride

        return res.status(200).json({ success: true, ride: cleanedRide })
    } catch (error) {
        console.error("Error starting ride:", error)
        return res.status(500).json({ success: false, message: "Failed to start ride", error: error.message })
    }
}

export async function completeRide(req, res) {
    const { id } = req.params
    try {
        const { data: ride, error: rideError } = await supabase
            .from("rides")
            .update({
                status: "COMPLETED",
                completed_at: new Date().toISOString()
            })
            .eq("id", id)
            .eq("status", "STARTED")
            .eq("driver_id", req.user.id)
            .is("otp_code", null)
            .neq("rider_id", req.user.id)
            .select()
            .single()

        if (rideError) {
            console.error("Error completing ride:", rideError)
            return res.status(500).json({ success: false, message: "Failed to complete ride" })
        }

        if (!ride) {
            return res.status(400).json({ success: false, message: "Ride not found or not in STARTED state" })
        }

        // TODO: Handle payment

        return res.status(200).json({ success: true, ride })
    } catch (error) {
        console.error("Error completing ride:", error)
        return res.status(500).json({ success: false, message: "Failed to complete ride", error: error.message })
    }
}

export async function payForRide(req, res) {
    const { id } = req.params
    try {
        const { data: ride, error: rideError } = await supabase
            .from("rides")
            .select()
            .eq("id", id)
            .eq("status", "COMPLETED")
            .eq("rider_id", req.user.id)
            .eq("payment_status", "PENDING")
            .eq("payment_method", "RAZORPAY")
            .single()

        if (rideError) {
            console.error("Error completing ride:", rideError)
            return res.status(500).json({ success: false, message: "Failed to complete ride" })
        }

        if (!ride) {
            return res.status(400).json({ success: false, message: "Ride not found or not in STARTED state" })
        }

        const order = await razorpay.orders.create({
            amount: ride.fare * 100,
            currency: "INR",
            receipt: `receipt_${ride.id}`,
            notes: {
                "ride_id": ride.id,
                "rider_id": ride.rider_id,
                "driver_id": ride.driver_id
            }
        })

        const { error: processingError } = await supabase
            .from("rides")
            .update({
                payment_status: "PROCESSING",
                razorpay_order_id: order.id
            })
            .eq("id", id)
            .eq("status", "COMPLETED")
            .eq("rider_id", req.user.id)
            .eq("payment_status", "PENDING")
            .eq("payment_method", "RAZORPAY")
            .select()
            .single()

        if (processingError) {
            console.error("Error processing payment for ride:", processingError)
            return res.status(500).json({ success: false, message: "Failed to process payment for ride" })
        }

        if (!ride) {
            return res.status(400).json({ success: false, message: "Ride not found or not in COMPLETED state" })
        }

        // TODO: RazorPay payment success/failure
    } catch (error) {
        console.error("Error processing payment for ride:", error)
        return res.status(500).json({ success: false, message: "Failed to process payment for ride", error: error.message })
    }
}

export async function markAsPaid(req, res) {
    const { id } = req.params
    try {
        const { data: ride, error: rideError } = await supabase
            .from("rides")
            .update({
                payment_status: "PAID"
            })
            .eq("id", id)
            .eq("status", "COMPLETED")
            .eq("driver_id", req.user.id)
            .eq("payment_status", "PENDING")
            .eq("payment_method", "CASH")
            .neq("rider_id", req.user.id)
            .select()
            .single()

        if (rideError) {
            console.error("Error marking ride as paid:", rideError)
            return res.status(500).json({ success: false, message: "Failed to mark ride as paid" })
        }

        if (!ride) {
            return res.status(400).json({ success: false, message: "Ride not found or not in COMPLETED state" })
        }

        return res.status(200).json({ success: true, ride })
    } catch (error) {
        console.error("Error marking ride as paid:", error)
        return res.status(500).json({ success: false, message: "Failed to mark ride as paid", error: error.message })
    }
}