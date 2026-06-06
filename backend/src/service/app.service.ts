import 'dotenv/config';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000/predict';

export async function trnslationFunction(data: number[] | number[][]): Promise<string[]> {
    try {
        const response = await fetch(AI_SERVICE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ frames: data }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AI Service returned status ${response.status}: ${errorText}`);
        }

        const resData = (await response.json()) as { success: boolean; data?: string[]; error?: string };
        if (!resData.success) {
            throw new Error(resData.error || 'Unknown error from AI service');
        }

        return resData.data || [];
    } catch (error: any) {
        throw error;
    }
}