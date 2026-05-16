import jwt from "jsonwebtoken"
import User from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { asyncHandler } from "../utils/asyncHandler.js"

export const verifyJWT = asyncHandler(async (req,res,next)=>{

    const token = req.headers.authorization?.replace("Bearer ","") || req.query.token;

    if(!token){
        throw new ApiError(401,"Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(token,process.env.JWT_SECRET)

        const user = await User.findById(decodedToken.id).select("-password")

        if(!user){
            throw new ApiError(401,"Invalid token")
        }

        req.user = user

        next()
    } catch (error) {
        throw new ApiError(401, error.message === "jwt expired" ? "Session expired. Please login again." : "Invalid access token");
    }
})