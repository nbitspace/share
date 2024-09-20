"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const calendarController_1 = require("../controllers/calendarController");
const router = (0, express_1.Router)();
router.post('/events', calendarController_1.createEvent);
router.put('/events', calendarController_1.updateEvent);
router.delete('/events', calendarController_1.deleteEvent);
exports.default = router;
