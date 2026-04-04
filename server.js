// Keep this file as the direct Node entrypoint.
// Running `node server.js` now starts the real API server defined in app.js.
const { startServer } = require("./app");

startServer();