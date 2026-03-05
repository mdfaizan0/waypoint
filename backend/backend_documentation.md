# Shift – Backend Architecture Documentation

**Project:** Shift – Real-Time Geospatial Ride-Hailing Platform  
**Author:** Md Faizan  
**Backend Stack:** Node.js, Express, Supabase (PostgreSQL + PostGIS), Clerk, Razorpay

---

# 1. Project Overview

Shift is a full-stack ride-hailing platform inspired by services like Uber.  
The backend handles ride lifecycle management, geospatial driver discovery, payment processing, authentication, and reputation tracking.

Core backend design principles:

- State-driven ride lifecycle
- Geospatial driver discovery using PostGIS
- Push-style ride dispatch architecture
- Webhook-driven external integrations
- Stateless API authentication
- Event-driven reputation updates

---

# 2. Backend Technology Stack

| Layer | Technology |
|------|------------|
| Runtime | Node.js |
| Framework | Express.js |
| Database | PostgreSQL (Supabase) |
| Geospatial | PostGIS |
| Authentication | Clerk |
| Payments | Razorpay |
| Realtime | Supabase Realtime |
| Hosting | Vercel |

---

# 3. Backend Directory Structure

```text
backend/
│
├── config/
│   ├── supabase.js
│   └── razorpay.js
│
├── controllers/
│   ├── ride.controller.js
│   ├── driver.controller.js
│   └── webhook.controller.js
│
├── middlewares/
│   └── auth.middleware.js
│
├── routes/
│   ├── ride.route.js
│   ├── driver.route.js
│   └── webhook.route.js
├── app.js
├── server.js
└── package.json
```

---

# 4. Server Architecture

The backend separates the **Express app instance** from the **server bootstrap logic**.

### `app.js`

Responsible for:

- Creating the Express app
- Applying global middleware
- Registering API routes

### `server.js`

Responsible for:

- Bootstrapping the server
- Starting the HTTP listener

Example pattern:

```text
app.js → exports Express instance
server.js → imports app and starts server
```

This separation enables easier deployment on serverless platforms like Vercel.

---

# 5. Database Architecture

Shift uses **Supabase PostgreSQL** with relational modeling and geospatial extensions.

Main tables:

```
users
driver_profiles
rides
ride_dispatches
ride_events
ride_reviews
```

---

# 6. Users Table

Users are synchronized from Clerk using webhooks.

```text
users
```

Columns:

| Column | Description |
|------|-------------|
| id | Clerk user ID |
| name | Full name |
| email | Email address |
| role | RIDER / DRIVER |
| created_at | Account creation time |
| driver_avg_rating | Average driver rating |
| driver_rating_count | Number of driver reviews |
| rider_avg_rating | Average rider rating |
| rider_rating_count | Number of rider reviews |
| reputation_updated_at | Last reputation update |

Users support **dual personas**:

```text
User
├── Rider persona
└── Driver persona
```

Drivers can also request rides as riders.

---

# 7. Driver Profiles Table

Stores operational driver data.

```text
driver_profiles
```

Columns:

| Column | Description |
|------|-------------|
| user_id | Driver user ID |
| vehicle_number | Vehicle identifier |
| license_number | Driver license |
| is_online | Driver online state |
| is_available | Driver availability |
| location | GEOGRAPHY(Point,4326) |
| updated_at | Last update timestamp |

Driver states:

```text
OFFLINE
ONLINE_AVAILABLE
ONLINE_BUSY
```

---

# 8. Rides Table

Central ride entity tracking the ride lifecycle.

Columns include:

```text
id
rider_id
driver_id
pickup_location
dropoff_location
pickup_lat
pickup_lng
dropoff_lat
dropoff_lng
fare
status
payment_status
payment_method
otp_code
requested_at
accepted_at
started_at
completed_at
razorpay_order_id
razorpay_payment_id
created_at
updated_at
```

---

# 9. Ride Lifecycle

Ride state machine:

```text
REQUESTED
   ↓
SEARCHING
   ↓
ACCEPTED
   ↓
DRIVER_EN_ROUTE
   ↓
STARTED
   ↓
COMPLETED
```

Cancellation paths:

```text
REQUESTED / SEARCHING → CANCELLED
ACCEPTED / DRIVER_EN_ROUTE → SEARCHING (driver cancelled)
```

Once a ride reaches **COMPLETED**, its state becomes immutable.

---

# 10. Payment Lifecycle

Payment states:

```text
PENDING
PROCESSING
PAID
FAILED
```

Supported payment methods:

```text
CASH
RAZORPAY
```

Payment flow:

```text
Ride completed
↓
Order created
↓
Frontend payment
↓
Razorpay webhook
↓
Payment status updated
```

---

# 11. Dispatch System

Shift uses a **dispatch queue architecture**.

Table:

```text
ride_dispatches
```

Columns:

| Column | Description |
|------|-------------|
| id | Dispatch ID |
| ride_id | Associated ride |
| driver_id | Target driver |
| status | PENDING / ACCEPTED / REJECTED / EXPIRED |
| created_at | Timestamp |

