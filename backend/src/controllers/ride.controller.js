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

        return res.status(200).json({ success: true, message: "Ride created successfully", ride: data })
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

        const { data: nearbyDriver, error: nearbyDriverError } = await supabase
            .rpc("find_nearby_drivers", {
                pickup_lat: ride.pickup_lat,
                pickup_lng: ride.pickup_lng,
                radius_meters: 5000
            })

        if (nearbyDriverError) {
            console.error("Error finding nearby drivers:", nearbyDriverError)
            return res.status(500).json({ success: false, message: "Failed to find nearby drivers" })
        }

        if (!nearbyDriver || nearbyDriver.length === 0) {
            return res.status(400).json({ success: false, message: "Ride is searching but no nearby drivers found" })
        }

        const expiryTime = new Date(Date.now() + 30000).toISOString();
        const dispatchRows = nearbyDriver.map(d => ({
            ride_id: ride.id,
            driver_id: d.user_id,
            expires_at: expiryTime
        }))

        const { error: expiredDispatchesError } = await supabase.rpc('expire_dispatches');

        if (expiredDispatchesError) {
            console.error("Error expiring dispatches:", expiredDispatchesError)
            return res.status(500).json({ success: false, message: "Failed to expire dispatches" })
        }

        const { error: dispatchError } = await supabase
            .from("ride_dispatches")
            .insert(dispatchRows)

        if (dispatchError) {
            console.error("Error dispatching ride:", dispatchError)
            return res.status(500).json({ success: false, message: "Failed to dispatch ride" })
        }

        return res.status(200).json({ success: true, message: "Ride dispatched to nearby drivers", ride })
    } catch (error) {
        console.error("Error searching ride:", error)
        return res.status(500).json({ success: false, message: "Error searching ride", error: error.message })
    }
}

export async function acceptRide(req, res) {
    const { id } = req.params
    try {
        const { data: dispatch } = await supabase
            .from("ride_dispatches")
            .select()
            .eq("ride_id", id)
            .eq("driver_id", req.user.id)
            .eq("status", "PENDING")
            .maybeSingle()

        if (!dispatch || dispatch.expires_at < new Date().toISOString()) {
            return res.status(400).json({
                success: false,
                message: "Dispatch expired"
            });
        }

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

        const { error: expiredDispatchesError } = await supabase
            .from("ride_dispatches")
            .update({ status: "EXPIRED" })
            .eq("ride_id", id)
            .neq("driver_id", req.user.id);

        if (expiredDispatchesError) {
            console.error("Error expiring dispatches:", expiredDispatchesError)
            return res.status(500).json({ success: false, message: "Failed to expire dispatches" })
        }

        const { error: acceptDispatchError } = await supabase
            .from("ride_dispatches")
            .update({ status: "ACCEPTED" })
            .eq("ride_id", id)
            .eq("driver_id", req.user.id);

        if (acceptDispatchError) {
            console.error("Error accepting dispatch:", acceptDispatchError)
            return res.status(500).json({ success: false, message: "Failed to accept dispatch" })
        }

        const { data: driver, error: driverError } = await supabase
            .from("driver_profiles")
            .update({
                is_available: false,
                updated_at: new Date().toISOString()
            })
            .eq("user_id", req.user.id)
            .eq("is_available", true)
            .eq("is_online", true)
            .select()
            .single()

        if (driverError || !driver) {
            await supabase
                .from("rides")
                .update({
                    status: "SEARCHING",
                    driver_id: null,
                    otp_code: null,
                    accepted_at: null
                })
                .eq("id", id)
                .eq("status", "ACCEPTED")
                .is("driver_id", req.user.id)
                .neq("rider_id", req.user.id)
                .select()
                .single()
            console.error("Error accepting ride:", driverError)
            return res.status(500).json({ success: false, message: "Failed to accept ride or driver not found" })
        }

        const { otp_code, ...cleanedRide } = ride

        return res.status(200).json({ success: true, message: "Ride accepted successfully", ride: cleanedRide })
    } catch (error) {
        console.error("Error accepting ride:", error)
        return res.status(500).json({ success: false, message: "Error accepting ride", error: error.message })
    }
}

export async function rejectRide(req, res) {
    const { id } = req.params
    try {
        const now = new Date().toISOString()

        const { data: dispatch, error: dispatchError } = await supabase
            .from("ride_dispatches")
            .update({
                status: "REJECTED"
            })
            .eq("ride_id", id)
            .eq("driver_id", req.user.id)
            .eq("status", "PENDING")
            .gt("expires_at", now)
            .select()
            .single()

        if (dispatchError || !dispatch) {
            console.error("Error rejecting ride:", dispatchError)
            return res.status(500).json({ success: false, message: "Dispatch not found or already expired" })
        }

        return res.status(200).json({ success: true, message: "Ride rejected successfully", dispatch })
    } catch (error) {
        console.error("Error rejecting ride:", error)
        return res.status(500).json({ success: false, message: "Failed to reject ride", error: error.message })
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

        return res.status(200).json({ success: true, message: "Ride enrouted successfully", ride: cleanedRide })
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

        return res.status(200).json({ success: true, message: "Ride started successfully", ride: cleanedRide })
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

        const { data: driver, error: driverError } = await supabase
            .from("driver_profiles")
            .update({
                is_available: true,
                updated_at: new Date().toISOString()
            })
            .eq("user_id", req.user.id)
            .eq("is_available", false)
            .select()
            .single()

        if (driverError) {
            console.error("Error accepting ride:", driverError)
            return res.status(500).json({ success: false, message: "Failed to accept ride" })
        }

        if (!driver) {
            return res.status(400).json({ success: false, message: "Driver not found or not available" })
        }

        return res.status(200).json({ success: true, message: "Ride completed successfully", ride })
    } catch (error) {
        console.error("Error completing ride:", error)
        return res.status(500).json({ success: false, message: "Failed to complete ride", error: error.message })
    }
}

