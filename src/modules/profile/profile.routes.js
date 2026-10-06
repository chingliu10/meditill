const router=require('express').Router();
const {requireAuth}=require('../../middleware/auth.middleware');
const c=require('./profile.controller');

router.use(requireAuth);
router.get('/',c.index);
router.post('/',c.update);

module.exports=router;
