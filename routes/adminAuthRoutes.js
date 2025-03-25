import express from 'express'
import { login, signupAdmin } from '../controllers/adminController.js'

const router = express.Router()

router.route("/signup")
    .post(signupAdmin)

router.route("/login")
    .post(login)



export default router