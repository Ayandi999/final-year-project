import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import translationRouter from './routes/app.routes'
import socketRouter from './socket/socket.routes'

dotenv.config()

export const app = express();

app.use(express.json({
    limit: "1mb"
}))

app.use(cors({
    origin: '*',
    // credentials: true // Disabled because origin is *
}))

app.use(express.static("public"));

app.get('/health',(req,res)=>res.status(200).json({message:"ok"}))

app.use('/app/translate', translationRouter);
app.use('/app/socket',socketRouter)

export default app;