Dispatch flow:

```text
Ride requested
↓
Nearby drivers identified
↓
Dispatch records created
↓
Driver receives ride offer
↓
Driver accepts or rejects
```

---

# 12. Geospatial Driver Discovery

Driver proximity queries use **PostGIS**.

Driver location stored as:

```sql
GEOGRAPHY(Point, 4326)
```

Common spatial functions:

```sql
ST_DWithin
ST_Distance
```

Driver location updates:

```
POST /api/driver/location-update
```

Coordinates are validated before update.

---

# 13. Fare Calculation

Fare estimation uses a database RPC:

```sql
calculate_fare(pickup_lat, pickup_lng, drop_lat, drop_lng)
```

Returns:

```
distance_meters
distance_km
```

Application fare logic:

```text
roadDistance = straightDistance × multiplier
fare = baseFare + (distance × perKmRate)
minimumFare applied
```

---

# 14. Authentication Architecture

Authentication handled using **Clerk**.

Middleware stack:

```text
clerkMiddleware()
requireAuth()
authMiddleware
```

Request flow:

```text
Client request
↓
Clerk verifies session
↓
authMiddleware loads DB user
↓
req.user attached
↓
controller executes
```

Identity mapping:

```text
users.id = clerk_user_id
```

---

# 15. Clerk Webhook Sync

Clerk events are received at:

```
POST /webhooks/clerk
```

Supported events:

```
user.created
user.updated
user.deleted
```

Example logic:

```text
user.created
↓
Insert user into users table
↓
Default role = RIDER
```

This keeps authentication and database state synchronized.

---

# 16. Razorpay Webhook

Payment verification endpoint:

```
POST /webhooks/razorpay
```

Security mechanism:

```
x-razorpay-signature
```

Webhook confirms payment authenticity and updates ride payment status.

---

# 17. Reputation System

After ride completion, both participants can submit reviews.

Table:

```text
ride_reviews
```

Columns:

```
ride_id
reviewer_id
reviewee_id
rating
comment
created_at
```

Constraint:

```
one review per reviewer per ride
```

Database trigger:

```
update_user_rating()
```

Updates:

```
driver_avg_rating
rider_avg_rating
```

---

# 18. Driver Availability Management

Driver availability automatically changes during ride lifecycle.

Examples:

```text
acceptRide → driver unavailable
completeRide → driver available
cancelRide → driver available
```

---

# 19. REST API Endpoints

### Ride Endpoints

```
POST /api/rides
POST /api/rides/estimate
POST /api/rides/:id/search
POST /api/rides/:id/accept
POST /api/rides/:id/reject
POST /api/rides/:id/enroute
POST /api/rides/:id/start
POST /api/rides/:id/complete
POST /api/rides/:id/cancel
POST /api/rides/:id/pay
POST /api/rides/:id/mark-paid
POST /api/rides/:id/review
GET  /api/rides/history
```

### Driver Endpoints

```
POST /api/driver/go-online
POST /api/driver/go-offline
POST /api/driver/location-update
GET  /api/driver/earnings
```

### User Endpoints

```
GET /api/users/me
```

---

# 20. `/me` Endpoint

Returns authenticated user profile.

Purpose:

Allows frontend to immediately fetch user identity after login.

Example response:

```json
{
  "id": "user_xxxx",
  "name": "John Doe",
  "email": "john@email.com",
  "role": "RIDER",
  "rider_avg_rating": 4.7,
  "driver_avg_rating": 4.9
}
```

Persona-specific data is retrieved from other endpoints.

---

# 21. Realtime Architecture

Realtime updates are implemented using **Supabase Realtime subscriptions**.

Tables subscribed:

```
rides
ride_dispatches
driver_profiles
```

Example flows:

```text
Driver accepts ride → rider UI updates
Driver location updates → rider map moves
Dispatch created → driver receives ride offer
```

---

# 22. Indexing Strategy

Indexes added for performance.

Examples:

```sql
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_driver ON rides(driver_id);
CREATE INDEX idx_dispatch_driver_status ON ride_dispatches(driver_id, status);
CREATE INDEX idx_driver_location ON driver_profiles USING GIST(location);
```

Spatial indexes enable fast proximity queries.

---

# 23. Security Features

Implemented security mechanisms:

```
Webhook signature verification
Clerk session verification
Role-based route protection
OTP ride start verification
Payment idempotency
Coordinate validation
```

---

# 24. Backend Completion Status

Completed systems:

```
Ride lifecycle
Driver dispatch
Authentication
Payments
Ratings
Geospatial matching
Driver availability
Webhook integrations
User profile endpoint
```

The backend now provides a **production-grade API layer** for the Shift frontend.

---

# 25. Next Phase

Frontend implementation using:

```
Next.js
Clerk
Leaflet
Supabase Realtime
```

The frontend will consume the backend API and enable real-time ride interactions.

---