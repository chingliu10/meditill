const router=require('express').Router();
const {requireAuth}=require('../../middleware/auth.middleware');
const c=require('./supplier.controller');

router.use(requireAuth);
router.get('/',c.index);
router.get('/api/search',c.searchApi);
router.post('/',c.create);

module.exports=router;
