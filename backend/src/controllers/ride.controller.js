import { supabase } from "../config/supabase.js"

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

        return res.status(200).json({ success: true, ride })
    } catch (error) {
        console.error("Error accepting ride:", error)
        return res.status(500).json({ success: false, message: "Error accepting ride", error: error.message })
    }
}

/**
 * rider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_id TEXT REFERENCES users(id) ON DELETE SET NULL,

  pickup_location TEXT NOT NULL,
  dropoff_location TEXT NOT NULL,

  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  dropoff_lat DOUBLE PRECISION,
  dropoff_lng DOUBLE PRECISION,

  fare NUMERIC NOT NULL,

  status ride_status NOT NULL DEFAULT 'REQUESTED',
  payment_status payment_status NOT NULL DEFAULT 'PENDING',

  otp_code TEXT,

  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 */