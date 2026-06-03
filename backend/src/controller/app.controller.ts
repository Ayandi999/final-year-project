import {json, type Request,type Response} from 'express'
import ApiError from '../utils/ApiError';
import ApiResponse from '../utils/ApiResponse';
import {trnslationFunction} from '../service/app.service';

async function trnslateASecnd(req:Request,res:Response){
    const mapp = ['congratulations', 'good morning', 'happy birthday', 'how are you', 'i need help']

    const { frames }: { frames: number[][] } = req.body;

        if (!frames || !Array.isArray(frames) || frames.length === 0) {
            return res.status(400).json({ success: false, error: "bad input input" });
        }
    
    // Print coordinates to the terminal once before running model inference
    console.log(`[MODEL INFERENCE] Input Shape: [${frames.length} frames, ${frames[0]?.length} landmarks]. Coordinates for Frame 0:`);
    console.log(frames[0]);

    const result = await trnslationFunction(frames);
    const uniqueWords = new Set<string>();
    const threshold = 0.7;

    console.log(`[MODEL INFERENCE] Processing ${result.length / 5} frames. Class scores:`);
    
    for (let i = 0; i < result.length; i += 5) {
        let maxScore = 0;
        let bestClassIndex = -1;

        // Scan the 5 individual scores for this specific frame
        for (let j = 0; j < 5; j++) {
            const score = parseFloat(result[i + j] as any);
            if (score > maxScore) {
                maxScore = score;
                bestClassIndex = j;
            }
        }

        const predictedClass = bestClassIndex !== -1 ? mapp[bestClassIndex] : 'unknown';
        console.log(`  Frame ${i / 5}: Predicted "${predictedClass}" with confidence ${maxScore.toFixed(4)}`);

        // If it confidently beat the threshold, add to results
        if (maxScore > threshold && bestClassIndex !== -1) {
            const currWord = mapp[bestClassIndex] as string;
            uniqueWords.add(currWord);
        }
    }
    
    console.log(`[MODEL INFERENCE] Confidence threshold reached words:`, Array.from(uniqueWords));
   
    res.status(200).json(new ApiResponse(200, [...uniqueWords], "Translation Successfull"));    
}

export {
    trnslateASecnd
}