export async function payForRide(req, res) {
    const { id } = req.params
    try {

        const { data: ride, error: processingError } = await supabase
            .from("rides")
            .update({
                payment_status: "PROCESSING"
            })
            .eq("id", id)
            .eq("status", "COMPLETED")
            .eq("rider_id", req.user.id)
            .or(
                "payment_status.eq.PENDING,payment_status.eq.FAILED,and(payment_status.eq.PROCESSING,razorpay_order_id.is.null)"
            )
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

        let order;
        try {
            order = await razorpay.orders.create({
                amount: ride.fare * 100,
                currency: "INR",
                receipt: `receipt_${ride.id}`,
                notes: {
                    "ride_id": ride.id,
                    "rider_id": ride.rider_id,
                    "driver_id": ride.driver_id
                }
            })
        } catch (error) {
            await supabase
                .from("rides")
                .update({ payment_status: "PENDING" })
                .eq("id", id)
                .eq("payment_status", "PROCESSING")

            return res.status(500).json({ success: false, message: "Failed to create payment order" })
        }

        const { error: orderUpdateError } = await supabase
            .from("rides")
            .update({
                razorpay_order_id: order.id
            })
            .eq("id", id)
            .eq("status", "COMPLETED")
            .eq("rider_id", req.user.id)
            .eq("payment_method", "RAZORPAY")
            .eq("payment_status", "PROCESSING");

        if (orderUpdateError) {
            console.error("Error updating order for ride:", orderUpdateError)
            return res.status(500).json({ success: false, message: "Failed to update order for ride" })
        }

        return res.status(200).json({
            success: true,
            message: "Payment order created successfully",
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            key_id: process.env.RAZORPAY_KEY_ID
        });
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

        return res.status(200).json({ success: true, message: "Ride marked as paid successfully", ride })
    } catch (error) {
        console.error("Error marking ride as paid:", error)
        return res.status(500).json({ success: false, message: "Failed to mark ride as paid", error: error.message })
    }
}

export async function cancelRide(req, res) {
    const { id } = req.params
    try {
        // Attempt 1: Cancel as rider
        const { data: riderCancelledRide, error: riderError } = await supabase
            .from("rides")
            .update({
                status: "CANCELLED",
                cancelled_at: new Date().toISOString(),
                otp_code: null
            })
            .eq("id", id)
            .eq("rider_id", req.user.id)
            .in("status", ["REQUESTED", "SEARCHING", "ACCEPTED", "DRIVER_EN_ROUTE"])
            .select()
            .maybeSingle()

        if (riderError) {
            console.error("Error cancelling ride as rider:", riderError)
            return res.status(500).json({ success: false, message: "Failed to cancel ride" })
        }

        if (riderCancelledRide) {
            if (riderCancelledRide.driver_id) {
                const { data: makeDriverAvailable, error: makeDriverAvailableError } = await supabase
                    .from("driver_profiles")
                    .update({
                        is_available: true,
                        updated_at: new Date().toISOString()
                    })
                    .eq("user_id", riderCancelledRide.driver_id)
                    .eq("is_available", false)
                    .eq("is_online", true)
                    .select()
                    .single()

                if (makeDriverAvailableError) {
                    console.error("Error making driver available:", makeDriverAvailableError)
                    return res.status(500).json({ success: false, message: "Failed to make driver available" })
                }

                if (!makeDriverAvailable) {
                    return res.status(400).json({ success: false, message: "Driver not found or not available" })
                }
            }
            const { otp_code, ...cleanedRide } = riderCancelledRide
            return res.status(200).json({ success: true, message: "Ride cancelled by the rider", ride: cleanedRide })
        }

        // Attempt 2: Cancel as driver
        const { data: driverCancelledRide, error: driverError } = await supabase
            .from("rides")
            .update({
                status: "SEARCHING",
                driver_id: null,
                otp_code: null,
                accepted_at: null,
                started_at: null
            })
            .eq("id", id)
            .eq("driver_id", req.user.id)
            .in("status", ["ACCEPTED", "DRIVER_EN_ROUTE"])
            .neq("rider_id", req.user.id)
            .select()
            .maybeSingle()

        if (driverError) {
            console.error("Error cancelling ride as driver:", driverError)
            return res.status(500).json({ success: false, message: "Failed to cancel ride" })
        }

        if (driverCancelledRide) {
            const { data: makeDriverAvailable, error: makeDriverAvailableError } = await supabase
                .from("driver_profiles")
                .update({
                    is_available: true,
                    updated_at: new Date().toISOString()
                })
                .eq("user_id", req.user.id)
                .eq("is_available", false)
                .eq("is_online", true)
                .select()
                .single()

            if (makeDriverAvailableError) {
                console.error("Error making driver available:", makeDriverAvailableError)
                return res.status(500).json({ success: false, message: "Failed to make driver available" })
            }

            if (!makeDriverAvailable) {
                return res.status(400).json({ success: false, message: "Driver not found or not available" })
            }
            const { otp_code, ...cleanedRide } = driverCancelledRide
            return res.status(200).json({ success: true, message: "Ride cancelled by the driver", ride: cleanedRide })
        }

        return res.status(400).json({ success: false, message: "Ride not found or not cancellable" })
    } catch (error) {
        console.error("Error cancelling ride:", error)
        return res.status(500).json({ success: false, message: "Failed to cancel ride", error: error.message })
    }
}