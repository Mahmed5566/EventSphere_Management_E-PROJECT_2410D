import {Router} from 'express';import {listVenues,createVenue,updateVenue,deleteVenue} from '../controllers/venueController.js';import {protect,authorize} from '../middleware/auth.js';
const r=Router();r.get('/',listVenues);r.post('/',protect,authorize('admin','organizer'),createVenue);r.put('/:id',protect,authorize('admin','organizer'),updateVenue);
r.delete('/:id',protect,authorize('admin','organizer'),deleteVenue);export default r;
