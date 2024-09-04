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
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const googleapis_1 = require("googleapis");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const app = (0, express_1.default)();
app.use(body_parser_1.default.json());
// Load OAuth 2.0 credentials
const credentialsPath = path_1.default.join(__dirname, '../credentials.json');
const credentials = JSON.parse(fs_1.default.readFileSync(credentialsPath, 'utf-8'));
// Set up OAuth 2.0 client
const redirectUri = credentials.web.redirect_uris[0];
const oAuth2Client = new googleapis_1.google.auth.OAuth2(credentials.web.client_id, credentials.web.client_secret, redirectUri);
// Route to start the OAuth flow
app.get('/auth', (req, res) => {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/calendar'],
    });
    res.redirect(authUrl);
});
// Route to handle OAuth callback
app.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const code = req.query.code;
    if (code) {
        try {
            const { tokens } = yield oAuth2Client.getToken(code);
            oAuth2Client.setCredentials(tokens);
            fs_1.default.writeFileSync(path_1.default.join(__dirname, '../token.json'), JSON.stringify(tokens));
            res.send('Authentication successful! You can close this tab.');
        }
        catch (error) {
            console.error('Error retrieving access token', error);
            res.status(500).send('Error retrieving access token');
        }
    }
    else {
        res.status(400).send('No code found in query parameters');
    }
}));
// Serve static files
app.use('/calendar', express_1.default.static(path_1.default.join(__dirname, '../public')));
// Routes for calendar events
const calendarRoutes_1 = __importDefault(require("./routes/calendarRoutes"));
app.use('/calendar', calendarRoutes_1.default);
// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
