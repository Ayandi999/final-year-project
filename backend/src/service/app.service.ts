import * as tf from '@tensorflow/tfjs';
import { model } from '..';

//@ts-ignore
async function trnslationFunction(data){
    const output = tf.tidy(()=>{
        const inputTensor = tf.tensor2d(data)
        const predicton = model?.predict(inputTensor) as tf.Tensor;
        const result = predicton.dataSync();
        return result;
    })
    return output;
}

export {
    trnslationFunction
}