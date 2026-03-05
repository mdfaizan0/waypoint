import { supabase } from "../config/supabase.js"
import { razorpay } from "../config/razorpay.js"

export async function estimateRide(req, res) {
    const { pickup_lat, pickup_lng, dropoff_lat, dropoff_lng } = req.body

    if (!pickup_lat || !pickup_lng || !dropoff_lat || !dropoff_lng) {
        return res.status(400).json({ success: false, message: "Pickup and drop coordinates are required" });
    }

    try {
        const { data, error } = await supabase.rpc("calculate_fare", {
            pickup_lat,
            pickup_lng,
            drop_lat: dropoff_lat,
            drop_lng: dropoff_lng
        });

        if (error || !data || !data.length) {
            console.error("Error estimating fare:", error);
            return res.status(500).json({ success: false, message: "Failed to estimate fare" });
        }

        return res.status(200).json({
            success: true,
            message: "Fare estimated successfully",
            estimate: data[0]
        });

    } catch (error) {
        console.error("Error estimating fare:", error);
        return res.status(500).json({ success: false, message: "Error estimating fare", error: error.message });
    }
}

export async function createRide(req, res) {
    const { rider_id, pickup_location, dropoff_location, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng } = req.body

    try {
        const { data: fareData, error: fareError } = await supabase.rpc("calculate_fare", {
            pickup_lat,
            pickup_lng,
            drop_lat: dropoff_lat,
            drop_lng: dropoff_lng
        });

        if (fareError || !fareData || !fareData.length) {
            console.error("Error calculating fare:", fareError);
            return res.status(500).json({ success: false, message: "Failed to calculate fare" });
        }

        const estimatedFare = fareData[0].estimated_fare;

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
                fare: estimatedFare
            })
            .select()
            .single();

        if (error) {
            console.error("Error creating ride:", error);
            return res.status(500).json({ success: false, message: "Failed to create ride" });
        }

        return res.status(200).json({
            success: true,
            message: "Ride created successfully",
            ride: data
        });

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

export async function reviewRide(req, res) {
    const { id } = req.params
    const { rating, comment } = req.body
    const user_id = req.user.id
    if (!rating) {
        return res.status(400).json({ success: false, message: "Rating is required" })
    }

    if (typeof rating !== "number" || rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" })
    }

    if (comment && comment.trim().length > 500) {
        return res.status(400).json({ success: false, message: "Comment must be less than 500 characters" })
    }
    try {
        const { data: ride, error: rideError } = await supabase
            .from("rides")
            .select("*")
            .eq("id", id)
            .single()

        if (rideError) {
            console.error("Error reviewing ride:", rideError)
            return res.status(500).json({ success: false, message: "Failed to review ride" })
        }

        if (!ride) {
            return res.status(400).json({ success: false, message: "Ride not found or not in COMPLETED state" })
        }

        const isParticipant = ride.rider_id === user_id || ride.driver_id === user_id
        const isReadyForReview = ride.status === "COMPLETED" && ride.payment_status === "PAID"

        if (!isParticipant) {
            return res.status(403).json({ success: false, message: "You are not a participant in this ride" })
        }

        if (!isReadyForReview) {
            return res.status(403).json({ success: false, message: "Ride must be COMPLETED and PAID to leave a review" })
        }


        const reviewee_id = ride.rider_id === user_id ? ride.driver_id : ride.rider_id

        if (!reviewee_id) {
            return res.status(400).json({ success: false, message: "Invalid review target" })
        }

        const { data: review, error: reviewError } = await supabase
            .from("ride_reviews")
            .insert({
                ride_id: ride.id,
                reviewee_id,
                reviewer_id: user_id,
                rating,
                comment: comment ? comment.trim() : null
            })
            .select()
            .single()

        if (reviewError?.code === "23505") {
            return res.status(400).json({ success: false, message: "You have already reviewed this ride" });
        }

        if (reviewError) {
            console.error("Error reviewing ride:", reviewError)
            return res.status(500).json({ success: false, message: "Failed to review ride" })
        }

        return res.status(200).json({ success: true, message: "Ride reviewed successfully", review })
    } catch (error) {
        console.error("Error reviewing ride:", error)
        return res.status(500).json({ success: false, message: "Failed to review ride", error: error.message })
    }
}

export async function getRideHistory(req, res) {
    const { as: role } = req.query
    const userId = req.user.id

    if (!["rider", "driver"].includes(role)) {
        return res.status(400).json({ success: false, message: "Query parameter 'as' must be either 'rider' or 'driver'" })
    }

    try {
        let query = supabase
            .from("rides")
            .select(`
                id,
                pickup_location,
                dropoff_location,
                fare,
                status,
                payment_status,
                created_at,
                completed_at,
                cancelled_at
            `)
            .in("status", ["COMPLETED", "CANCELLED"])
            .order("created_at", { ascending: false })

        if (role === "rider") {
            query = query.eq("rider_id", userId)
        } else {
            query = query.eq("driver_id", userId)
        }

        const { data: rides, error: ridesError } = await query

        if (ridesError) {
            console.error("Error fetching ride history:", ridesError)
            return res.status(500).json({ success: false, message: "Failed to fetch ride history" })
        }

        return res.status(200).json({ success: true, message: "Ride history fetched successfully", count: rides.length, rides })
    } catch (error) {
        console.error("Error fetching ride history:", error)
        return res.status(500).json({ success: false, message: "Failed to fetch ride history", error: error.message })
    }
}

export async function getRideById(req, res) {
    const { id } = req.params
    try {
        const { data: ride, error: rideError } = await supabase
            .from("rides")
            .select(`
                *,
                rider:rider_id (
                    id,
                    name,
                    email,
                    rider_avg_rating,
                    rider_rating_count
                ),
                driver:driver_id (
                    id,
                    name,
                    email,
                    driver_avg_rating,
                    driver_rating_count,
                    profile:driver_profiles (
                        vehicle_number,
                        license_number
                    )
                )
            `)
            .eq("id", id)
            .single()

        if (rideError) {
            console.error("Error fetching ride by ID:", rideError)
            return res.status(500).json({ success: false, message: "Failed to fetch ride by ID" })
        }

        return res.status(200).json({ success: true, message: "Ride fetched successfully", ride })
    } catch (error) {
        console.error("Error fetching ride by ID:", error)
        return res.status(500).json({ success: false, message: "Failed to fetch ride by ID", error: error.message })
    }
}