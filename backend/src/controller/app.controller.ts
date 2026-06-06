import { type Request, type Response } from 'express';
import ApiResponse from '../utils/ApiResponse';
import { trnslationFunction } from '../service/app.service';

async function trnslateASecnd(req: Request, res: Response) {
    const { frames }: { frames: number[][] } = req.body;

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
        return res.status(400).json({ success: false, error: "Invalid frames payload" });
    }

    try {
        // 2. Perform prediction using the decoupled Django microservice
        const uniqueWords = await trnslationFunction(frames);
       
        res.status(200).json(new ApiResponse(200, uniqueWords, "Translation Successfull"));    
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export {
    trnslateASecnd
};