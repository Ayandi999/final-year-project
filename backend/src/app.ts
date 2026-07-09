import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import translationRouter from './routes/app.routes'
import socketRouter from './socket/socket.routes'
import authRouter from './routes/auth.routes'

dotenv.config()

export const app = express();

app.use(express.json({
    limit: "1mb"
}))

app.use(cookieParser())

const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:8080',
    'http://localhost:8083',
    process.env.FRONTEND_URL
].filter(Boolean) as string[];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
            ALLOWED_ORIGINS.includes(origin) || 
            origin.startsWith('http://localhost:') || 
            origin.startsWith('http://127.0.0.1:')
        ) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}))

app.use(express.static("public"));

app.get('/health',(req,res)=>res.status(200).json({message:"ok"}))

app.use('/app/translate', translationRouter);
app.use('/app/socket', socketRouter)
app.use('/app/auth', authRouter)

export default app;