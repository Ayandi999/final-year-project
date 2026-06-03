import { Router } from 'express';
import { trnslateASecnd } from '../controller/app.controller';

const translationRouter = Router();

//This route shall trnslate 1 s worth of json data
translationRouter.post('/translate', trnslateASecnd)

export default translationRouter;
