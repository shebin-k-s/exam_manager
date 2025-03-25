import Jwt from 'jsonwebtoken'

export const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization
    if (!token) {
        return res.status(401).json({ message: "Authorization token is missing" });
    }

    try {
        const decodedToken = Jwt.verify(token, process.env.JWT_TOKEN)

        req.user = decodedToken;
        next();
    } catch (error) {
        console.log(error);
        return res.status(401).json({ message: 'Invalid or expired token' });

    }
}