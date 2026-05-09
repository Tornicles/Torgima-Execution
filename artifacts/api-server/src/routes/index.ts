import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import meRouter from "./me.js";
import onboardingRouter from "./onboarding.js";
import blueprintsRouter from "./blueprints.js";
import ordersRouter from "./orders.js";
import feedbackRouter from "./feedback.js";
import signalsRouter from "./signals.js";
import stateRouter from "./state.js";
import validationRouter from "./validation.js";
import bhudhiRouter from "./bhudhi.js";
import notificationsRouter from "./notifications.js";
import intelligenceRouter from "./intelligence.js";
import engagementRouter from "./engagement.js";
import internalRouter from "./internal.js";

const router = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(meRouter);
router.use(onboardingRouter);
router.use(blueprintsRouter);
router.use(ordersRouter);
router.use(feedbackRouter);
router.use(signalsRouter);
router.use(stateRouter);
router.use(validationRouter);
router.use(bhudhiRouter);
router.use(notificationsRouter);
router.use(intelligenceRouter);
router.use(engagementRouter);
router.use(internalRouter);

export default router;
