"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEvent = exports.updateEvent = exports.createEvent = void 0;
const googleapis_1 = require("googleapis");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Load OAuth 2.0 credentials
const credentialsPath = path_1.default.join(__dirname, '../../credentials.json');
const credentials = JSON.parse(fs_1.default.readFileSync(credentialsPath, 'utf-8'));
// Configure OAuth 2.0 client
const oAuth2Client = new googleapis_1.google.auth.OAuth2(credentials.client_id, credentials.client_secret, credentials.redirect_uris[0]);
const calendar = googleapis_1.google.calendar({ version: 'v3', auth: oAuth2Client });
// Utility function to set OAuth 2.0 credentials
function authenticate() {
    return __awaiter(this, void 0, void 0, function* () {
        const tokenPath = path_1.default.join(__dirname, '../../token.json');
        if (fs_1.default.existsSync(tokenPath)) {
            const token = JSON.parse(fs_1.default.readFileSync(tokenPath, 'utf-8'));
            oAuth2Client.setCredentials(token);
        }
        else {
            throw new Error('Token not found');
        }
    });
}
const createEvent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield authenticate();
        const event = {
            summary: req.body.title,
            description: req.body.description,
            start: {
                dateTime: req.body.fromTime,
                timeZone: req.body.timeZone,
            },
            end: {
                dateTime: req.body.toTime,
                timeZone: req.body.timeZone,
            },
            attendees: req.body.externalParticipants.map((email) => ({ email })),
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 },
                    { method: 'popup', minutes: 10 },
                ],
            },
        };
        const response = yield calendar.events.insert({
            calendarId: 'primary',
            requestBody: event,
        });
        res.status(200).json(response.data);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.createEvent = createEvent;
const updateEvent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield authenticate();
        const eventId = req.body.eventId;
        const event = {
            summary: req.body.title,
            description: req.body.description,
            start: {
                dateTime: req.body.fromTime,
                timeZone: req.body.timeZone,
            },
            end: {
                dateTime: req.body.toTime,
                timeZone: req.body.timeZone,
            },
            attendees: req.body.externalParticipants.map((email) => ({ email })),
        };
        const response = yield calendar.events.update({
            calendarId: 'primary',
            eventId,
            requestBody: event,
        });
        res.status(200).json(response.data);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.updateEvent = updateEvent;
const deleteEvent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield authenticate();
        const eventId = req.body.eventId;
        yield calendar.events.delete({
            calendarId: 'primary',
            eventId,
        });
        res.status(200).json({ message: 'Event deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.deleteEvent = deleteEvent;
