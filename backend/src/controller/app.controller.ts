import { type Request, type Response } from 'express';
import ApiResponse from '../utils/ApiResponse';
import { trnslationFunction } from '../service/app.service';
import { labels, scaler } from '../index';

async function trnslateASecnd(req: Request, res: Response) {
    const { frames }: { frames: number[][] } = req.body;

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
        return res.status(400).json({ success: false, error: "Invalid frames payload" });
    }

    // 1. Dynamic scale preprocessing (subtract mean and divide by scale) if scaler.json is loaded
    let processedFrames = frames;
    if (scaler && Array.isArray(scaler.mean) && Array.isArray(scaler.scale)) {
        const meanArray = scaler.mean;
        const scaleArray = scaler.scale;
        processedFrames = frames.map(frame => {
            return frame.map((val, idx) => {
                const meanVal = meanArray[idx] ?? 0;
                const scaleVal = scaleArray[idx] ?? 1;
                return scaleVal !== 0 ? (val - meanVal) / scaleVal : (val - meanVal);
            });
        });
    }

    // Print coordinates to the terminal once before running model inference
    console.log(`[MODEL INFERENCE] Input Shape: [${processedFrames.length} frames, ${processedFrames[0]?.length} elements]. Processed Frame 0:`);
    console.log(processedFrames[0]);

    // 2. Perform TF.js prediction
    const result = await trnslationFunction(processedFrames);
    const uniqueWords = new Set<string>();
    
    // Use dynamic label size
    const numClasses = Object.keys(labels).length;
    const threshold = 0.55; // Relaxed threshold for more complex signs

    console.log(`[MODEL INFERENCE] Processing ${result.length / numClasses} frames. Class scores:`);
    
    for (let i = 0; i < result.length; i += numClasses) {
        let maxScore = 0;
        let bestClassIndex = -1;

        // Scan the individual scores for this frame
        for (let j = 0; j < numClasses; j++) {
            const score = parseFloat(result[i + j] as any);
            if (score > maxScore) {
                maxScore = score;
                bestClassIndex = j;
            }
        }

        // Map predicted class to dynamic labels
        const predictedClass = bestClassIndex !== -1 ? (labels[String(bestClassIndex)] || 'unknown') : 'unknown';
        console.log(`  Frame ${i / numClasses}: Predicted "${predictedClass}" with confidence ${maxScore.toFixed(4)}`);

        // If it confidently beat the threshold, add to results
        if (maxScore > threshold && bestClassIndex !== -1) {
            const currWord = labels[String(bestClassIndex)];
            if (currWord) {
                uniqueWords.add(currWord);
            }
        }
    }
    
    console.log(`[MODEL INFERENCE] Confidence threshold reached words:`, Array.from(uniqueWords));
   
    res.status(200).json(new ApiResponse(200, [...uniqueWords], "Translation Successfull"));    
}

export {
    trnslateASecnd
};