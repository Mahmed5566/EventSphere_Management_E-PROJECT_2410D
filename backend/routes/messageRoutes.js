import {Router} from 'express';import {protect} from '../middleware/auth.js';import {users,thread,send} from '../controllers/messageController.js';
const r=Router();r.get('/users',protect,users);r.get('/thread/:userId',protect,thread);r.post('/',protect,send);export default r;
