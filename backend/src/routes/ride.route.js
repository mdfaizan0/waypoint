import express from "express"
import * as rideController from '../controllers/ride.controller.js';
import { authMiddleware, isDriver } from "../middlewares/auth.middleware.js";
import { requireAuth } from "@clerk/express";

const router = express.Router()

router.post('/estimate', rideController.estimateRide);
router.post('/', requireAuth(), authMiddleware, rideController.createRide);
router.post('/:id/search', requireAuth(), authMiddleware, rideController.searchRide);
router.post('/:id/accept', requireAuth(), authMiddleware, isDriver, rideController.acceptRide);
router.post('/:id/reject', requireAuth(), authMiddleware, isDriver, rideController.rejectRide);
router.post('/:id/enroute', requireAuth(), authMiddleware, isDriver, rideController.enrouteRide);
router.post('/:id/start', requireAuth(), authMiddleware, isDriver, rideController.startRide);
router.post('/:id/complete', requireAuth(), authMiddleware, rideController.completeRide);

router.post('/:id/pay', requireAuth(), authMiddleware, rideController.payForRide);
router.post('/:id/mark-paid', requireAuth(), authMiddleware, isDriver, rideController.markAsPaid);

router.post('/:id/cancel', requireAuth(), authMiddleware, rideController.cancelRide);
router.post("/:id/review", requireAuth(), authMiddleware, rideController.reviewRide)

router.get('/:id', requireAuth(), authMiddleware, rideController.getRideById);
router.get("/history", requireAuth(), authMiddleware, rideController.getRideHistory)

export default router;