import express from "express"
import * as rideController from '../controllers/ride.controller.js';
import { authMiddleware, isDriver } from "../middlewares/auth.middleware.js";

const router = express.Router()

router.post('/', authMiddleware, rideController.createRide);
router.post('/:id/search', authMiddleware, rideController.searchRide);
router.post('/:id/accept', authMiddleware, isDriver, rideController.acceptRide);
router.post('/:id/reject', authMiddleware, isDriver, rideController.rejectRide);
router.post('/:id/enroute', authMiddleware, isDriver, rideController.enrouteRide);
router.post('/:id/start', authMiddleware, isDriver, rideController.startRide);
router.post('/:id/complete', authMiddleware, rideController.completeRide);

router.post('/:id/pay', authMiddleware, rideController.payForRide);
router.post('/:id/mark-paid', authMiddleware, isDriver, rideController.markAsPaid);

router.post('/:id/cancel', authMiddleware, rideController.cancelRide);

export default router;