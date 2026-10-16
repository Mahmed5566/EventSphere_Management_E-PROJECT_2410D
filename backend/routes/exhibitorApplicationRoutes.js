import {Router} from 'express';
import {protect,authorize} from '../middleware/auth.js';
import {apply,mine,all,review} from '../controllers/exhibitorApplicationController.js';
const r=Router();
r.get('/mine',protect,authorize('exhibitor'),mine);
r.get('/',protect,authorize('admin','organizer'),all);
r.post('/:expoId/apply',protect,authorize('exhibitor'),apply);
r.put('/:id/status',protect,authorize('admin','organizer'),review);
export default r;
