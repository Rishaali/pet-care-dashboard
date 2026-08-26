const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "petzi-dev-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

function signToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            name: user.name
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ error: "Authentication token is required" });
    }

    jwt.verify(token, JWT_SECRET, (err, payload) => {
        if (err) {
            return res.status(403).json({ error: "Invalid or expired authentication token" });
        }

        req.user = {
            id: payload.id,
            email: payload.email,
            name: payload.name
        };
        next();
    });
}

module.exports = {
    authenticateToken,
    signToken
};
